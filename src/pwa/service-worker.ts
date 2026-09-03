interface WorkerConfiguration {
	cacheName: string
	buildVersion: string
	scopePath: string
	shellUrl: string
	assets: string[]
}

interface WorkerExtendableEvent extends Event { waitUntil: (promise: Promise<unknown>) => void }
interface WorkerFetchEvent extends WorkerExtendableEvent { request: Request, respondWith: (response: Promise<Response>) => void }

const worker = globalThis as typeof globalThis & {
	__TASKBOOK_PWA_CONFIG__: WorkerConfiguration
	clients: { claim: () => Promise<void>, matchAll: (options: { type: string, includeUncontrolled: boolean }) => Promise<Array<{ postMessage: (message: string | Record<string, unknown>) => void }>> }
}
const configuration = worker.__TASKBOOK_PWA_CONFIG__

function workerErrorMetadata(error: unknown): Record<string, unknown> {
	return { errorName: error instanceof Error ? error.name : typeof error }
}

function reportWorkerEvent(level: 'info' | 'warning' | 'error', event: string, metadata: Record<string, unknown> = {}): void {
	void worker.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
		for (const client of clients) {
			client.postMessage({ type: 'TASKBOOK_PWA_DIAGNOSTIC', level, event, metadata })
		}
	}).catch(() => undefined)
}

globalThis.addEventListener('install', (rawEvent) => {
	const event = rawEvent as WorkerExtendableEvent
	event.waitUntil((async () => {
		try {
			await (await caches.open(configuration.cacheName)).addAll(configuration.assets)
			reportWorkerEvent('info', 'service-worker.install.success', { cacheName: configuration.cacheName })
		} catch (error) {
			reportWorkerEvent('error', 'service-worker.install.failed', workerErrorMetadata(error))
			throw error
		}
	})())
})

globalThis.addEventListener('activate', (rawEvent) => {
	const event = rawEvent as WorkerExtendableEvent
	event.waitUntil((async () => {
		try {
			await Promise.all([
				caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith('taskbook-pwa-') && name !== configuration.cacheName).map((name) => caches.delete(name)))),
				worker.clients.claim(),
			])
			reportWorkerEvent('info', 'service-worker.activate.success', { cacheName: configuration.cacheName })
		} catch (error) {
			reportWorkerEvent('error', 'service-worker.activate.failed', workerErrorMetadata(error))
			throw error
		}
	})())
})

globalThis.addEventListener('fetch', (rawEvent) => {
	const event = rawEvent as WorkerFetchEvent
	if (event.request.method !== 'GET') { return }
	const url = new URL(event.request.url)
	const isNavigation = event.request.mode === 'navigate' && url.origin === location.origin && url.pathname.startsWith(configuration.scopePath)
	if (isNavigation) {
		event.respondWith(fetch(event.request).then(async (response) => {
			const responseUrl = new URL(response.url)
			if (response.ok && !response.redirected && responseUrl.pathname.startsWith(configuration.scopePath)) {
				await (await caches.open(configuration.cacheName)).put(configuration.shellUrl, response.clone())
				return response
			}
			return (await caches.match(configuration.shellUrl)) ?? response
		}).catch(async (error) => {
			reportWorkerEvent('warning', 'service-worker.fetch.failed', workerErrorMetadata(error))
			return (await caches.match(configuration.shellUrl)) ?? Response.error()
		}))
		return
	}
	if (!configuration.assets.includes(url.href)) { return }
	event.respondWith(caches.match(event.request).then(async (cached) => {
		try {
			if (cached !== undefined) { return cached }
			const response = await fetch(event.request)
			if (response.ok && !response.redirected) { await (await caches.open(configuration.cacheName)).put(event.request, response.clone()) }
			return response
		} catch (error) {
			reportWorkerEvent('warning', 'service-worker.fetch.failed', workerErrorMetadata(error))
			throw error
		}
	}))
})

globalThis.addEventListener('message', (rawEvent) => {
	const event = rawEvent as MessageEvent
	if (event.data === 'SKIP_WAITING') {
		reportWorkerEvent('info', 'service-worker.update.activating')
		void (globalThis as typeof globalThis & { skipWaiting: () => Promise<void> }).skipWaiting()
	}
	if (event.data === 'TASKBOOK_PWA_RUNTIME') {
		const source = event.source as { postMessage?: (message: Record<string, unknown>) => void } | null
		source?.postMessage?.({ type: 'TASKBOOK_PWA_RUNTIME', cacheName: configuration.cacheName, buildVersion: configuration.buildVersion })
	}
})

globalThis.addEventListener('sync', (rawEvent) => {
	const event = rawEvent as WorkerExtendableEvent & { tag?: string }
	if (event.tag !== 'taskbook-sync') { return }
	event.waitUntil(worker.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
		for (const client of clients) { client.postMessage('TASKBOOK_SYNC') }
		reportWorkerEvent('info', 'service-worker.sync.dispatched', { clients: clients.length })
	}))
})
