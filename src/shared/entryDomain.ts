import type { Context, Entry, EntryRequest } from './types.ts'

import { monthStart, weekStart } from './dates.ts'

export interface SyncEntry extends Entry {
	clientUid: string
	revision: number
}

export function isOverdueEntry(entry: Entry, today: string): boolean {
	if (entry.status !== 'open' || !['task', 'migrated_task'].includes(entry.type) || entry.effectiveTargetDate === null) {
		return false
	}
	return entry.referenceType === 'day'
		? entry.effectiveTargetDate < today
		: entry.referenceType === 'week'
			? entry.effectiveTargetDate < weekStart(today)
			: entry.referenceType === 'month'
				? entry.effectiveTargetDate < monthStart(today)
				: false
}

export function overdueEntries<T extends Entry>(entries: T[], today: string): T[] {
	return entries
		.filter((entry) => isOverdueEntry(entry, today))
		.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id - right.id)
}

function sameTarget(entry: SyncEntry, request: EntryRequest): boolean {
	return entry.referenceType === request.referenceType && entry.effectiveTargetDate === request.targetDate
}

export function applyEntryRequest(entry: SyncEntry, request: EntryRequest, contexts: Context[], now: string): SyncEntry {
	const context = contexts.find((candidate) => candidate.id === request.contextId) ?? entry.context
	const targetChanged = !sameTarget(entry, request)
	const typeChanged = entry.type !== request.type
	let type = request.type
	let primaryTargetDate = request.targetDate
	let secondaryTargetDate: string | null = null

	if (request.referenceType === 'none') {
		if (['task', 'migrated_task'].includes(entry.type) && !typeChanged && targetChanged) {
			type = 'migrated_task'
			primaryTargetDate = entry.primaryTargetDate
		} else {
			primaryTargetDate = null
		}
	} else if (entry.type === 'task' && !typeChanged && targetChanged) {
		type = 'migrated_task'
		primaryTargetDate = entry.primaryTargetDate
		secondaryTargetDate = request.targetDate
	} else if (entry.type === 'migrated_task' && !typeChanged) {
		type = 'migrated_task'
		primaryTargetDate = entry.primaryTargetDate
		secondaryTargetDate = targetChanged ? request.targetDate : entry.secondaryTargetDate
	}

	return {
		...entry,
		text: request.text.trim(),
		type,
		important: request.important,
		contextId: request.contextId,
		context,
		referenceType: request.referenceType,
		primaryTargetDate,
		secondaryTargetDate,
		effectiveTargetDate: secondaryTargetDate ?? primaryTargetDate,
		status: request.status,
		completedAt: request.status === 'completed' ? entry.completedAt ?? now : null,
		updatedAt: now,
	}
}

export function createLocalEntry(clientUid: string, request: EntryRequest, contexts: Context[], now: string): SyncEntry {
	const context = contexts.find((candidate) => candidate.id === request.contextId)
	if (context === undefined) {
		throw new TypeError('The selected Context is unavailable.')
	}
	let hash = 0
	for (const character of clientUid) {
		hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0
	}
	return {
		id: -Math.max(1, Math.abs(hash)),
		clientUid,
		revision: 0,
		text: request.text.trim(),
		type: request.type,
		important: request.important,
		contextId: request.contextId,
		context,
		referenceType: request.referenceType,
		primaryTargetDate: request.targetDate,
		secondaryTargetDate: null,
		effectiveTargetDate: request.targetDate,
		status: request.status,
		completedAt: request.status === 'completed' ? now : null,
		createdAt: now,
		updatedAt: now,
	}
}

export function syncPayload(entry: SyncEntry): EntryRequest {
	return {
		text: entry.text,
		type: entry.type,
		important: entry.important,
		contextId: entry.contextId,
		referenceType: entry.referenceType,
		targetDate: entry.effectiveTargetDate,
		status: entry.status,
	}
}
