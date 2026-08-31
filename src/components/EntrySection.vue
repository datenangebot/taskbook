<script setup lang="ts">
import type { Context, Entry, EntrySection as Section } from '../types.ts'

import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import EntryRow from './EntryRow.vue'
import { iconPaths } from '../icons.ts'
import { displayMonth, displayShortDate, isoWeekParts } from '../utils/dates.ts'

const props = defineProps<{ section: Section, contexts: Context[], title?: string, compact?: boolean, addable?: boolean, periodContext?: 'week' | 'month', showTargetPeriod?: boolean }>()
const emit = defineEmits<{ updated: [entry: Entry], deleted: [id: number], create: [] }>()

function periodLabel(entry: Entry): string | undefined {
	if (entry.effectiveTargetDate === null || props.periodContext === undefined) {
		if (!props.showTargetPeriod || entry.effectiveTargetDate === null) {
			return undefined
		}
		if (entry.referenceType === 'day') {
			return displayShortDate(entry.effectiveTargetDate)
		}
		if (entry.referenceType === 'month') {
			return displayMonth(entry.effectiveTargetDate)
		}
		const { week } = isoWeekParts(entry.effectiveTargetDate)
		return week === '' ? undefined : t('taskbook', 'W{week}', { week })
	}
	if (entry.referenceType === 'day' && (props.periodContext === 'week' || props.periodContext === 'month')) {
		return displayShortDate(entry.effectiveTargetDate)
	}
	if (entry.referenceType === 'week' && props.periodContext === 'month') {
		const { week } = isoWeekParts(entry.effectiveTargetDate)
		return week === '' ? undefined : t('taskbook', 'W{week}', { week })
	}
	return undefined
}
</script>

<template>
	<section class="taskbook-entry-section" :class="$style.section" data-taskbook-entry-list>
		<header class="taskbook-entry-section-heading">
			<h2>{{ title ?? (section.kind === 'items' ? t('taskbook', 'Items') : section.kind === 'week' ? t('taskbook', 'This week') : section.kind === 'month' ? t('taskbook', 'This month') : section.kind === 'later' ? t('taskbook', 'Later / No date') : section.kind) }}</h2>
			<NcButton v-if="addable"
				:aria-label="t('taskbook', 'New entry')"
				:title="t('taskbook', 'New entry')"
				variant="secondary"
				@click="emit('create')">
				<template #icon>
					<NcIconSvgWrapper :path="iconPaths.plus" />
				</template>
			</NcButton>
		</header>
		<p v-if="section.entries.length === 0" :class="$style.empty">
			{{ t('taskbook', 'No entries.') }}
		</p>
		<EntryRow v-for="(entry, index) in section.entries"
			:key="entry.id"
			:compact="compact"
			:contexts="contexts"
			:entry="entry"
			:list-first="index === 0"
			:period-label="periodLabel(entry)"
			@deleted="emit('deleted', $event)"
			@updated="emit('updated', $event)" />
	</section>
</template>

<style module>
.section { display: flex; flex-direction: column; gap: 4px; margin-top: var(--default-grid-baseline, 4px); }

.section + .section { margin-top: calc(var(--default-grid-baseline, 4px) * 2); }

.empty { margin: 0; color: var(--color-text-maxcontrast); }
</style>
