import type { AccountConfiguration } from '../types.ts'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { health, taskbookApiBaseUrl } from './transport.ts'

function account(serverUrl: string): AccountConfiguration {
	return {
		key: 'primary',
		serverUrl,
		apiBaseUrl: taskbookApiBaseUrl(serverUrl),
		loginName: 'tést-user',
		appPassword: 'dedicated-password',
		locale: 'en',
		timezone: 'Europe/Berlin',
		installationId: '00000000-0000-4000-8000-000000000001',
		lastSyncCursor: null,
		lastSuccessfulSyncAt: null,
		defaultContextId: 1,
		authState: 'connected',
	}
}

afterEach(() => vi.unstubAllGlobals())

describe('standalone PWA API transport', () => {
	it('builds the canonical Taskbook API base without duplicate slashes or index.php', () => {
		expect(taskbookApiBaseUrl('http://nextcloud.local')).toBe('http://nextcloud.local/ocs/v2.php/apps/taskbook/api/v1')
		expect(taskbookApiBaseUrl('http://nextcloud.local/')).toBe('http://nextcloud.local/ocs/v2.php/apps/taskbook/api/v1')
		expect(taskbookApiBaseUrl('http://nextcloud.local/index.php')).toBe('http://nextcloud.local/ocs/v2.php/apps/taskbook/api/v1')
	})

	it('uses canonical server, Unicode-safe loginName/appPassword Basic auth, and OCS headers', async () => {
		vi.stubGlobal('window', { setTimeout, clearTimeout })
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }))
		vi.stubGlobal('fetch', fetcher)
		await health(account('http://nextcloud.local/'))
		expect(fetcher).toHaveBeenCalledTimes(1)
		const [url, init] = fetcher.mock.calls[0]
		expect(url).toBe('http://nextcloud.local/ocs/v2.php/apps/taskbook/api/v1/health')
		const headers = new Headers(init?.headers)
		expect(headers.get('OCS-APIRequest')).toBe('true')
		expect(headers.get('Accept')).toBe('application/json')
		const encoded = headers.get('Authorization')?.replace(/^Basic /u, '') as string
		const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
		expect(new TextDecoder().decode(bytes)).toBe('tést-user:dedicated-password')
		expect(init?.credentials).toBe('omit')
	})
})
