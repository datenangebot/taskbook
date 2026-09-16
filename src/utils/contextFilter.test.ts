import type { Entry } from '../types.ts'

import { describe, expect, it } from 'vitest'
import { filterEntriesByContext } from './contextFilter.ts'

function entry(id: number, contextId: number): Entry {
	return {
		id,
		text: 'Entry',
		type: 'task',
		important: false,
		contextId,
		context: { id: contextId, title: 'Context', icon: '•', alias: null, createdAt: '', updatedAt: '' },
		referenceType: 'day',
		primaryTargetDate: '2026-09-15',
		secondaryTargetDate: null,
		effectiveTargetDate: '2026-09-15',
		status: 'open',
		completedAt: null,
		createdAt: '',
		updatedAt: '',
	}
}

describe('context filtering', () => {
	it('keeps all entries when no context is selected', () => expect(filterEntriesByContext([entry(1, 1), entry(2, 2)], [])).toHaveLength(2))
	it('keeps every entry in a selected context set', () => expect(filterEntriesByContext([entry(1, 1), entry(2, 2), entry(3, 1)], [1])).toMatchObject([{ id: 1 }, { id: 3 }]))
})
