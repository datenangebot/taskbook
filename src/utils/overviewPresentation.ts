import type { Overview } from '../types.ts'

import { filterEntriesByContext } from './contextFilter.ts'

export type OverviewStatisticLabels = {
	openItems: string
	totalItemsCompleted: string
	overdueItems: string
	laterItems: string
	migratedItems: string
}

export type OverviewQuickLink = {
	period: 'day' | 'week' | 'month' | 'future'
	label: string
	variant: 'primary' | 'secondary'
}

export function overdueNavigationCount(overview: Overview | null): number | null {
	const count = overview?.statistics.overdueItems ?? 0
	return count > 0 ? count : null
}

export function overdueNoticeCount(overview: Overview | null): number | null {
	const count = overview?.statistics.overdueItems ?? 0
	return count > 0 ? count : null
}

export function overviewForContexts(overview: Overview | null, contextIds: readonly number[]): Overview | null {
	if (overview === null || contextIds.length === 0) {
		return overview
	}
	const entries = filterEntriesByContext(overview.entries, contextIds)
	const overdue = filterEntriesByContext(overview.overdue, contextIds)
	return {
		entries,
		overdue,
		statistics: {
			openItems: entries.filter((entry) => entry.status === 'open').length,
			totalItemsCompleted: entries.filter((entry) => entry.status === 'completed').length,
			overdueItems: overdue.length,
			laterItems: entries.filter((entry) => entry.referenceType === 'none').length,
			migratedItems: entries.filter((entry) => entry.secondaryTargetDate !== null).length,
		},
	}
}

export function overviewStatisticCards(overview: Overview | null, labels: OverviewStatisticLabels): Array<{ label: string, value: number }> {
	if (overview === null) {
		return []
	}
	return [
		{ label: labels.openItems, value: overview.statistics.openItems },
		{ label: labels.totalItemsCompleted, value: overview.statistics.totalItemsCompleted },
		{ label: labels.overdueItems, value: overview.statistics.overdueItems },
		{ label: labels.laterItems, value: overview.statistics.laterItems },
		{ label: labels.migratedItems, value: overview.statistics.migratedItems },
	]
}

export function overviewQuickLinks(labels: Record<OverviewQuickLink['period'], string>): OverviewQuickLink[] {
	return [
		{ period: 'day', label: labels.day, variant: 'primary' },
		{ period: 'week', label: labels.week, variant: 'secondary' },
		{ period: 'month', label: labels.month, variant: 'secondary' },
		{ period: 'future', label: labels.future, variant: 'secondary' },
	]
}
