import type { Entry } from '../types.ts'

export function filterEntriesByContext<T extends Entry>(entries: T[], contextIds: readonly number[]): T[] {
	if (contextIds.length === 0) {
		return entries
	}
	const selected = new Set(contextIds)
	return entries.filter((entry) => selected.has(entry.contextId))
}
