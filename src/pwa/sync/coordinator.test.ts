import type { OutboxMutation } from '../types.ts'

import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/transport.ts'
import { connectionStateForError, nextMutationBatch, shouldExpireAccount, SyncCoordinator, syncFailureMessage } from './coordinator.ts'

describe('PWA connection failure classification', () => {
	it('distinguishes authentication, network, and server failures', () => {
		expect(connectionStateForError(new ApiError('authentication', 401, 'expired'))).toBe('expired')
		expect(connectionStateForError(new ApiError('unreachable', null, 'offline'))).toBe('offline')
		expect(connectionStateForError(new ApiError('server', 500, 'failed'))).toBe('server-error')
		expect(connectionStateForError(new Error('unexpected'))).toBe('server-error')
	})

	it('clears stale connection errors as soon as authentication succeeds', () => {
		const coordinator = new SyncCoordinator()
		let connection = 'unknown'
		coordinator.onChange((state) => { connection = state.connection })
		coordinator.authenticationSucceeded()
		expect(connection).toBe('connected')
	})

	it('retains freshly persisted credentials when the initial sync returns 401', () => {
		const error = new ApiError('authentication', 401, 'unauthorized')
		expect(shouldExpireAccount(error, null)).toBe(false)
		expect(syncFailureMessage(error, true)).toBe('Connected, but the initial synchronization failed (HTTP 401)')
		expect(shouldExpireAccount(error, '2026-09-01T09:00:00Z')).toBe(true)
	})
})

describe('PWA sync batching', () => {
	const mutation = (operationId: string, clientUid: string, state: OutboxMutation['state'] = 'pending'): OutboxMutation => ({ operationId, clientUid, type: 'update', baseRevision: 1, entry: null, state, createdAt: operationId, attemptedAt: null })

	it('sends at most one ordered mutation per Entry so revisions can be rebased between rounds', () => {
		expect(nextMutationBatch([mutation('1', 'a'), mutation('2', 'a'), mutation('3', 'b')]).map((item) => item.operationId)).toEqual(['1', '3'])
	})

	it('does not retry unresolved conflicts automatically', () => {
		expect(nextMutationBatch([mutation('1', 'a', 'conflict'), mutation('2', 'b')]).map((item) => item.operationId)).toEqual(['2'])
	})
})
