const { chromium } = require('playwright')
const assert = require('node:assert/strict')

const baseUrl = process.env.NC_BASE_URL || 'https://nextcloud.local'
const browserAddress = process.env.NC_BROWSER_ADDRESS

async function main() {
	const args = baseUrl.startsWith('http://') ? [`--unsafely-treat-insecure-origin-as-secure=${baseUrl}`] : []
	if (browserAddress) { args.push(`--host-resolver-rules=MAP localhost ${browserAddress}`) }
	const browser = await chromium.launch({ headless: true, args })
	try {
		const context = await browser.newContext({
			ignoreHTTPSErrors: true,
			viewport: { width: 320, height: 700 },
			colorScheme: 'dark',
		})
		const page = await context.newPage()
		const errors = []
		page.on('pageerror', (error) => errors.push(error.message))
		page.on('console', (message) => {
			if (message.type() === 'error') { errors.push(message.text()) }
		})
		await page.goto(`${baseUrl}/index.php/apps/taskbook/pwa/`)
		await page.getByRole('heading', { name: 'Set up Taskbook' }).waitFor()
		let registration
		try {
			registration = await page.evaluate(async () => {
				if (!navigator.serviceWorker) { throw new Error('Service workers are unavailable for this origin.') }
				const ready = await Promise.race([
					navigator.serviceWorker.ready,
					new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker readiness timed out.')), 15_000)),
				])
				return { scope: ready.scope, controlled: navigator.serviceWorker.controller !== null }
			})
		} catch (error) {
			const registrations = await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations() || []).map((item) => ({
				scope: item.scope,
				active: item.active?.state,
				installing: item.installing?.state,
				waiting: item.waiting?.state,
			})))
			throw new Error(`${error.message} Registrations: ${JSON.stringify(registrations)}. Browser errors: ${JSON.stringify(errors)}.`)
		}
		assert.match(registration.scope, /\/index\.php\/apps\/taskbook\/pwa\/$/)
		const manifest = await page.locator('link[rel="manifest"]').getAttribute('href')
		assert.equal(manifest, 'manifest.webmanifest')
		await context.setOffline(true)
		await page.reload()
		await page.getByRole('heading', { name: 'Set up Taskbook' }).waitFor()
		assert.deepEqual(errors, [])
		console.log('PWA shell smoke: CSP/module load, scoped service worker, 320px dark mode, and offline restart passed.')
	} finally {
		await browser.close()
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error))
	process.exitCode = 1
})
