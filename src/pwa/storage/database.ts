import type { Context } from '../../shared/types.ts'
import type { DiagnosticRecord } from '../diagnostics.ts'
import type { AccountConfiguration, OutboxMutation, SyncConflict, SyncEntry, SyncResponse } from '../types.ts'

const DATABASE_NAME = 'taskbook-pwa'
export const DATABASE_VERSION = 3
export const DIAGNOSTIC_LIMIT = 1_500

type DatabaseDiagnosticReporter = (event: string, error: unknown) => void
let databaseDiagnosticReporter: DatabaseDiagnosticReporter = () => undefined

export function setDatabaseDiagnosticReporter(reporter: DatabaseDiagnosticReporter): void {
	databaseDiagnosticReporter = reporter
}

function reportDatabaseFailure(event: string, error: unknown): void {
	databaseDiagnosticReporter(event, error)
}

export function schemaUpgradeSteps(oldVersion: number): number[] {
	return [1, 2, 3].filter((version) => version > oldVersion)
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.addEventListener('success', () => resolve(request.result), { once: true })
		request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB request failed.')), { once: true })
	})
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.addEventListener('complete', () => resolve(), { once: true })
		transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.')), { once: true })
		transaction.addEventListener('error', () => reject(transaction.error ?? new Error('IndexedDB transaction failed.')), { once: true })
	})
}

let databasePromise: Promise<IDBDatabase> | undefined

export function openDatabase(reportFailure = true): Promise<IDBDatabase> {
	databasePromise ??= new Promise((resolve, reject) => {
		const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
		request.addEventListener('upgradeneeded', (event) => {
			try {
				const database = request.result
				const oldVersion = (event as IDBVersionChangeEvent).oldVersion
				if (oldVersion < 1) {
					database.createObjectStore('account', { keyPath: 'key' })
					database.createObjectStore('entries', { keyPath: 'clientUid' }).createIndex('serverId', 'id')
					database.createObjectStore('contexts', { keyPath: 'id' })
					const outbox = database.createObjectStore('outbox', { keyPath: 'operationId' })
					outbox.createIndex('clientUid', 'clientUid')
					outbox.createIndex('createdAt', 'createdAt')
					database.createObjectStore('syncMeta', { keyPath: 'key' })
				}
				if (oldVersion < 2) {
					database.createObjectStore('conflicts', { keyPath: 'clientUid' })
				}
				if (oldVersion < 3) {
					database.createObjectStore('diagnostics', { keyPath: 'id' }).createIndex('timestamp', 'timestamp')
				}
			} catch (error) {
				if (reportFailure) { reportDatabaseFailure('db.migration.failed', error) }
				throw error
			}
		})
		request.addEventListener('success', () => {
			request.result.addEventListener('versionchange', () => request.result.close())
			resolve(request.result)
		}, { once: true })
		request.addEventListener('error', () => {
			const error = request.error ?? new Error('Could not open local Taskbook data.')
			if (reportFailure) { reportDatabaseFailure('db.open.failed', error) }
			reject(error)
		}, { once: true })
		request.addEventListener('blocked', () => {
			const error = new Error('A previous Taskbook window is blocking a local data upgrade.')
			if (reportFailure) { reportDatabaseFailure('db.open.failed', error) }
			reject(error)
		}, { once: true })
	})
	const result = databasePromise
	void result.catch(() => {
		if (databasePromise === result) { databasePromise = undefined }
	})
	return result
}

async function databaseOperation<T>(event: string, operation: () => Promise<T>): Promise<T> {
	try {
		return await operation()
	} catch (error) {
		reportDatabaseFailure(event, error)
		throw error
	}
}

export async function getAccount(): Promise<AccountConfiguration | null> {
	return databaseOperation('account.read.failed', async () => {
		const database = await openDatabase()
		const transaction = database.transaction('account', 'readonly')
		const value = await requestResult<AccountConfiguration | undefined>(transaction.objectStore('account').get('primary'))
		return value ?? null
	})
}

export async function putAccount(account: AccountConfiguration): Promise<void> {
	return databaseOperation('account.write.failed', async () => {
		const database = await openDatabase()
		const transaction = database.transaction('account', 'readwrite')
		transaction.objectStore('account').put(account)
		await transactionDone(transaction)
	})
}

export async function listEntries(): Promise<SyncEntry[]> {
	return databaseOperation('entries.read.failed', async () => {
		const database = await openDatabase()
		return requestResult<SyncEntry[]>(database.transaction('entries', 'readonly').objectStore('entries').getAll())
	})
}

export async function listContexts(): Promise<Context[]> {
	const database = await openDatabase()
	return requestResult<Context[]>(database.transaction('contexts', 'readonly').objectStore('contexts').getAll())
}

export async function listOutbox(): Promise<OutboxMutation[]> {
	return databaseOperation('outbox.read.failed', async () => {
		const database = await openDatabase()
		const items = await requestResult<OutboxMutation[]>(database.transaction('outbox', 'readonly').objectStore('outbox').getAll())
		return items.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
	})
}

export async function listConflicts(): Promise<SyncConflict[]> {
	const database = await openDatabase()
	return requestResult<SyncConflict[]>(database.transaction('conflicts', 'readonly').objectStore('conflicts').getAll())
}

export async function writeLocalMutation(entry: SyncEntry | null, mutation: OutboxMutation, removeEntry = false, removeOperationIds: string[] = []): Promise<void> {
	return databaseOperation('entries.write.failed', async () => {
		const database = await openDatabase()
		const transaction = database.transaction(['entries', 'outbox'], 'readwrite')
		const entries = transaction.objectStore('entries')
		const outbox = transaction.objectStore('outbox')
		if (removeEntry) {
			entries.delete(mutation.clientUid)
		} else if (entry !== null) {
			entries.put(entry)
		}
		for (const operationId of removeOperationIds) {
			outbox.delete(operationId)
		}
		outbox.put(mutation)
		await transactionDone(transaction)
	}).catch((error: unknown) => {
		reportDatabaseFailure('outbox.write.failed', error)
		throw error
	})
}

export async function removeLocalCreate(clientUid: string, operationIds: string[]): Promise<void> {
	const database = await openDatabase()
	const transaction = database.transaction(['entries', 'outbox'], 'readwrite')
	transaction.objectStore('entries').delete(clientUid)
	for (const operationId of operationIds) {
		transaction.objectStore('outbox').delete(operationId)
	}
	await transactionDone(transaction)
}

export async function markOutbox(operationIds: string[], state: OutboxMutation['state'], attemptedAt: string | null): Promise<void> {
	return databaseOperation('outbox.write.failed', async () => {
		const database = await openDatabase()
		const transaction = database.transaction('outbox', 'readwrite')
		const store = transaction.objectStore('outbox')
		for (const operationId of operationIds) {
			const item = await requestResult<OutboxMutation | undefined>(store.get(operationId))
			if (item !== undefined) {
				store.put({ ...item, state, attemptedAt })
			}
		}
		await transactionDone(transaction)
	})
}

export async function applySyncResult(response: SyncResponse, account: AccountConfiguration): Promise<void> {
	const database = await openDatabase()
	const transaction = database.transaction(['account', 'entries', 'contexts', 'outbox', 'conflicts'], 'readwrite')
	const entries = transaction.objectStore('entries')
	const outbox = transaction.objectStore('outbox')
	const conflicts = transaction.objectStore('conflicts')
	const conflictedUids = new Set(response.conflicts.map((conflict) => conflict.clientUid))
	const acknowledged = new Set(response.acknowledgedOperationIds)
	const queued = await requestResult<OutboxMutation[]>(outbox.getAll())
	const protectedUids = new Set(queued.filter((mutation) => !acknowledged.has(mutation.operationId)).map((mutation) => mutation.clientUid))
	for (const entry of response.canonicalChanges) {
		const acknowledgedForEntry = queued
			.filter((mutation) => mutation.clientUid === entry.clientUid && acknowledged.has(mutation.operationId))
			.sort((left, right) => left.createdAt.localeCompare(right.createdAt)).at(-1)
		if (acknowledgedForEntry !== undefined) {
			for (const mutation of queued) {
				if (mutation.clientUid === entry.clientUid && !acknowledged.has(mutation.operationId) && mutation.createdAt >= acknowledgedForEntry.createdAt) {
					outbox.put({ ...mutation, baseRevision: entry.revision })
				}
			}
		}
		if (!conflictedUids.has(entry.clientUid) && !protectedUids.has(entry.clientUid)) {
			entries.put(entry)
			conflicts.delete(entry.clientUid)
		}
	}
	for (const deletion of response.deletions) {
		if (!conflictedUids.has(deletion.clientUid) && !protectedUids.has(deletion.clientUid)) {
			entries.delete(deletion.clientUid)
			conflicts.delete(deletion.clientUid)
		}
	}
	for (const operationId of response.acknowledgedOperationIds) {
		outbox.delete(operationId)
	}
	for (const conflict of response.conflicts) {
		conflicts.put(conflict)
		const pending = await requestResult<OutboxMutation | undefined>(outbox.get(conflict.operationId))
		if (pending !== undefined) {
			outbox.put({ ...pending, state: 'conflict' })
		}
	}
	const contexts = transaction.objectStore('contexts')
	contexts.clear()
	for (const context of response.contexts) {
		contexts.put(context)
	}
	transaction.objectStore('account').put({
		...account,
		lastSyncCursor: response.nextCursor,
		lastSuccessfulSyncAt: response.serverTime,
		defaultContextId: response.defaultContextId,
		timezone: response.timezone,
		locale: response.locale,
		authState: 'connected',
	})
	await transactionDone(transaction)
}

export async function clearLocalData(): Promise<void> {
	const database = await openDatabase()
	const names = ['account', 'entries', 'contexts', 'outbox', 'syncMeta', 'conflicts']
	const transaction = database.transaction(names, 'readwrite')
	for (const name of names) {
		transaction.objectStore(name).clear()
	}
	await transactionDone(transaction)
}

export async function appendDiagnosticRecord(record: DiagnosticRecord): Promise<void> {
	const database = await openDatabase(false)
	const transaction = database.transaction('diagnostics', 'readwrite')
	const store = transaction.objectStore('diagnostics')
	const existing = await requestResult<DiagnosticRecord[]>(store.getAll())
	const excess = existing.length - DIAGNOSTIC_LIMIT + 1
	if (excess > 0) {
		for (const item of existing.sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id)).slice(0, excess)) {
			store.delete(item.id)
		}
	}
	store.put(record)
	await transactionDone(transaction)
}

export async function listDiagnosticRecords(): Promise<DiagnosticRecord[]> {
	const database = await openDatabase(false)
	return requestResult<DiagnosticRecord[]>(database.transaction('diagnostics', 'readonly').objectStore('diagnostics').getAll())
}

export async function clearDiagnosticRecords(): Promise<void> {
	const database = await openDatabase(false)
	const transaction = database.transaction('diagnostics', 'readwrite')
	transaction.objectStore('diagnostics').clear()
	await transactionDone(transaction)
}

export async function useServerConflict(conflict: SyncConflict): Promise<void> {
	const database = await openDatabase()
	const transaction = database.transaction(['entries', 'outbox', 'conflicts'], 'readwrite')
	if (conflict.serverEntry === null) {
		transaction.objectStore('entries').delete(conflict.clientUid)
	} else {
		transaction.objectStore('entries').put(conflict.serverEntry)
	}
	transaction.objectStore('outbox').delete(conflict.operationId)
	transaction.objectStore('conflicts').delete(conflict.clientUid)
	await transactionDone(transaction)
}

export async function keepLocalConflict(conflict: SyncConflict, mutation: OutboxMutation): Promise<void> {
	const database = await openDatabase()
	const transaction = database.transaction(['outbox', 'conflicts'], 'readwrite')
	transaction.objectStore('outbox').delete(conflict.operationId)
	transaction.objectStore('outbox').put(mutation)
	transaction.objectStore('conflicts').delete(conflict.clientUid)
	await transactionDone(transaction)
}
