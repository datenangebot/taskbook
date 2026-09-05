import type { Context, EntryRequest } from './types.ts'

import { describe, expect, it } from 'vitest'
import { applyEntryRequest, createLocalEntry, isOverdueEntry, overdueEntries, syncPayload } from './entryDomain.ts'

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

	it('matches the canonical overdue rule for day, week, month, migration, type, and status', () => {
		const base = createLocalEntry('00000000-0000-4000-8000-000000000001', request, [context], '2026-09-01T08:00:00Z')
		const entry = (overrides: Partial<typeof base>) => ({ ...base, ...overrides })
		expect(isOverdueEntry(entry({ effectiveTargetDate: '2026-09-01' }), '2026-09-02')).toBe(true)
		expect(isOverdueEntry(entry({ referenceType: 'week', effectiveTargetDate: '2026-08-24' }), '2026-09-02')).toBe(true)
		expect(isOverdueEntry(entry({ referenceType: 'week', effectiveTargetDate: '2026-08-31' }), '2026-09-02')).toBe(false)
		expect(isOverdueEntry(entry({ referenceType: 'month', effectiveTargetDate: '2026-08-01' }), '2026-09-02')).toBe(true)
		expect(isOverdueEntry(entry({ type: 'migrated_task', primaryTargetDate: '2026-08-01', secondaryTargetDate: '2026-09-03', effectiveTargetDate: '2026-09-03' }), '2026-09-02')).toBe(false)
		for (const type of ['appointment', 'note', 'irrelevant_task'] as const) {
			expect(isOverdueEntry(entry({ type, effectiveTargetDate: '2026-08-01' }), '2026-09-02')).toBe(false)
		}
		expect(isOverdueEntry(entry({ status: 'completed', effectiveTargetDate: '2026-08-01' }), '2026-09-02')).toBe(false)
		expect(isOverdueEntry(entry({ referenceType: 'none', effectiveTargetDate: null }), '2026-09-02')).toBe(false)
	})

	it('derives the overdue count and sorted list from the same canonical entries', () => {
		const first = createLocalEntry('00000000-0000-4000-8000-000000000001', { ...request, targetDate: '2026-08-30' }, [context], '2026-09-01T09:00:00Z')
		const second = createLocalEntry('00000000-0000-4000-8000-000000000002', { ...request, targetDate: '2026-08-29' }, [context], '2026-09-01T08:00:00Z')
		const current = createLocalEntry('00000000-0000-4000-8000-000000000003', request, [context], '2026-09-01T07:00:00Z')
		const overdue = overdueEntries([first, current, second], '2026-09-01')
		expect(overdue).toHaveLength(2)
		expect(overdue.map((entry) => entry.clientUid)).toEqual([second.clientUid, first.clientUid])
	})

	it('reacts immediately when an overdue entry is completed, reopened, or moved', () => {
		const original = createLocalEntry('00000000-0000-4000-8000-000000000001', { ...request, targetDate: '2026-08-31' }, [context], '2026-08-31T08:00:00Z')
		const completed = applyEntryRequest(original, { ...syncPayload(original), status: 'completed' }, [context], '2026-09-01T08:00:00Z')
		const reopened = applyEntryRequest(completed, { ...syncPayload(completed), status: 'open' }, [context], '2026-09-01T09:00:00Z')
		const moved = applyEntryRequest(reopened, { ...syncPayload(reopened), targetDate: '2026-09-02' }, [context], '2026-09-01T10:00:00Z')
		expect(overdueEntries([original], '2026-09-01')).toHaveLength(1)
		expect(overdueEntries([completed], '2026-09-01')).toHaveLength(0)
		expect(overdueEntries([reopened], '2026-09-01')).toHaveLength(1)
		expect(overdueEntries([moved], '2026-09-01')).toHaveLength(0)
	})
})
