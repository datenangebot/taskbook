import type { SyncEntry } from '../shared/entryDomain.ts'
import type { Context, EntryRequest } from '../shared/types.ts'

export type { SyncEntry }

export interface AccountConfiguration {
	key: 'primary'
	serverUrl: string
	apiBaseUrl: string
	loginName: string
	appPassword: string
	locale: string
	timezone: string
	installationId: string
	lastSyncCursor: number | null
	lastSuccessfulSyncAt: string | null
	defaultContextId: number
	authState: 'connected' | 'expired'
}

export type MutationType = 'create' | 'update' | 'delete'
export type OutboxState = 'pending' | 'sending' | 'conflict' | 'failed-retryable'

export interface OutboxMutation {
	operationId: string
	clientUid: string
	type: MutationType
	baseRevision: number
	entry: EntryRequest | null
	state: OutboxState
	createdAt: string
	attemptedAt: string | null
}

export interface SyncConflict {
	clientUid: string
	operationId: string
	baseRevision: number
	serverRevision: number
	reason: string
	mutationType: MutationType
	localEntry: EntryRequest | null
	serverEntry: SyncEntry | null
}

export interface SyncResponse {
	canonicalChanges: SyncEntry[]
	deletions: Array<{ clientUid: string, revision: number }>
	contexts: Context[]
	defaultContextId: number
	acknowledgedOperationIds: string[]
	conflicts: SyncConflict[]
	nextCursor: number
	hasMore: boolean
	serverTime: string
	timezone: string
	locale: string
}

export interface PwaBootstrap {
	appPasswordRevokePath: string
	loginFlowPath: string
	iconUrl: string
	manifestUrl: string
	serviceWorkerUrl: string
}
