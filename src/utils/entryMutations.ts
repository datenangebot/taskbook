import type { Entry, EntryRequest, EntryStatus } from '../types.ts'

export function entryRequestFrom(entry: Entry, status: EntryStatus = entry.status): EntryRequest {
	return {
		text: entry.text,
		type: entry.type,
		important: entry.important,
		contextId: entry.contextId,
		referenceType: entry.referenceType,
		targetDate: entry.effectiveTargetDate,
		status,
	}
}

export function sortEntriesForDisplay(entries: Entry[]): Entry[] {
	return [...entries].sort((left, right) => {
		const status = Number(left.status === 'completed') - Number(right.status === 'completed')
		if (status !== 0) {
			return status
		}
		const created = left.createdAt.localeCompare(right.createdAt)
		return created !== 0 ? created : left.id - right.id
	})
}
