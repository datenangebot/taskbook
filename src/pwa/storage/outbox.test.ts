import type { EntryRequest } from '../../shared/types.ts'
import type { OutboxMutation } from '../types.ts'

import { describe, expect, it } from 'vitest'
import { compactOutbox } from './outbox.ts'

const entry: EntryRequest = { text: 'First', type: 'task', important: false, contextId: 1, referenceType: 'day', targetDate: '2026-09-01', status: 'open' }

function mutation(operationId: string, type: OutboxMutation['type'], patch: Partial<OutboxMutation> = {}): OutboxMutation {
	return { operationId, clientUid: '00000000-0000-4000-8000-000000000001', type, baseRevision: type === 'create' ? 0 : 4, entry: type === 'delete' ? null : entry, state: 'pending', createdAt: `2026-09-01T00:00:0${operationId}Z`, attemptedAt: null, ...patch }
}

describe('PWA outbox compaction', () => {
	it('folds edits into an unsent create without changing its idempotency key', () => {
		const result = compactOutbox([mutation('1', 'create')], mutation('2', 'update', { entry: { ...entry, text: 'Final' } }))
		expect(result).toMatchObject({ action: 'enqueue', mutation: { operationId: '1', type: 'create', entry: { text: 'Final' } } })
	})

	it('folds consecutive unsent updates and preserves the first operation id', () => {
		const result = compactOutbox([mutation('1', 'update')], mutation('2', 'update', { entry: { ...entry, important: true } }))
		expect(result).toMatchObject({ action: 'enqueue', mutation: { operationId: '1', type: 'update', entry: { important: true } } })
	})

	it('never loses a delete', () => {
		expect(compactOutbox([mutation('1', 'update')], mutation('2', 'delete'))).toMatchObject({ action: 'enqueue', mutation: { operationId: '1', type: 'delete', entry: null } })
		expect(compactOutbox([mutation('1', 'create')], mutation('2', 'delete'))).toEqual({ action: 'discard-local-create', removeOperationIds: ['1'] })
	})

	it('does not coalesce an operation that may already have reached the server', () => {
		const result = compactOutbox([mutation('1', 'update', { state: 'sending', attemptedAt: '2026-09-01T00:00:00Z' })], mutation('2', 'update'))
		expect(result).toMatchObject({ action: 'enqueue', mutation: { operationId: '2' } })
	})
})
