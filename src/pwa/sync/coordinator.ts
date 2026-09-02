import type { OutboxMutation } from '../types.ts'

import { ApiError, health, synchronize } from '../api/transport.ts'
import { diagnostics } from '../diagnostics.ts'
import { applySyncResult, getAccount, listOutbox, markOutbox, putAccount } from '../storage/database.ts'
import { announceRepositoryChange } from '../storage/repository.ts'

export type ConnectionState = 'unknown' | 'connected' | 'offline' | 'expired' | 'server-error'
export type SyncState = 'idle' | 'syncing' | 'synchronized' | 'failed'

export interface CoordinatorState {
	connection: ConnectionState
	sync: SyncState
	message: string
	pending: number
}

type Listener = (state: CoordinatorState) => void

export function connectionStateForError(error: unknown): ConnectionState {
	if (!(error instanceof ApiError)) { return 'server-error' }
	if (error.kind === 'authentication') { return 'expired' }
	return error.kind === 'unreachable' ? 'offline' : 'server-error'
}

export function shouldExpireAccount(error: unknown, lastSuccessfulSyncAt: string | null): boolean {
	return lastSuccessfulSyncAt !== null && error instanceof ApiError && error.kind === 'authentication'
}

export function syncFailureMessage(error: unknown, initial: boolean): string {
	if (!initial) { return 'Sync failed — changes remain on this device' }
	const status = error instanceof ApiError && error.status !== null ? ` (HTTP ${error.status})` : ''
	return `Connected, but the initial synchronization failed${status}`
}

export function nextMutationBatch(outbox: OutboxMutation[]): OutboxMutation[] {
	const clientUids = new Set<string>()
	return outbox.filter((mutation) => {
		if (mutation.state === 'conflict' || clientUids.has(mutation.clientUid)) {
			return false
		}
		clientUids.add(mutation.clientUid)
		return true
	}).slice(0, 100)
}

export class SyncCoordinator {
	private readonly listeners = new Set<Listener>()
	private state: CoordinatorState = { connection: 'unknown', sync: 'idle', message: '', pending: 0 }
	private active: Promise<void> | null = null
	private retryTimer: number | null = null
	private failures = 0
	private mutationTimer: number | null = null
	private lastNetworkState: ConnectionState | null = null

	public onChange(listener: Listener): () => void {
		this.listeners.add(listener)
		listener(this.state)
		return () => this.listeners.delete(listener)
	}

	public async refreshPending(): Promise<void> {
		this.update({ pending: (await listOutbox()).length })
	}

	public authenticationSucceeded(): void {
		this.update({ connection: 'connected', sync: 'idle', message: '' })
	}

	public mutationQueued(): void {
		void this.refreshPending()
		if (this.mutationTimer !== null) {
			window.clearTimeout(this.mutationTimer)
		}
		this.mutationTimer = window.setTimeout(() => void this.syncNow(), 700)
		void this.registerBackgroundSync()
	}

	public syncNow(): Promise<void> {
		this.active ??= this.run().finally(() => { this.active = null })
		return this.active
	}

	public async checkReachability(): Promise<void> {
		const account = await getAccount()
		if (account === null || account.authState === 'expired') {
			this.update({ connection: account === null ? 'unknown' : 'expired' })
			return
		}
		try {
			await health(account)
			this.update({ connection: 'connected' })
			this.reportNetworkState('connected')
		} catch (error) {
			this.classify(error)
		}
	}

	private async run(): Promise<void> {
		let account = await getAccount()
		if (account === null || account.authState === 'expired') {
			return
		}
		const pending = nextMutationBatch(await listOutbox())
		const operationIds = pending.map((item) => item.operationId)
		const initialSync = account.lastSuccessfulSyncAt === null
		this.update({ sync: 'syncing', message: 'Synchronizing…', pending: (await listOutbox()).length })
		void diagnostics.log('info', 'sync', 'sync.start', { initial: initialSync, pendingOperations: pending.length })
		void diagnostics.log('info', 'sync', initialSync ? 'sync.initial.start' : pending.length > 0 ? 'sync.push.start' : 'sync.pull.start', { pendingOperations: pending.length })
		await markOutbox(operationIds, 'sending', new Date().toISOString())
		try {
			let response = await synchronize(account, pending)
			await applySyncResult(response, account)
			this.logSyncResponse(initialSync, response)
			account = { ...account, lastSyncCursor: response.nextCursor, lastSuccessfulSyncAt: response.serverTime, timezone: response.timezone, locale: response.locale, defaultContextId: response.defaultContextId }
			while (response.hasMore) {
				void diagnostics.log('info', 'sync', 'sync.pull.start', { pendingOperations: 0 })
				response = await synchronize(account, [])
				await applySyncResult(response, account)
				this.logSyncResponse(false, response)
				account = { ...account, lastSyncCursor: response.nextCursor, lastSuccessfulSyncAt: response.serverTime, timezone: response.timezone, locale: response.locale, defaultContextId: response.defaultContextId }
			}
			this.failures = 0
			if (this.retryTimer !== null) {
				window.clearTimeout(this.retryTimer)
				this.retryTimer = null
			}
			const remainingOutbox = await listOutbox()
			this.update({ connection: 'connected', sync: 'synchronized', message: 'Synchronized', pending: remainingOutbox.length })
			this.reportNetworkState('connected')
			void diagnostics.log('info', 'sync', initialSync ? 'sync.initial.success' : 'sync.success', { pendingOperations: remainingOutbox.length })
			announceRepositoryChange()
			if (nextMutationBatch(remainingOutbox).length > 0) {
				window.setTimeout(() => void this.syncNow(), 0)
			}
		} catch (error) {
			await markOutbox(operationIds, error instanceof ApiError && error.kind === 'authentication' ? 'pending' : 'failed-retryable', new Date().toISOString())
			void diagnostics.log('error', 'sync', initialSync ? 'sync.initial.failed' : 'sync.failed', { category: error instanceof ApiError ? error.kind : 'unknown', status: error instanceof ApiError ? error.status : null })
			if (shouldExpireAccount(error, account.lastSuccessfulSyncAt)) {
				await putAccount({ ...account, authState: 'expired' })
				this.update({ connection: 'expired', sync: 'failed', message: 'Connection expired', pending: (await listOutbox()).length })
				return
			}
			if (initialSync && error instanceof ApiError && error.kind === 'authentication') {
				this.update({ connection: 'connected' })
				void diagnostics.log('warning', 'network', 'network.authentication-failed', { status: error.status })
			} else {
				this.classify(error)
			}
			this.update({ sync: 'failed', message: syncFailureMessage(error, initialSync), pending: (await listOutbox()).length })
			if (!(initialSync && error instanceof ApiError && error.kind === 'authentication')) { this.scheduleRetry() }
		}
	}

	private classify(error: unknown): void {
		const connection = connectionStateForError(error)
		this.update({ connection })
		this.reportNetworkState(connection, error)
	}

	private scheduleRetry(): void {
		if (this.retryTimer !== null) {
			return
		}
		this.failures++
		const ceiling = Math.min(60_000, 1_000 * (2 ** Math.min(this.failures, 6)))
		const delay = Math.round(ceiling * (0.5 + Math.random() * 0.5))
		this.retryTimer = window.setTimeout(() => {
			this.retryTimer = null
			void this.syncNow()
		}, delay)
		void diagnostics.log('info', 'sync', 'sync.retry', { delayMs: delay, failures: this.failures })
	}

	private logSyncResponse(initial: boolean, response: { canonicalChanges: unknown[], deletions: unknown[], conflicts: unknown[] }): void {
		const metadata = { receivedChanges: response.canonicalChanges.length + response.deletions.length, conflicts: response.conflicts.length }
		void diagnostics.log('info', 'sync', 'sync.pull.success', metadata)
		if (response.conflicts.length > 0) {
			void diagnostics.log('warning', 'sync', 'sync.conflict', { conflicts: response.conflicts.length })
		}
		if (initial) {
			void diagnostics.log('info', 'sync', 'sync.initial.response', metadata)
		}
	}

	private reportNetworkState(connection: ConnectionState, error?: unknown): void {
		if (this.lastNetworkState === connection) {
			return
		}
		this.lastNetworkState = connection
		if (connection === 'connected') {
			void diagnostics.log('info', 'network', 'network.server-connected')
			return
		}
		if (connection === 'offline') {
			void diagnostics.log('warning', 'network', 'network.server-unreachable', { status: error instanceof ApiError ? error.status : null })
			return
		}
		if (connection === 'expired') {
			void diagnostics.log('warning', 'network', 'network.authentication-failed', { status: error instanceof ApiError ? error.status : null })
		}
	}

	private update(patch: Partial<CoordinatorState>): void {
		this.state = { ...this.state, ...patch }
		for (const listener of this.listeners) {
			listener(this.state)
		}
	}

	private async registerBackgroundSync(): Promise<void> {
		if (!('serviceWorker' in navigator)) {
			return
		}
		const registration = await navigator.serviceWorker.ready
		const sync = (registration as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync
		await sync?.register('taskbook-sync').catch(() => undefined)
	}
}
