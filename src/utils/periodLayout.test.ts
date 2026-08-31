import type { Entry, ReferenceType } from '../types.ts'
import type { EntryOccurrence } from './periodLayout.ts'

import { describe, expect, it } from 'vitest'
import { dayEntryGroups, entryGroupSummary, entryOccurrenceSummary, monthCalendar, monthEntries, weekDayEntries, weekEntryGroups } from './periodLayout.ts'

function entry(id: number, referenceType: ReferenceType, targetDate: string, status: Entry['status'] = 'open'): Entry {
	return {
		id,
		text: `Entry ${id}`,
		type: 'task',
		important: false,
		contextId: 1,
		context: { id: 1, title: 'General', icon: '😀', alias: 'g', createdAt: '', updatedAt: '' },
		referenceType,
		primaryTargetDate: targetDate,
		secondaryTargetDate: null,
		effectiveTargetDate: targetDate,
		status,
		completedAt: status === 'completed' ? '2026-08-30T10:00:00Z' : null,
		createdAt: `2026-08-${String(id).padStart(2, '0')}T09:00:00Z`,
		updatedAt: '',
	}
}

function ids(occurrences: EntryOccurrence[]): number[] {
	return occurrences.map(({ entry: item }) => item.id)
}

describe('dayEntryGroups', () => {
	it('keeps direct entries first and inherited week entries before month entries', () => {
		const groups = dayEntryGroups('2026-08-29', [
			entry(1, 'day', '2026-08-29'),
			entry(2, 'week', '2026-08-24'),
			entry(3, 'month', '2026-08-01'),
		])
		expect(ids(groups.direct)).toEqual([1])
		expect(ids(groups.inherited)).toEqual([2, 3])
	})

	it('renders a migrated task at its original and current targets without duplicating its entry', () => {
		const migrated = { ...entry(4, 'day', '2026-08-24'), type: 'migrated_task' as const, secondaryTargetDate: '2026-08-29', effectiveTargetDate: '2026-08-29' }
		expect(dayEntryGroups('2026-08-24', [migrated]).direct).toEqual([{ entry: migrated, migrationDisplay: 'original' }])
		expect(dayEntryGroups('2026-08-29', [migrated]).direct).toEqual([{ entry: migrated, migrationDisplay: 'current' }])
	})

	it('does not include entries from another day or period', () => {
		const groups = dayEntryGroups('2026-08-29', [entry(1, 'day', '2026-08-30'), entry(2, 'week', '2026-08-31')])
		expect(groups).toEqual({ direct: [], inherited: [] })
	})
})

describe('weekDayEntries', () => {
	it('builds all seven local days without duplicating broader entries', () => {
		const days = weekDayEntries('2026-12-28', [entry(1, 'day', '2027-01-01'), entry(2, 'week', '2026-12-28'), entry(3, 'month', '2027-01-01')])
		expect(days.map(({ date }) => date)).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'])
		expect(ids(days[4].direct)).toEqual([1])
		expect(days.every(({ inherited }) => inherited.length === 0)).toBe(true)
		expect(days.flatMap(({ direct }) => ids(direct))).toEqual([1])
	})
})

describe('weekEntryGroups', () => {
	it('keeps Week entries first and includes each applicable Month entry once', () => {
		const groups = weekEntryGroups('2026-08-31', [
			entry(1, 'day', '2026-09-01'),
			entry(2, 'week', '2026-08-31'),
			entry(3, 'month', '2026-08-01'),
			entry(4, 'month', '2026-09-01'),
		])
		expect(ids(groups.direct)).toEqual([2])
		expect(ids(groups.monthDerived)).toEqual([3, 4])
		expect(groups.monthDerived.map(({ presentation }) => presentation)).toEqual(['month-derived', 'month-derived'])
		expect(groups.monthDerived.map(({ periodLabel }) => periodLabel)).toEqual(['August 2026', 'September 2026'])
	})
})

describe('monthCalendar', () => {
	it('places day entries in day cells, week entries in week cells, and excludes month entries', () => {
		const entries = [entry(1, 'day', '2026-08-29'), entry(2, 'week', '2026-08-24'), entry(3, 'month', '2026-08-01')]
		const rows = monthCalendar('2026-08-01', entries, 1, '2026-08-29')
		const day = rows.flatMap(({ days }) => days).find(({ date }) => date === '2026-08-29')
		const week = rows.find(({ weekStart: start }) => start === '2026-08-24')
		expect(ids(day?.direct ?? [])).toEqual([1])
		expect(ids(day?.inherited ?? [])).toEqual([2, 3])
		expect(day?.isToday).toBe(true)
		expect(ids(week?.entries ?? [])).toEqual([2])
		expect(ids(monthEntries('2026-08-01', entries))).toEqual([3])
	})

	it('creates four, five and six calendar rows and subdues adjacent-month cells', () => {
		expect(monthCalendar('2021-02-01', [], 1).length).toBe(4)
		expect(monthCalendar('2026-08-01', [], 1).length).toBe(6)
		expect(monthCalendar('2026-09-01', [], 1).length).toBe(5)
		const august = monthCalendar('2026-08-01', [], 1)
		expect(august[0].days[0]).toMatchObject({ date: '2026-07-27', inMonth: false, direct: [], inherited: [] })
		expect(august.at(-1)?.days.at(-1)).toMatchObject({ date: '2026-09-06', inMonth: false, direct: [], inherited: [] })
	})

	it('honors a locale Sunday week start while retaining ISO week cells', () => {
		const rows = monthCalendar('2027-01-01', [entry(1, 'week', '2026-12-28')], 0)
		expect(rows[0].days[0].date).toBe('2026-12-27')
		expect(rows[0]).toMatchObject({ weekStart: '2026-12-28', weekNumber: '53', weekYear: '2026' })
		expect(ids(rows[0].entries)).toEqual([1])
	})
})

describe('entryGroupSummary', () => {
	it('counts the same direct and inherited occurrences shown by Daily semantics', () => {
		const migratedOriginal = { ...entry(5, 'day', '2026-08-29'), type: 'migrated_task' as const, secondaryTargetDate: '2026-08-30', effectiveTargetDate: '2026-08-30' }
		const migratedCurrent = { ...entry(6, 'day', '2026-08-28', 'completed'), type: 'migrated_task' as const, secondaryTargetDate: '2026-08-29', effectiveTargetDate: '2026-08-29' }
		const groups = dayEntryGroups('2026-08-29', [
			entry(1, 'day', '2026-08-29'),
			entry(2, 'day', '2026-08-29', 'completed'),
			entry(3, 'week', '2026-08-24'),
			entry(4, 'month', '2026-08-01', 'completed'),
			migratedOriginal,
			migratedCurrent,
		])
		expect(entryGroupSummary(groups)).toEqual({ open: 3, closed: 3 })
		expect(groups.direct.find(({ entry: item }) => item.id === 5)?.migrationDisplay).toBe('original')
		expect(groups.direct.find(({ entry: item }) => item.id === 6)?.migrationDisplay).toBe('current')
	})

	it('summarizes open-only, closed-only and empty occurrence sets', () => {
		expect(entryOccurrenceSummary([])).toEqual({ open: 0, closed: 0 })
		expect(entryOccurrenceSummary([{ entry: entry(1, 'week', '2026-08-24') }])).toEqual({ open: 1, closed: 0 })
		expect(entryOccurrenceSummary([{ entry: entry(2, 'week', '2026-08-24', 'completed') }])).toEqual({ open: 0, closed: 1 })
	})
})
