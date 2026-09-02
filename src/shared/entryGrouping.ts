import type { Entry } from './types.ts'

import { monthStart, weekStart } from './dates.ts'

export interface EntryOccurrence {
	entry: Entry
	migrationDisplay?: 'original' | 'current'
	presentation?: 'day-direct' | 'week-direct' | 'month-derived' | 'migration-original' | 'migration-target'
	periodLabel?: string
}

export interface DayEntryGroups {
	direct: EntryOccurrence[]
	inherited: EntryOccurrence[]
}

export function entriesFor(entries: Entry[], referenceType: Entry['referenceType'], targetDate: string): EntryOccurrence[] {
	return entries.flatMap((entry): EntryOccurrence[] => {
		if (entry.referenceType !== referenceType) { return [] }
		if (entry.type === 'migrated_task' && entry.primaryTargetDate !== null && entry.secondaryTargetDate !== null) {
			const occurrences: EntryOccurrence[] = []
			if (entry.primaryTargetDate === targetDate) { occurrences.push({ entry, migrationDisplay: 'original' }) }
			if (entry.secondaryTargetDate === targetDate) { occurrences.push({ entry, migrationDisplay: 'current' }) }
			return occurrences
		}
		return entry.effectiveTargetDate === targetDate ? [{ entry }] : []
	})
}

export function sortOccurrences(occurrences: EntryOccurrence[]): EntryOccurrence[] {
	return [...occurrences].sort((left, right) => {
		const status = Number(left.entry.status === 'completed') - Number(right.entry.status === 'completed')
		if (status !== 0) { return status }
		const created = left.entry.createdAt.localeCompare(right.entry.createdAt)
		return created !== 0 ? created : left.entry.id - right.entry.id
	})
}

export function dayEntryGroups(date: string, entries: Entry[]): DayEntryGroups {
	return {
		direct: sortOccurrences(entriesFor(entries, 'day', date)),
		inherited: sortOccurrences([
			...entriesFor(entries, 'week', weekStart(date)),
			...entriesFor(entries, 'month', monthStart(date)),
		]),
	}
}
