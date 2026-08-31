import type { ReferenceType } from '../types.ts'

export function localDateKey(date = new Date()): string {
	const timeZone = nextcloudTimeZone()
	if (timeZone !== undefined) {
		const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
		const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((item) => item.type === type)?.value ?? ''
		return `${part('year')}-${part('month')}-${part('day')}`
	}
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

function nextcloudTimeZone(): string | undefined {
	if (typeof window === 'undefined') {
		return undefined
	}
	const timezone = (window as Window & { OC?: { getCurrentUser?: () => { timezone?: unknown } } }).OC?.getCurrentUser?.().timezone
	return typeof timezone === 'string' && timezone !== '' ? timezone : undefined
}

export function parseLocalDate(value: string): Date {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
	if (match === null) {
		return new Date()
	}
	return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export function addDays(value: string, amount: number): string {
	const date = parseLocalDate(value)
	date.setDate(date.getDate() + amount)
	return localDateKey(date)
}

export function addMonths(value: string, amount: number): string {
	const date = parseLocalDate(value)
	date.setMonth(date.getMonth() + amount)
	return localDateKey(date)
}

export function weekStart(value: string): string {
	const date = parseLocalDate(value)
	const offset = (date.getDay() + 6) % 7
	date.setDate(date.getDate() - offset)
	return localDateKey(date)
}

export function monthStart(value: string): string {
	const date = parseLocalDate(value)
	date.setDate(1)
	return localDateKey(date)
}

export function dateForReference(referenceType: ReferenceType, date = localDateKey()): string | null {
	if (referenceType === 'none') {
		return null
	}
	if (referenceType === 'week') {
		return weekStart(date)
	}
	if (referenceType === 'month') {
		return monthStart(date)
	}
	return date
}

export function displayDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(parseLocalDate(value))
}

export function displayShortDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(parseLocalDate(value))
}

export function isoWeekParts(value: string): { year: string, week: string } {
	const match = /^(\d{4})-W(\d{2})$/.exec(isoWeekKey(value))
	return match === null ? { year: '', week: '' } : { year: match[1], week: match[2] }
}

export function displayReferenceTarget(
	referenceType: ReferenceType,
	targetDate: string | null,
	translations: { later: string, week: (week: string, year: string) => string },
): string {
	if (referenceType === 'none' || targetDate === null) {
		return translations.later
	}
	if (referenceType === 'day') {
		return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(parseLocalDate(targetDate))
	}
	if (referenceType === 'month') {
		return targetDate.slice(0, 7)
	}
	const { year, week } = isoWeekParts(targetDate)
	return week === '' ? targetDate : translations.week(week, year)
}

export function displayMonth(value: string): string {
	return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long' }).format(parseLocalDate(value))
}

export function displayWeek(value: string): string {
	const start = parseLocalDate(value)
	const end = parseLocalDate(addDays(value, 6))
	const format = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
	return `${format.format(start)} – ${format.format(end)}`
}

export function isoWeekKey(value: string): string {
	const date = parseLocalDate(value)
	const thursday = new Date(date)
	thursday.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
	const year = thursday.getFullYear()
	const firstThursday = new Date(year, 0, 4)
	firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7))
	const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / 604800000)
	return `${year}-W${String(week).padStart(2, '0')}`
}

export function weekFromKey(value: string): string {
	const match = /^(\d{4})-W(\d{2})$/.exec(value)
	if (match === null) {
		return weekStart(localDateKey())
	}
	const januaryFourth = new Date(Number(match[1]), 0, 4)
	const weekOne = weekStart(localDateKey(januaryFourth))
	return addDays(weekOne, (Number(match[2]) - 1) * 7)
}
