export type EntryType = 'task' | 'appointment' | 'note' | 'migrated_task' | 'irrelevant_task'
export type EntryStatus = 'open' | 'completed'
export type ReferenceType = 'day' | 'week' | 'month' | 'none'
export type ContextIcon = string

export interface Context {
	id: number
	title: string
	icon: ContextIcon
	alias: string | null
	createdAt: string
	updatedAt: string
}

export interface Entry {
	id: number
	text: string
	type: EntryType
	important: boolean
	contextId: number
	context: Context
	referenceType: ReferenceType
	primaryTargetDate: string | null
	secondaryTargetDate: string | null
	effectiveTargetDate: string | null
	status: EntryStatus
	completedAt: string | null
	createdAt: string
	updatedAt: string
}

export interface EntryRequest {
	text: string
	type: EntryType
	important: boolean
	contextId: number
	referenceType: ReferenceType
	targetDate: string | null
	status: EntryStatus
}

export interface EntrySection {
	id: string
	kind: string
	entries: Entry[]
}

export interface PeriodEntriesResponse {
	sections: EntrySection[]
	entries: Entry[]
}

export interface Overview {
	overdue: Entry[]
	statistics: {
		openItems: number
		totalItemsCompleted: number
		overdueItems: number
		laterItems: number
		migratedItems: number
	}
}

export interface Settings {
	defaultContextId: number
	contexts: Context[]
}
