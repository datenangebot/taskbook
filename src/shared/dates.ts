import type { ReferenceType } from './types.ts'

function partsFor(date: Date, timeZone?: string): { year: number, month: number, day: number } {
	if (timeZone !== undefined && timeZone !== '') {
		const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
		const value = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((part) => part.type === type)?.value ?? 0)
		return { year: value('year'), month: value('month'), day: value('day') }
	}
	return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
}

export function dateKey(date = new Date(), timeZone?: string): string {
	const { year, month, day } = partsFor(date, timeZone)
	return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseDateParts(value: string): { year: number, month: number, day: number } | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
	if (match === null) {
		return null
	}
	const year = Number(match[1])
	const month = Number(match[2])
	const day = Number(match[3])
	const check = new Date(Date.UTC(year, month - 1, day))
	return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day ? { year, month, day } : null
}

export function parseLocalDate(value: string): Date {
	const parts = parseDateParts(value)
	return parts === null ? new Date() : new Date(parts.year, parts.month - 1, parts.day)
}

function calendarDate(value: string): Date {
	const parts = parseDateParts(value)
	if (parts === null) {
		throw new TypeError('Expected a valid YYYY-MM-DD calendar date.')
	}
	return new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
}

function utcDateKey(date: Date): string {
	return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function addDays(value: string, amount: number): string {
	const date = calendarDate(value)
	date.setUTCDate(date.getUTCDate() + amount)
	return utcDateKey(date)
}

export function addMonths(value: string, amount: number): string {
	const parts = parseDateParts(value)
	if (parts === null) {
		throw new TypeError('Expected a valid YYYY-MM-DD calendar date.')
	}
	const target = new Date(Date.UTC(parts.year, parts.month - 1 + amount, 1))
	const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
	target.setUTCDate(Math.min(parts.day, lastDay))
	return utcDateKey(target)
}

export function weekStart(value: string): string {
	const date = calendarDate(value)
	const offset = (date.getUTCDay() + 6) % 7
	date.setUTCDate(date.getUTCDate() - offset)
	return utcDateKey(date)
}

export function monthStart(value: string): string {
	const parts = parseDateParts(value)
	if (parts === null) {
		throw new TypeError('Expected a valid YYYY-MM-DD calendar date.')
	}
	return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-01`
}

export function dateForReference(referenceType: ReferenceType, value: string): string | null {
	if (referenceType === 'none') {
		return null
	}
	return referenceType === 'week' ? weekStart(value) : referenceType === 'month' ? monthStart(value) : value
}

export function isoWeekKey(value: string): string {
	const date = calendarDate(value)
	const thursday = new Date(date)
	thursday.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7))
	const year = thursday.getUTCFullYear()
	const firstThursday = calendarDate(`${year}-01-04`)
	firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7))
	const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / 604800000)
	return `${year}-W${String(week).padStart(2, '0')}`
}

export function weekFromKey(value: string): string {
	const match = /^(\d{4})-W(\d{2})$/.exec(value)
	if (match === null) {
		throw new TypeError('Expected a valid ISO week key.')
	}
	return addDays(weekStart(`${match[1]}-01-04`), (Number(match[2]) - 1) * 7)
}

export function isoWeekParts(value: string): { year: string, week: string } {
	const match = /^(\d{4})-W(\d{2})$/.exec(isoWeekKey(value))
	return match === null ? { year: '', week: '' } : { year: match[1], week: match[2] }
}

function localeDate(value: string): Date {
	const parts = parseDateParts(value)
	return parts === null ? new Date() : new Date(parts.year, parts.month - 1, parts.day, 12)
}

export function displayDate(value: string, locale?: string): string {
	return new Intl.DateTimeFormat(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(localeDate(value))
}

export function displayShortDate(value: string, locale?: string): string {
	return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(localeDate(value))
}

export function displayMonth(value: string, locale?: string): string {
	return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(localeDate(value))
}

export function displayWeek(value: string, locale?: string): string {
	const format = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', year: 'numeric' })
	return `${format.format(localeDate(value))} – ${format.format(localeDate(addDays(value, 6)))}`
}

export function displayReferenceTarget(
	referenceType: ReferenceType,
	targetDate: string | null,
	translations: { later: string, week: (week: string, year: string) => string },
	locale?: string,
): string {
	if (referenceType === 'none' || targetDate === null) {
		return translations.later
	}
	if (referenceType === 'day') {
		return new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(localeDate(targetDate))
	}
	if (referenceType === 'month') {
		return targetDate.slice(0, 7)
	}
	const { year, week } = isoWeekParts(targetDate)
	return week === '' ? targetDate : translations.week(week, year)
}
