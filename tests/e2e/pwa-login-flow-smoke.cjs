const { chromium } = require('playwright')
const assert = require('node:assert/strict')

const baseUrl = process.env.NC_BASE_URL || 'https://nextcloud.local'
const browserAddress = process.env.NC_BROWSER_ADDRESS

async function main() {
	const args = baseUrl.startsWith('http://') ? [`--unsafely-treat-insecure-origin-as-secure=${baseUrl}`] : []
	if (browserAddress) { args.push(`--host-resolver-rules=MAP localhost ${browserAddress}`) }
	const browser = await chromium.launch({ headless: true, args })
	try {
		const context = await browser.newContext({ ignoreHTTPSErrors: true })
		const page = await context.newPage()
		let pollEndpoint = null
		const pollRequests = []
		page.on('response', async (response) => {
			if (response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/login/v2')) {
				const body = await response.json()
				pollEndpoint = body.poll.endpoint
			}
		})
		page.on('request', (request) => {
			if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/login/v2/poll')) { pollRequests.push(request.url()) }
		})
		await page.goto(`${baseUrl}/index.php/apps/taskbook/pwa/`)
		const popupPromise = context.waitForEvent('page')
		await page.getByRole('button', { name: 'Connect to Nextcloud' }).click()
		const popup = await popupPromise
		await popup.waitForLoadState('domcontentloaded')
		await new Promise((resolve) => setTimeout(resolve, 3_500))
		assert.equal(typeof pollEndpoint, 'string')
		assert.ok(pollRequests.length >= 3)
		assert.ok(pollRequests.every((url) => url === pollEndpoint), 'Every poll request must use the server-provided endpoint exactly.')
		assert.equal(await page.locator('.toast-error').count(), 0, 'Expected pending 404 responses must not display a failure.')
		console.log(`PWA Login Flow smoke: ${pollRequests.length} pending 404 responses used the exact redacted server endpoint without error UI.`)
	} finally {
		await browser.close()
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error))
	process.exitCode = 1
})
