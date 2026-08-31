<script setup lang="ts">
import type { Context, Entry } from '../types.ts'
import type { EntryOccurrence } from '../utils/periodLayout.ts'

import { t } from '@nextcloud/l10n'
import CompactEntryGroups from './CompactEntryGroups.vue'
import EntryRow from './EntryRow.vue'

withDefaults(defineProps<{ title: string, entries: EntryOccurrence[], inheritedEntries?: EntryOccurrence[], contexts: Context[], compact?: boolean }>(), { inheritedEntries: () => [] })
const emit = defineEmits<{ updated: [entry: Entry], deleted: [id: number] }>()
</script>

<template>
	<section class="taskbook-entry-section" :class="$style.section" data-taskbook-entry-list>
		<header class="taskbook-entry-section-heading">
			<h2>{{ title }}</h2>
		</header>
		<p v-if="entries.length === 0 && inheritedEntries.length === 0" :class="$style.empty">
			{{ t('taskbook', 'No entries yet.') }}
		</p>
		<CompactEntryGroups v-if="compact"
			:direct="entries"
			:inherited="inheritedEntries"
			@updated="emit('updated', $event)" />
		<template v-else>
			<EntryRow v-for="(occurrence, index) in entries"
				:key="`${occurrence.entry.id}-${occurrence.migrationDisplay ?? 'entry'}`"
				:contexts="contexts"
				:entry="occurrence.entry"
				:list-first="index === 0"
				:migration-display="occurrence.migrationDisplay"
				@deleted="emit('deleted', $event)"
				@updated="emit('updated', $event)" />
		</template>
	</section>
</template>

<style module>
.section { display: flex; flex-direction: column; gap: 4px; }

.empty { margin: 0; color: var(--color-text-maxcontrast); }
</style>
