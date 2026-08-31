<script setup lang="ts">
import type { Context, Entry } from '../types.ts'
import type { EntryOccurrence } from '../utils/periodLayout.ts'

import { t } from '@nextcloud/l10n'
import CompactEntryGroups from './CompactEntryGroups.vue'
import EntryRow from './EntryRow.vue'
import { displayDate, displayMonth, isoWeekParts } from '../utils/dates.ts'

defineProps<{ date: string, direct: EntryOccurrence[], inherited: EntryOccurrence[], contexts: Context[], heading?: boolean, headingLink?: boolean, boxed?: boolean, compact?: boolean }>()
const emit = defineEmits<{ updated: [entry: Entry], deleted: [id: number] }>()

function periodLabel(entry: Entry): string | undefined {
	if (entry.effectiveTargetDate === null) {
		return undefined
	}
	if (entry.referenceType === 'week') {
		const { week } = isoWeekParts(entry.effectiveTargetDate)
		return week === '' ? undefined : t('taskbook', 'W{week}', { week })
	}
	return entry.referenceType === 'month' ? displayMonth(entry.effectiveTargetDate) : undefined
}
</script>

<template>
	<section :class="[$style.day, { 'taskbook-lightweight-container': boxed }]" data-taskbook-entry-list>
		<h2 v-if="heading" :class="$style.heading">
			<RouterLink v-if="headingLink"
				:class="$style.headingLink"
				:to="{ name: 'day', params: { date } }">
				{{ displayDate(date) }}
			</RouterLink>
			<template v-else>
				{{ displayDate(date) }}
			</template>
		</h2>
		<p v-if="direct.length === 0 && inherited.length === 0" :class="$style.empty">
			{{ t('taskbook', 'No entries yet.') }}
		</p>
		<CompactEntryGroups v-if="compact"
			:direct="direct"
			:inherited="inherited"
			@updated="emit('updated', $event)" />
		<template v-else>
			<div v-if="direct.length > 0" :class="$style.entries">
				<EntryRow v-for="(occurrence, index) in direct"
					:key="`${occurrence.entry.id}-${occurrence.migrationDisplay ?? 'entry'}`"
					:contexts="contexts"
					:entry="occurrence.entry"
					:list-first="index === 0"
					:migration-display="occurrence.migrationDisplay"
					@deleted="emit('deleted', $event)"
					@updated="emit('updated', $event)" />
			</div>
			<hr v-if="direct.length > 0 && inherited.length > 0" :class="$style.divider">
			<div v-if="inherited.length > 0" :class="$style.entries">
				<EntryRow v-for="(occurrence, index) in inherited"
					:key="`${date}-${occurrence.entry.id}-${occurrence.migrationDisplay ?? 'entry'}`"
					:contexts="contexts"
					:entry="occurrence.entry"
					:list-first="direct.length === 0 && index === 0"
					:migration-display="occurrence.migrationDisplay"
					:period-label="periodLabel(occurrence.entry)"
					@deleted="emit('deleted', $event)"
					@updated="emit('updated', $event)" />
			</div>
		</template>
	</section>
</template>

<style module>
.day { display: flex; flex-direction: column; gap: 4px; min-width: 0; }

.heading { margin: calc(var(--default-grid-baseline, 4px) * 3) 0 calc(var(--default-grid-baseline, 4px) * 1); font-size: 1.1rem; line-height: 1.35; }

.day:first-child .heading { margin-top: 0; }

.day:global(.taskbook-lightweight-container) .heading { margin-top: 0; }

.headingLink { border-radius: var(--border-radius-small); color: var(--color-main-text); text-decoration: none; }

.headingLink:hover { text-decoration: underline; }

.headingLink:focus-visible { outline: 2px solid var(--color-main-text); outline-offset: 2px; }

.entries { display: flex; flex-direction: column; gap: 2px; }

.divider { width: 100%; height: 1px; border: 0; background: var(--color-border); margin: calc(var(--default-grid-baseline, 4px) * 2) 0; }

.empty { margin: 0; color: var(--color-text-maxcontrast); font-size: .9rem; }
</style>
