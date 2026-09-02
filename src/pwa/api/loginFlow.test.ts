import type { PwaBootstrap } from '../types.ts'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoginFlowError, pollLogin, startLogin } from './loginFlow.ts'

const bootstrap: PwaBootstrap = {
	appPasswordRevokePath: '/ocs/v2.php/core/apppassword',
	loginFlowPath: '/index.php/login/v2',
	iconUrl: '/icon.png',
	manifestUrl: '/manifest.webmanifest',
	serviceWorkerUrl: '/service-worker.js',
}

const started = {
	login: 'http://nextcloud.local/login/v2/flow/redacted',
	poll: { token: 'redacted-token', endpoint: 'http://nextcloud.local/login/v2/poll' },
}

const completed = { server: 'http://nextcloud.local', loginName: 'test-user', appPassword: 'secret-app-password' }

afterEach(() => vi.unstubAllGlobals())

function installBrowserGlobals(): void {
	vi.stubGlobal('window', { location: { origin: 'http://nextcloud.local' }, setTimeout, clearTimeout })
	vi.stubGlobal('navigator', { language: 'en-GB' })
}

describe('Nextcloud Login Flow v2 client', () => {
	it('initiates with POST and preserves the server-provided URLs exactly', async () => {
		installBrowserGlobals()
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(started), { status: 200 }))
		const result = await startLogin(bootstrap, { fetcher })
		expect(result).toEqual(started)
		expect(fetcher).toHaveBeenCalledWith('/index.php/login/v2', expect.objectContaining({ method: 'POST' }))
	})

	it('polls the exact endpoint sequentially through repeated 404 responses and consumes 200 once', async () => {
		installBrowserGlobals()
		const statuses = [404, 404, 404, 200]
		let active = 0
		let maximumActive = 0
		const fetcher = vi.fn<typeof fetch>(async () => {
			active++
			maximumActive = Math.max(maximumActive, active)
			await Promise.resolve()
			active--
			const status = statuses.shift() as number
			if (status === 200) { return new Response(JSON.stringify(completed), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } }) }
			return new Response(null, { status })
		})
		const account = await pollLogin(started, bootstrap, undefined, { fetcher, wait: async () => {} })
		expect(account).toMatchObject({ serverUrl: 'http://nextcloud.local', loginName: 'test-user', appPassword: 'secret-app-password', authState: 'connected' })
		expect(account.apiBaseUrl).toBe('http://nextcloud.local/ocs/v2.php/apps/taskbook/api/v1')
		expect(fetcher).toHaveBeenCalledTimes(4)
		expect(maximumActive).toBe(1)
		for (const [endpoint, init] of fetcher.mock.calls) {
			expect(endpoint).toBe('http://nextcloud.local/login/v2/poll')
			expect(endpoint).not.toContain('/index.php/login/v2/poll')
			expect(init).toEqual(expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }))
			expect(String(init?.body)).toBe('token=redacted-token')
		}
	})

	it('expires cleanly after bounded pending responses', async () => {
		installBrowserGlobals()
		let now = 0
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 }))
		const result = pollLogin(started, bootstrap, undefined, { fetcher, timeoutMs: 2_500, now: () => now, wait: async (milliseconds) => { now += milliseconds } })
		await expect(result).rejects.toMatchObject({ kind: 'expired' })
		expect(fetcher).toHaveBeenCalledTimes(3)
	})

	it('cancels an old attempt and ignores its stale response', async () => {
		installBrowserGlobals()
		const controller = new AbortController()
		let resolveResponse: (response: Response) => void = () => {}
		const fetcher = vi.fn<typeof fetch>(() => new Promise((resolve) => { resolveResponse = resolve }))
		const result = pollLogin(started, bootstrap, undefined, { fetcher, signal: controller.signal, wait: async () => {} })
		controller.abort()
		resolveResponse(new Response(null, { status: 404 }))
		await expect(result).rejects.toMatchObject({ name: 'AbortError' })
		expect(fetcher).toHaveBeenCalledTimes(1)
	})

	it('classifies unexpected poll failures separately from pending responses', async () => {
		installBrowserGlobals()
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 500 }))
		const result = pollLogin(started, bootstrap, undefined, { fetcher, wait: async () => {} })
		await expect(result).rejects.toBeInstanceOf(LoginFlowError)
		await expect(result).rejects.toMatchObject({ kind: 'rejected' })
	})

	it('records the canonical server before rejecting a browser-unreachable Login Flow host', async () => {
		installBrowserGlobals()
		const events: Array<{ event: string, metadata?: Record<string, unknown> }> = []
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ...completed, server: 'http://nextcloud' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
		await expect(pollLogin(started, bootstrap, undefined, { fetcher, onDiagnosticEvent: (event, metadata) => events.push({ event, metadata }) })).rejects.toMatchObject({ kind: 'server-unreachable' })
		expect(events).toContainEqual({ event: 'auth.poll.completed', metadata: { status: 200, contentType: 'application/json' } })
		expect(events).toContainEqual({ event: 'auth.server', metadata: { server: 'http://nextcloud' } })
		expect(events).toContainEqual({ event: 'auth.credentials.validation.success', metadata: {} })
	})
})
