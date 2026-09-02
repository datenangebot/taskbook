import type { Context, EntryRequest } from './types.ts'

import { describe, expect, it } from 'vitest'
import { applyEntryRequest, createLocalEntry, syncPayload } from './entryDomain.ts'

const context: Context = { id: 1, title: 'General', icon: '🗂️', alias: 'g', revision: 1, createdAt: '', updatedAt: '' }
const request: EntryRequest = { text: 'Plan', type: 'task', important: false, contextId: 1, referenceType: 'day', targetDate: '2026-09-01', status: 'open' }

describe('shared offline Entry domain', () => {
	it('creates a stable local canonical entry without a server id', () => {
		const entry = createLocalEntry('00000000-0000-4000-8000-000000000001', request, [context], '2026-09-01T08:00:00Z')
		expect(entry).toMatchObject({ clientUid: '00000000-0000-4000-8000-000000000001', revision: 0, text: 'Plan', context })
		expect(entry.id).toBeLessThan(0)
	})

	it('preserves the original occurrence when a task is migrated offline', () => {
		const entry = createLocalEntry('00000000-0000-4000-8000-000000000001', request, [context], '2026-09-01T08:00:00Z')
		const moved = applyEntryRequest(entry, { ...request, targetDate: '2026-09-03' }, [context], '2026-09-02T08:00:00Z')
		expect(moved).toMatchObject({ type: 'migrated_task', primaryTargetDate: '2026-09-01', secondaryTargetDate: '2026-09-03', effectiveTargetDate: '2026-09-03' })
	})

	it('serializes only mutable API fields', () => {
		const entry = createLocalEntry('00000000-0000-4000-8000-000000000001', request, [context], '2026-09-01T08:00:00Z')
		expect(syncPayload(entry)).toEqual(request)
	})
})
