import type { Entry } from '../types.ts'

import { describe, expect, it } from 'vitest'
import { entryRequestFrom, sortEntriesForDisplay } from './entryMutations.ts'

const entry: Entry = {
	id: 7,
	text: 'Canonical entry',
	type: 'migrated_task',
	important: true,
	contextId: 3,
	context: { id: 3, title: 'Work', icon: '💼', alias: 'w', createdAt: '', updatedAt: '' },
	referenceType: 'day',
	primaryTargetDate: '2026-08-29',
	secondaryTargetDate: '2026-08-30',
	effectiveTargetDate: '2026-08-30',
	status: 'open',
	completedAt: null,
	createdAt: '',
	updatedAt: '',
}

describe('entryRequestFrom', () => {
	it('keeps the canonical editable fields while changing completion status', () => {
		expect(entryRequestFrom(entry, 'completed')).toEqual({
			text: 'Canonical entry',
			type: 'migrated_task',
			important: true,
			contextId: 3,
			referenceType: 'day',
			targetDate: '2026-08-30',
			status: 'completed',
		})
	})

	it('keeps open entries before completed entries after a local canonical merge', () => {
		const completed = { ...entry, id: 8, status: 'completed' as const, createdAt: '2026-08-29T08:00:00Z' }
		const newerOpen = { ...entry, id: 9, createdAt: '2026-08-30T10:00:00Z' }
		expect(sortEntriesForDisplay([completed, newerOpen, entry]).map(({ id }) => id)).toEqual([7, 9, 8])
	})
})
