import type { AccountConfiguration, OutboxMutation, SyncResponse } from '../types.ts'

import { diagnostics } from '../diagnostics.ts'
import { randomUuid } from '../identity.ts'

export type ApiFailureKind = 'authentication' | 'unreachable' | 'server' | 'invalid-response'

export class ApiError extends Error {
	public readonly kind: ApiFailureKind
	public readonly status: number | null

	public constructor(kind: ApiFailureKind, status: number | null, message: string) {
		super(message)
		this.kind = kind
		this.status = status
	}
}

function basicAuthorization(loginName: string, appPassword: string): string {
	const bytes = new TextEncoder().encode(`${loginName}:${appPassword}`)
	let binary = ''
	for (const byte of bytes) {
		binary += String.fromCharCode(byte)
	}
	return `Basic ${btoa(binary)}`
}

export function taskbookApiBaseUrl(serverUrl: string): string {
	const server = new URL(serverUrl)
	server.search = ''
	server.hash = ''
	server.pathname = server.pathname.replace(/\/index\.php\/?$/u, '/')
	const base = `${server.href.replace(/\/+$/u, '')}/`
	return new URL('ocs/v2.php/apps/taskbook/api/v1', base).href.replace(/\/$/u, '')
}

function apiUrl(apiBaseUrl: string, path: string): string {
	return `${apiBaseUrl.replace(/\/+$/u, '')}/${path.replace(/^\/+/, '')}`
}

async function request(account: AccountConfiguration, path: string, init: RequestInit = {}, timeout = 15_000): Promise<Response> {
	const controller = new AbortController()
	const timer = window.setTimeout(() => controller.abort(), timeout)
	const url = apiUrl(account.apiBaseUrl, path)
	const requestId = randomUuid()
	const startedAt = performance.now()
	void diagnostics.log('info', 'api', 'api.request', { requestId, method: init.method ?? 'GET', path: new URL(url).pathname, authenticated: true })
	try {
		const response = await fetch(url, {
			...init,
			signal: controller.signal,
			credentials: 'omit',
			headers: {
				Accept: 'application/json',
				Authorization: basicAuthorization(account.loginName, account.appPassword),
				'OCS-APIRequest': 'true',
				...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
				...init.headers,
			},
		})
		void diagnostics.log('info', 'api', 'api.response', { requestId, status: response.status, durationMs: Math.round(performance.now() - startedAt) })
		if (response.status === 401 || response.status === 403) {
			throw new ApiError('authentication', response.status, 'Connection expired')
		}
		if (!response.ok) {
			throw new ApiError('server', response.status, `Taskbook returned HTTP ${response.status}.`)
		}
		return response
	} catch (error) {
		if (error instanceof ApiError) {
			void diagnostics.log('error', 'api', 'api.error', { requestId, category: error.kind, status: error.status })
			throw error
		}
		void diagnostics.log('error', 'api', 'api.error', { requestId, category: 'network', status: null, errorName: error instanceof Error ? error.name : typeof error })
		throw new ApiError('unreachable', null, 'The Taskbook server is unreachable.')
	} finally {
		window.clearTimeout(timer)
	}
}

async function ocsData<T>(response: Response): Promise<T> {
	try {
		const body = await response.json() as { ocs?: { data?: T } }
		if (body.ocs?.data === undefined) {
			throw new TypeError('Missing OCS data.')
		}
		return body.ocs.data
	} catch (error) {
		if (error instanceof ApiError) {
			throw error
		}
		void diagnostics.log('error', 'api', 'api.error', { category: 'invalid-response', status: response.status })
		throw new ApiError('invalid-response', response.status, 'Taskbook returned an invalid response.')
	}
}

export async function synchronize(account: AccountConfiguration, mutations: OutboxMutation[]): Promise<SyncResponse> {
	const response = await request(account, '/sync', {
		method: 'POST',
		body: JSON.stringify({
			installationId: account.installationId,
			cursor: account.lastSyncCursor,
			mutations: mutations.map(({ operationId, clientUid, type, baseRevision, entry }) => ({ operationId, clientUid, type, baseRevision, entry })),
		}),
	})
	return ocsData<SyncResponse>(response)
}

export async function health(account: AccountConfiguration): Promise<void> {
	await request(account, '/health', { method: 'GET' }, 8_000)
}

export async function revokeAppPassword(account: AccountConfiguration, revokePath: string): Promise<void> {
	const controller = new AbortController()
	const timer = window.setTimeout(() => controller.abort(), 10_000)
	try {
		const response = await fetch(revokePath, {
			method: 'DELETE',
			credentials: 'omit',
			signal: controller.signal,
			headers: { Accept: 'application/json', Authorization: basicAuthorization(account.loginName, account.appPassword), 'OCS-APIRequest': 'true' },
		})
		if (!response.ok) {
			throw new Error('Revocation failed.')
		}
	} finally {
		window.clearTimeout(timer)
	}
}
