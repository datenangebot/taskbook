import type { DayEntryGroups, EntryOccurrence } from '../shared/entryGrouping.ts'
import type { Entry } from '../types.ts'

import { dayEntryGroups, entriesFor, sortOccurrences } from '../shared/entryGrouping.ts'
import { addDays, addMonths, displayMonth, isoWeekParts, localDateKey, monthStart, parseLocalDate, weekStart } from './dates.ts'

export type { DayEntryGroups, EntryOccurrence } from '../shared/entryGrouping.ts'
export { dayEntryGroups, entriesFor } from '../shared/entryGrouping.ts'

export interface WeekEntryGroups {
	direct: EntryOccurrence[]
	monthDerived: EntryOccurrence[]
}

export interface WeekDayEntries extends DayEntryGroups {
	date: string
}

export interface CalendarDay extends DayEntryGroups {
	date: string
	dayNumber: number
	inMonth: boolean
	isToday: boolean
}

export interface CalendarWeek {
	days: CalendarDay[]
	weekStart: string
	weekNumber: string
	weekYear: string
	entries: EntryOccurrence[]
}

export interface EntryGroupSummary {
	open: number
	closed: number
}

export function entryGroupSummary(groups: DayEntryGroups): EntryGroupSummary {
	return entryOccurrenceSummary([...groups.direct, ...groups.inherited])
}

export function entryOccurrenceSummary(occurrences: EntryOccurrence[]): EntryGroupSummary {
	return occurrences.reduce((summary, { entry }) => {
		summary[entry.status === 'open' ? 'open' : 'closed']++
		return summary
	}, { open: 0, closed: 0 })
}

export function weekDayEntries(start: string, entries: Entry[]): WeekDayEntries[] {
	return Array.from({ length: 7 }, (_, offset) => {
		const date = addDays(start, offset)
		return {
			date,
			direct: sortOccurrences(entriesFor(entries, 'day', date)).map((occurrence) => ({
				...occurrence,
				presentation: occurrence.migrationDisplay === 'original' ? 'migration-original' : occurrence.migrationDisplay === 'current' ? 'migration-target' : 'day-direct',
			})),
			inherited: [],
		}
	})
}

export function weekEntryGroups(start: string, entries: Entry[]): WeekEntryGroups {
	const direct = sortOccurrences(entriesFor(entries, 'week', start)).map((occurrence): EntryOccurrence => ({
		...occurrence,
		presentation: occurrence.migrationDisplay === 'original' ? 'migration-original' : occurrence.migrationDisplay === 'current' ? 'migration-target' : 'week-direct',
	}))
	const months = [...new Set([monthStart(start), monthStart(addDays(start, 6))])]
	const monthDerived = months.flatMap((month) => sortOccurrences(entriesFor(entries, 'month', month)).map((occurrence): EntryOccurrence => ({
		...occurrence,
		presentation: 'month-derived',
		periodLabel: displayMonth(month),
	})))
	return { direct, monthDerived }
}

/**
 * Build locale-ordered calendar rows while keeping Taskbook's ISO week entries in one row-level cell.
 *
 * @param month Selected month anchor.
 * @param entries Canonical entries returned by the Month read model.
 * @param firstDay Locale first weekday, where Sunday is zero.
 * @param today Current user-local day.
 */
export function monthCalendar(month: string, entries: Entry[], firstDay: number, today = localDateKey()): CalendarWeek[] {
	const first = monthStart(month)
	const firstDate = parseLocalDate(first)
	const leadingDays = (firstDate.getDay() - firstDay + 7) % 7
	const gridStart = addDays(first, -leadingDays)
	const nextMonth = addMonths(first, 1)
	const last = addDays(nextMonth, -1)
	const trailingDays = (firstDay + 6 - parseLocalDate(last).getDay() + 7) % 7
	const gridEnd = addDays(last, trailingDays)
	const rows: CalendarWeek[] = []

	for (let rowStart = gridStart; rowStart <= gridEnd; rowStart = addDays(rowStart, 7)) {
		const representativeDate = addDays(rowStart, 3)
		const rowWeekStart = weekStart(representativeDate)
		const { week, year } = isoWeekParts(rowWeekStart)
		rows.push({
			days: Array.from({ length: 7 }, (_, offset) => {
				const date = addDays(rowStart, offset)
				const inMonth = monthStart(date) === first
				return {
					date,
					dayNumber: parseLocalDate(date).getDate(),
					inMonth,
					isToday: date === today,
					...(inMonth ? dayEntryGroups(date, entries) : { direct: [], inherited: [] }),
				}
			}),
			weekStart: rowWeekStart,
			weekNumber: week,
			weekYear: year,
			entries: entriesFor(entries, 'week', rowWeekStart),
		})
	}
	return rows
}

export function monthEntries(month: string, entries: Entry[]): EntryOccurrence[] {
	return entriesFor(entries, 'month', monthStart(month))
}
