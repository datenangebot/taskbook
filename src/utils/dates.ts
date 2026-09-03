import { dateKey } from '../shared/dates.ts'

export * from '../shared/dates.ts'

export function localDateKey(date = new Date()): string {
	return dateKey(date, nextcloudTimeZone())
}

function nextcloudTimeZone(): string | undefined {
	if (typeof window === 'undefined') {
		return undefined
	}
	const timezone = (window as Window & { OC?: { getCurrentUser?: () => { timezone?: unknown } } }).OC?.getCurrentUser?.().timezone
	return typeof timezone === 'string' && timezone !== '' ? timezone : undefined
}
