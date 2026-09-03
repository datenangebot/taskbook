import type { AccountConfiguration, PwaBootstrap } from '../types.ts'

import { randomUuid } from '../identity.ts'
import { taskbookApiBaseUrl } from './transport.ts'

interface LoginStart {
	login: string
	poll: { token: string, endpoint: string }
}

interface LoginResult {
	server: string
	loginName: string
	appPassword: string
}

interface LoginRequestOptions {
	signal?: AbortSignal
	fetcher?: typeof fetch
	onDiagnosticEvent?: (event: string, metadata?: Record<string, unknown>) => void
}

interface LoginPollOptions extends LoginRequestOptions {
	timeoutMs?: number
	pollIntervalMs?: number
	now?: () => number
	wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>
}

export class LoginFlowError extends Error {
	public readonly kind: 'expired' | 'rejected' | 'invalid-response' | 'server-unreachable'

	constructor(kind: 'expired' | 'rejected' | 'invalid-response' | 'server-unreachable', message: string) {
		super(message)
		this.kind = kind
	}
}

function sameOriginUrl(value: string): URL {
	const url = new URL(value, window.location.origin)
	if (url.origin !== window.location.origin) {
		throw new TypeError('Taskbook v1 only supports its installation origin.')
	}
	return url
}

function canonicalServerUrl(value: string): URL {
	const url = new URL(value)
	if (!['http:', 'https:'].includes(url.protocol) || url.username !== '' || url.password !== '') {
		throw new TypeError('Nextcloud returned an invalid server URL.')
	}
	url.search = ''
	url.hash = ''
	return url
}

function report(options: LoginRequestOptions, event: string, metadata: Record<string, unknown> = {}): void {
	options.onDiagnosticEvent?.(event, metadata)
}

export async function startLogin(bootstrap: PwaBootstrap, options: LoginRequestOptions = {}): Promise<LoginStart> {
	report(options, 'auth.login-flow.request')
	let response: Response
	try {
		response = await (options.fetcher ?? fetch)(bootstrap.loginFlowPath, { method: 'POST', credentials: 'omit', headers: { Accept: 'application/json' }, signal: options.signal })
	} catch (error) {
		report(options, options.signal?.aborted ? 'auth.poll.cancelled' : 'auth.login-flow.network-error', { errorName: error instanceof Error ? error.name : typeof error })
		throw error
	}
	if (!response.ok) {
		report(options, 'auth.login-flow.unexpected-response', { status: response.status })
		throw new Error('Could not start the Nextcloud login flow.')
	}
	const result = await response.json() as LoginStart
	if (typeof result.login !== 'string' || typeof result.poll?.endpoint !== 'string' || typeof result.poll.token !== 'string') {
		throw new LoginFlowError('invalid-response', 'Nextcloud returned an invalid login-flow response.')
	}
	sameOriginUrl(result.login)
	sameOriginUrl(result.poll.endpoint)
	report(options, 'auth.login-flow.created')
	return result
}

function abortError(): DOMException {
	return new DOMException('The login attempt was cancelled.', 'AbortError')
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) { reject(abortError()); return }
		const timer = { id: 0 }
		const aborted = (): void => { window.clearTimeout(timer.id); reject(abortError()) }
		timer.id = window.setTimeout(() => { signal?.removeEventListener('abort', aborted); resolve() }, milliseconds)
		signal?.addEventListener('abort', aborted, { once: true })
	})
}

export async function pollLogin(start: LoginStart, bootstrap: PwaBootstrap, previous?: AccountConfiguration, options: LoginPollOptions = {}): Promise<AccountConfiguration> {
	sameOriginUrl(start.poll.endpoint)
	report(options, 'auth.poll.start')
	const now = options.now ?? Date.now
	const deadline = now() + (options.timeoutMs ?? 10 * 60_000)
	const fetcher = options.fetcher ?? fetch
	while (now() < deadline) {
		if (options.signal?.aborted) {
			report(options, 'auth.poll.cancelled')
			throw abortError()
		}
		let response: Response
		try {
			response = await fetcher(start.poll.endpoint, {
				method: 'POST',
				credentials: 'omit',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({ token: start.poll.token }),
				signal: options.signal,
			})
		} catch (error) {
			report(options, options.signal?.aborted ? 'auth.poll.cancelled' : 'auth.poll.network-error', { errorName: error instanceof Error ? error.name : typeof error })
			throw error
		}
		if (options.signal?.aborted) {
			report(options, 'auth.poll.cancelled')
			throw abortError()
		}
		if (response.status === 200) {
			const contentType = response.headers.get('Content-Type')
			report(options, 'auth.poll.completed', { status: response.status, contentType })
			report(options, 'auth.credentials.validation.start')
			if (!response.headers.get('Content-Type')?.toLowerCase().includes('application/json')) {
				report(options, 'auth.credentials.validation.failed', { reason: 'content-type' })
				throw new LoginFlowError('invalid-response', 'Nextcloud returned login credentials with an invalid content type.')
			}
			let result: LoginResult
			try {
				result = await response.json() as LoginResult
			} catch (error) {
				report(options, 'auth.credentials.validation.failed', { reason: 'json', errorName: error instanceof Error ? error.name : typeof error })
				throw new LoginFlowError('invalid-response', 'Nextcloud returned invalid login credentials.')
			}
			if (options.signal?.aborted) {
				report(options, 'auth.poll.cancelled')
				throw abortError()
			}
			if (typeof result.server !== 'string' || typeof result.loginName !== 'string' || result.loginName === '' || typeof result.appPassword !== 'string' || result.appPassword === '') {
				report(options, 'auth.credentials.validation.failed', { reason: 'missing-fields' })
				throw new LoginFlowError('invalid-response', 'Nextcloud returned incomplete login credentials.')
			}
			let serverUrl: URL
			try {
				serverUrl = canonicalServerUrl(result.server)
			} catch {
				report(options, 'auth.credentials.validation.failed', { reason: 'server-url' })
				throw new LoginFlowError('invalid-response', 'Nextcloud returned an invalid server URL.')
			}
			const server = serverUrl.href.replace(/\/$/u, '')
			report(options, 'auth.credentials.validation.success')
			report(options, 'auth.server', { server })
			if (serverUrl.origin !== window.location.origin) {
				throw new LoginFlowError('server-unreachable', 'Nextcloud returned a server URL that is not reachable from this PWA origin.')
			}
			return {
				key: 'primary',
				serverUrl: server,
				apiBaseUrl: taskbookApiBaseUrl(server),
				loginName: result.loginName,
				appPassword: result.appPassword,
				locale: previous?.locale ?? navigator.language,
				timezone: previous?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
				installationId: previous?.installationId ?? randomUuid(),
				lastSyncCursor: previous?.lastSyncCursor ?? null,
				lastSuccessfulSyncAt: previous?.lastSuccessfulSyncAt ?? null,
				defaultContextId: previous?.defaultContextId ?? 0,
				authState: 'connected',
			}
		}
		if (response.status !== 404) {
			report(options, 'auth.poll.unexpected-response', { status: response.status })
			throw new LoginFlowError('rejected', `Nextcloud rejected the login flow with HTTP ${response.status}.`)
		}
		report(options, 'auth.poll.pending', { status: response.status })
		await (options.wait ?? wait)(options.pollIntervalMs ?? 1_000, options.signal)
	}
	report(options, 'auth.poll.timeout')
	throw new LoginFlowError('expired', 'The Nextcloud login flow timed out.')
}
