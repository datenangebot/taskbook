import type { Context, EntryRequest } from '../../shared/types.ts'
import type { SyncEntry } from '../types.ts'

import { applyEntryRequest, createLocalEntry, syncPayload } from '../../shared/entryDomain.ts'
import { randomUuid } from '../identity.ts'
import { listEntries, listOutbox, removeLocalCreate, writeLocalMutation } from './database.ts'
import { compactOutbox, newMutation } from './outbox.ts'

export type RepositoryChangeListener = () => void
const listeners = new Set<RepositoryChangeListener>()

export function onRepositoryChange(listener: RepositoryChangeListener): () => void {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

export function announceRepositoryChange(): void {
	for (const listener of listeners) {
		listener()
	}
}

export async function createEntry(request: EntryRequest, contexts: Context[]): Promise<SyncEntry> {
	const now = new Date().toISOString()
	const clientUid = randomUuid()
	const entry = createLocalEntry(clientUid, request, contexts, now)
	const mutation = newMutation('create', clientUid, 0, syncPayload(entry), now)
	await writeLocalMutation(entry, mutation)
	announceRepositoryChange()
	return entry
}

export async function updateEntry(clientUid: string, request: EntryRequest, contexts: Context[]): Promise<SyncEntry> {
	const entry = (await listEntries()).find((candidate) => candidate.clientUid === clientUid)
	if (entry === undefined) {
		throw new TypeError('Entry is no longer available.')
	}
	const next = applyEntryRequest(entry, request, contexts, new Date().toISOString())
	await enqueue(next, newMutation('update', clientUid, entry.revision, { ...request, text: request.text.trim() }))
	return next
}

export async function toggleEntry(clientUid: string, contexts: Context[]): Promise<SyncEntry> {
	const entry = (await listEntries()).find((candidate) => candidate.clientUid === clientUid)
	if (entry === undefined) {
		throw new TypeError('Entry is no longer available.')
	}
	return updateEntry(clientUid, { ...syncPayload(entry), status: entry.status === 'open' ? 'completed' : 'open' }, contexts)
}

export async function deleteEntry(clientUid: string): Promise<void> {
	const entry = (await listEntries()).find((candidate) => candidate.clientUid === clientUid)
	if (entry === undefined) {
		return
	}
	const existing = await listOutbox()
	const result = compactOutbox(existing, newMutation('delete', clientUid, entry.revision, null))
	if (result.action === 'discard-local-create') {
		await removeLocalCreate(clientUid, result.removeOperationIds)
	} else {
		await writeLocalMutation(null, result.mutation, true, result.removeOperationIds)
	}
	announceRepositoryChange()
}

async function enqueue(entry: SyncEntry, mutation: ReturnType<typeof newMutation>): Promise<void> {
	const result = compactOutbox(await listOutbox(), mutation)
	if (result.action === 'discard-local-create') {
		throw new TypeError('Unexpected local create compaction.')
	}
	await writeLocalMutation(entry, result.mutation, false, result.removeOperationIds)
	announceRepositoryChange()
}
