import type { EntryRequest } from '../../shared/types.ts'
import type { MutationType, OutboxMutation } from '../types.ts'

import { randomUuid } from '../identity.ts'

export type CompactionResult
	= { action: 'enqueue', mutation: OutboxMutation, removeOperationIds: string[] }
		| { action: 'discard-local-create', removeOperationIds: string[] }

export function compactOutbox(existing: OutboxMutation[], next: OutboxMutation): CompactionResult {
	const candidate = [...existing].reverse().find((item) => item.clientUid === next.clientUid && item.state === 'pending' && item.attemptedAt === null)
	if (candidate === undefined) {
		return { action: 'enqueue', mutation: next, removeOperationIds: [] }
	}
	if (candidate.type === 'create' && next.type === 'delete') {
		return { action: 'discard-local-create', removeOperationIds: [candidate.operationId] }
	}
	if (candidate.type === 'create' && next.type === 'update') {
		return { action: 'enqueue', mutation: { ...candidate, entry: next.entry }, removeOperationIds: [] }
	}
	if (candidate.type === 'update' && next.type === 'update') {
		return { action: 'enqueue', mutation: { ...candidate, entry: next.entry }, removeOperationIds: [] }
	}
	if (candidate.type === 'update' && next.type === 'delete') {
		return { action: 'enqueue', mutation: { ...candidate, type: 'delete', entry: null }, removeOperationIds: [] }
	}
	return { action: 'enqueue', mutation: next, removeOperationIds: [] }
}

export function newMutation(type: MutationType, clientUid: string, baseRevision: number, entry: EntryRequest | null, now = new Date().toISOString()): OutboxMutation {
	return {
		operationId: randomUuid(),
		clientUid,
		type,
		baseRevision,
		entry,
		state: 'pending',
		createdAt: now,
		attemptedAt: null,
	}
}
