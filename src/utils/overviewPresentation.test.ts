import type { Overview } from '../types.ts'

import { describe, expect, it } from 'vitest'
import { overdueNavigationCount, overdueNoticeCount, overviewQuickLinks, overviewStatisticCards } from './overviewPresentation.ts'

const overview = (overdueItems: number): Overview => ({ overdue: [], statistics: { openItems: 0, totalItemsCompleted: 0, overdueItems, laterItems: 0, migratedItems: 0 } })

describe('Overview navigation counter', () => {
	it('is absent for a zero count', () => expect(overdueNavigationCount(overview(0))).toBeNull())
	it('uses the positive canonical Overview count', () => expect(overdueNavigationCount(overview(4))).toBe(4))
	it('keeps the native notice in step with the canonical count', () => {
		expect(overdueNoticeCount(overview(0))).toBeNull()
		expect(overdueNoticeCount(overview(1))).toBe(1)
		expect(overdueNoticeCount(overview(4))).toBe(4)
	})
})

describe('Overview presentation', () => {
	it('uses the shortened Total completed label without changing its metric', () => {
		const data = overview(0)
		data.statistics.totalItemsCompleted = 12
		const cards = overviewStatisticCards(data, {
			openItems: 'Open items',
			totalItemsCompleted: 'Total completed',
			overdueItems: 'Overdue items',
			laterItems: 'Later items',
			migratedItems: 'Migrated items',
		})
		expect(cards[1]).toEqual({ label: 'Total completed', value: 12 })
	})

	it('includes Future Log as a secondary quick link', () => {
		const links = overviewQuickLinks({ day: 'Today', week: 'Week', month: 'Month', future: 'Future Log' })
		expect(links.at(-1)).toEqual({ period: 'future', label: 'Future Log', variant: 'secondary' })
	})
})
