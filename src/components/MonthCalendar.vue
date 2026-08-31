<script setup lang="ts">
import type { Entry } from '../types.ts'
import type { CalendarWeek, DayEntryGroups, EntryGroupSummary, EntryOccurrence } from '../utils/periodLayout.ts'

import { getDayNamesShort, t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import NcPopover from '@nextcloud/vue/components/NcPopover'
import CalendarSummary from './CalendarSummary.vue'
import CompactEntryGroups from './CompactEntryGroups.vue'
import { iconPaths } from '../icons.ts'
import { displayDate, isoWeekKey } from '../utils/dates.ts'
import { entryGroupSummary, entryOccurrenceSummary } from '../utils/periodLayout.ts'

const props = defineProps<{ rows: CalendarWeek[], firstDay: number }>()
const emit = defineEmits<{ updated: [entry: Entry] }>()

const dayNames = Array.from({ length: 7 }, (_, offset) => getDayNamesShort()[(props.firstDay + offset) % 7])

function hasEntries(summary: EntryGroupSummary): boolean {
	return summary.open + summary.closed > 0
}

function daySummary(day: DayEntryGroups): EntryGroupSummary {
	return entryGroupSummary(day)
}

function weekSummary(entries: EntryOccurrence[]): EntryGroupSummary {
	return entryOccurrenceSummary(entries)
}
</script>

<template>
	<div :aria-label="t('taskbook', 'Month calendar')"
		:class="$style.viewport"
		role="region"
		tabindex="0">
		<div :class="$style.calendar">
			<div v-for="dayName in dayNames"
				:key="dayName"
				:class="$style.columnHeading">
				{{ dayName }}
			</div>
			<div :class="[$style.columnHeading, $style.weekHeading]">
				{{ t('taskbook', 'Week') }}
			</div>
			<template v-for="row in rows" :key="row.weekStart">
				<div v-for="day in row.days"
					:key="day.date"
					:class="[$style.cell, { [$style.outside]: !day.inMonth, [$style.today]: day.isToday }]">
					<div :class="$style.cellHeader">
						<RouterLink :aria-label="displayDate(day.date)"
							:class="$style.identifier"
							:to="{ name: 'day', params: { date: day.date } }">
							{{ day.dayNumber }}
						</RouterLink>
						<NcPopover v-if="day.inMonth && hasEntries(daySummary(day))" popup-role="dialog">
							<template #trigger>
								<NcButton :aria-label="t('taskbook', 'Show entries for {date}', { date: displayDate(day.date) })"
									:title="t('taskbook', 'Show entries for {date}', { date: displayDate(day.date) })"
									size="small"
									variant="secondary">
									<template #icon>
										<NcIconSvgWrapper :path="iconPaths.information" />
									</template>
								</NcButton>
							</template>
							<div :aria-labelledby="`taskbook-day-popover-${day.date}`"
								:class="$style.popover"
								aria-modal="true"
								role="dialog"
								tabindex="0">
								<h3 :id="`taskbook-day-popover-${day.date}`" :class="$style.popoverHeading">
									{{ displayDate(day.date) }}
								</h3>
								<CompactEntryGroups :direct="day.direct"
									:inherited="day.inherited"
									@updated="emit('updated', $event)" />
							</div>
						</NcPopover>
					</div>
					<CalendarSummary v-if="day.inMonth" :summary="daySummary(day)" />
				</div>
				<div :class="[$style.cell, $style.weekCell]">
					<div :class="$style.cellHeader">
						<RouterLink :aria-label="t('taskbook', 'Week {week}', { week: row.weekNumber })"
							:class="$style.identifier"
							:to="{ name: 'week', params: { week: isoWeekKey(row.weekStart) } }">
							{{ t('taskbook', 'W{week}', { week: row.weekNumber }) }}
						</RouterLink>
						<NcPopover v-if="hasEntries(weekSummary(row.entries))" popup-role="dialog">
							<template #trigger>
								<NcButton :aria-label="t('taskbook', 'Show entries for Week {week}, {year}', { week: row.weekNumber, year: row.weekYear })"
									:title="t('taskbook', 'Show entries for Week {week}, {year}', { week: row.weekNumber, year: row.weekYear })"
									size="small"
									variant="secondary">
									<template #icon>
										<NcIconSvgWrapper :path="iconPaths.information" />
									</template>
								</NcButton>
							</template>
							<div :aria-labelledby="`taskbook-week-popover-${row.weekYear}-${row.weekNumber}`"
								:class="$style.popover"
								aria-modal="true"
								role="dialog"
								tabindex="0">
								<h3 :id="`taskbook-week-popover-${row.weekYear}-${row.weekNumber}`" :class="$style.popoverHeading">
									{{ t('taskbook', 'Week {week} · {year}', { week: row.weekNumber, year: row.weekYear }) }}
								</h3>
								<CompactEntryGroups :direct="row.entries"
									:inherited="[]"
									@updated="emit('updated', $event)" />
							</div>
						</NcPopover>
					</div>
					<CalendarSummary :summary="weekSummary(row.entries)" />
				</div>
			</template>
		</div>
	</div>
</template>

<style module>
.viewport { width: 100%; overflow-x: auto; }

.viewport:focus-visible { outline: 2px solid var(--color-main-text); outline-offset: 2px; }

.calendar { display: grid; min-width: 880px; grid-template-columns: repeat(7, minmax(96px, 1fr)) minmax(124px, 1.2fr); gap: calc(var(--default-grid-baseline, 4px) * 2); background: transparent; }

.columnHeading { min-width: 0; color: var(--color-text-maxcontrast); padding: 2px 8px; font-size: .8rem; font-weight: var(--font-weight-bold); }

.weekHeading { padding-inline-start: 10px; }

.cell { display: flex; min-width: 0; min-height: 88px; flex-direction: column; gap: 2px; box-sizing: border-box; border: 1px solid var(--color-border); border-radius: var(--border-radius-large); background: transparent; color: var(--color-main-text); padding: 7px; }

.cell:hover, .cell:focus-within { background: var(--color-background-hover); }

.weekCell { background: transparent; }

.outside { color: var(--color-text-maxcontrast); opacity: .72; }

.today { border-color: var(--color-border-maxcontrast); border-width: 2px; padding: 6px; }

.identifier { width: fit-content; border-radius: var(--border-radius-small); color: var(--color-main-text); font-weight: var(--font-weight-bold); font-variant-numeric: tabular-nums; text-decoration: none; }

.identifier:hover { text-decoration: underline; }

.identifier:focus-visible { outline: 2px solid var(--color-main-text); outline-offset: 2px; }

.today .identifier { text-decoration: underline; text-decoration-thickness: 2px; }

.cellHeader { display: flex; align-items: center; justify-content: space-between; gap: calc(var(--default-grid-baseline, 4px) * 2); }

.popover { width: min(400px, calc(100vw - 32px)); max-width: 100%; box-sizing: border-box; padding: calc(var(--default-grid-baseline, 4px) * 4); }

.popover:focus-visible { outline: 2px solid var(--color-main-text); outline-offset: -2px; }

.popoverHeading { margin: 0 0 calc(var(--default-grid-baseline, 4px) * 3); font-size: 1rem; line-height: 1.35; }

</style>
