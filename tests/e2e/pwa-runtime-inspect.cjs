const { chromium } = require('playwright')
const assert = require('node:assert/strict')

const baseUrl = process.env.NC_BASE_URL || 'https://nextcloud.local'
const browserAddress = process.env.NC_BROWSER_ADDRESS
const pwaPath = '/index.php/apps/taskbook/pwa/'

async function main() {
	const args = baseUrl.startsWith('http://') ? [`--unsafely-treat-insecure-origin-as-secure=${baseUrl}`] : []
	if (browserAddress) { args.push(`--host-resolver-rules=MAP localhost ${browserAddress}`) }
	const browser = await chromium.launch({ headless: true, args })
	try {
		const context = await browser.newContext({ ignoreHTTPSErrors: true })
		const page = await context.newPage()
		await page.goto(`${baseUrl}${pwaPath}`)
		await page.getByRole('heading', { name: 'Set up Taskbook' }).waitFor()

		await page.evaluate(async () => {
			for (const registration of await navigator.serviceWorker.getRegistrations()) {
				if (new URL(registration.scope).pathname.endsWith('/apps/taskbook/pwa/')) {
					await registration.unregister()
				}
			}
			for (const name of await caches.keys()) {
				if (name.startsWith('taskbook-pwa-')) { await caches.delete(name) }
			}
			await caches.open('taskbook-pwa-obsolete-regression')
		})

		await page.reload()
		await page.getByRole('heading', { name: 'Set up Taskbook' }).waitFor()
		const ready = await page.evaluate(async () => {
			const registration = await Promise.race([
				navigator.serviceWorker.ready,
				new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker readiness timed out.')), 15_000)),
			])
			return {
				scope: registration.scope,
				activeScriptUrl: registration.active?.scriptURL ?? null,
			}
		})
		if (await page.evaluate(() => navigator.serviceWorker.controller === null)) {
			await page.reload()
			await page.getByRole('heading', { name: 'Set up Taskbook' }).waitFor()
		}

		const runtime = await page.evaluate(async () => {
			const registration = await navigator.serviceWorker.ready
			const workerResponse = await fetch('service-worker.js', { cache: 'no-store', credentials: 'omit' })
			const workerSource = await workerResponse.text()
			const cacheName = workerSource.match(/"cacheName":"([^"]+)"/)?.[1] ?? null
			const cacheNames = (await caches.keys()).filter((name) => name.startsWith('taskbook-pwa-'))
			const cachedUrls = cacheName === null ? [] : (await (await caches.open(cacheName)).keys()).map((request) => request.url).sort()
			const loadedScripts = [...document.querySelectorAll('script[src]')].map((script) => script.src)
			const workerRuntime = await new Promise((resolve, reject) => {
				const timeout = setTimeout(() => reject(new Error('Service worker runtime identity timed out.')), 5_000)
				const onMessage = (event) => {
					if (event.data?.type !== 'TASKBOOK_PWA_RUNTIME') { return }
					clearTimeout(timeout)
					navigator.serviceWorker.removeEventListener('message', onMessage)
					resolve(event.data)
				}
				navigator.serviceWorker.addEventListener('message', onMessage)
				navigator.serviceWorker.controller.postMessage('TASKBOOK_PWA_RUNTIME')
			})
			return {
				activeScriptUrl: registration.active?.scriptURL ?? null,
				cacheName,
				cacheNames,
				cachedUrls,
				controlled: navigator.serviceWorker.controller !== null,
				controllerScriptUrl: navigator.serviceWorker.controller?.scriptURL ?? null,
				loadedScripts,
				scope: registration.scope,
				workerContentType: workerResponse.headers.get('Content-Type'),
				buildVersion: document.querySelector('#taskbook-pwa')?.dataset.taskbookPwaBuild,
				workerRuntime,
			}
		})

		assert.equal(ready.scope, `${baseUrl}${pwaPath}`)
		assert.equal(runtime.scope, `${baseUrl}${pwaPath}`)
		assert.equal(runtime.controlled, true)
		assert.equal(runtime.activeScriptUrl, `${baseUrl}${pwaPath}service-worker.js`)
		assert.equal(runtime.controllerScriptUrl, runtime.activeScriptUrl)
		assert.match(runtime.cacheName, /^taskbook-pwa-[a-f0-9]{64}$/)
		assert.match(runtime.buildVersion, /^[a-f0-9]{64}$/)
		assert.equal(runtime.workerRuntime.cacheName, runtime.cacheName)
		assert.equal(runtime.workerRuntime.buildVersion, runtime.buildVersion)
		assert.deepEqual(runtime.cacheNames, [runtime.cacheName], 'Activation must remove obsolete Taskbook shell caches.')
		assert.equal(runtime.cachedUrls.length, 7)
		assert.ok(runtime.cachedUrls.every((url) => !url.includes('/ocs/v2.php/')), 'The service worker must not cache Taskbook API responses.')
		assert.ok(runtime.loadedScripts.some((url) => new URL(url).pathname.endsWith('/taskbook/js/taskbook-pwa.mjs')), `Expected the current Taskbook PWA bundle; loaded scripts: ${JSON.stringify(runtime.loadedScripts)}`)
		assert.match(runtime.workerContentType, /^application\/javascript;/)

		const publicResponses = await page.evaluate(async (paths) => Promise.all(paths.map(async (path) => {
			const response = await fetch(path, { credentials: 'omit', redirect: 'manual' })
			return { path, status: response.status, contentType: response.headers.get('Content-Type') }
		})), [pwaPath, `${pwaPath}manifest.webmanifest`, `${pwaPath}service-worker.js`])
		assert.deepEqual(publicResponses.map(({ status }) => status), [200, 200, 200])
		assert.match(publicResponses[0].contentType, /^text\/html;/)
		assert.match(publicResponses[1].contentType, /^application\/manifest\+json;/)
		assert.match(publicResponses[2].contentType, /^application\/javascript;/)

		const apiRequests = [
			['GET', '/ocs/v2.php/apps/taskbook/api/v1/contexts'],
			['POST', '/ocs/v2.php/apps/taskbook/api/v1/contexts'],
			['GET', '/ocs/v2.php/apps/taskbook/api/v1/entries/1'],
			['POST', '/ocs/v2.php/apps/taskbook/api/v1/entries'],
			['PATCH', '/ocs/v2.php/apps/taskbook/api/v1/entries/1'],
			['DELETE', '/ocs/v2.php/apps/taskbook/api/v1/entries/1'],
			['GET', '/ocs/v2.php/apps/taskbook/api/v1/settings'],
			['PUT', '/ocs/v2.php/apps/taskbook/api/v1/settings/default-context'],
			['PUT', '/ocs/v2.php/apps/taskbook/api/v1/settings/overdue-reminders'],
			['GET', '/ocs/v2.php/apps/taskbook/api/v1/views/overview'],
			['GET', '/ocs/v2.php/apps/taskbook/api/v1/views/day'],
			['GET', '/ocs/v2.php/apps/taskbook/api/v1/views/week'],
			['GET', '/ocs/v2.php/apps/taskbook/api/v1/views/month'],
			['GET', '/ocs/v2.php/apps/taskbook/api/v1/views/future'],
			['POST', '/ocs/v2.php/apps/taskbook/api/v1/sync'],
			['GET', '/ocs/v2.php/apps/taskbook/api/v1/health'],
		]
		const anonymousApiResponses = await page.evaluate(async (requests) => Promise.all(requests.map(async ([method, path]) => {
			const response = await fetch(path, {
				method,
				credentials: 'omit',
				redirect: 'manual',
				headers: { Accept: 'application/json', 'OCS-APIRequest': 'true', ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }) },
				...(method === 'GET' ? {} : { body: '{}' }),
			})
			return { method, path, status: response.status }
		})), apiRequests)
		assert.ok(anonymousApiResponses.every(({ status }) => status === 401), `Every anonymous Taskbook data route must return 401: ${JSON.stringify(anonymousApiResponses)}`)

		console.log(JSON.stringify({
			activeServiceWorker: runtime.activeScriptUrl,
			cacheName: runtime.cacheName,
			buildVersion: runtime.buildVersion,
			controlled: runtime.controlled,
			loadedScripts: runtime.loadedScripts,
			cachedUrls: runtime.cachedUrls,
			publicResponses,
			anonymousApiResponses,
		}, null, 2))
	} finally {
		await browser.close()
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? (error.stack ?? error.message) : String(error))
	process.exitCode = 1
})
