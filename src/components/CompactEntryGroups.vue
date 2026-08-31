<script setup lang="ts">
import type { Entry } from '../types.ts'
import type { EntryOccurrence } from '../utils/periodLayout.ts'

import CompactEntryRow from './CompactEntryRow.vue'

defineProps<{ direct: EntryOccurrence[], inherited: EntryOccurrence[] }>()
const emit = defineEmits<{ updated: [entry: Entry] }>()
</script>

<template>
	<div :class="$style.list" data-taskbook-entry-list>
		<div v-if="direct.length > 0" :class="$style.entries">
			<CompactEntryRow v-for="(occurrence, index) in direct"
				:key="`${occurrence.entry.id}-${occurrence.migrationDisplay ?? 'entry'}`"
				:entry="occurrence.entry"
				:list-first="index === 0"
				:migration-display="occurrence.migrationDisplay"
				:period-label="occurrence.periodLabel"
				@updated="emit('updated', $event)" />
		</div>
		<hr v-if="direct.length > 0 && inherited.length > 0" :class="$style.divider">
		<div v-if="inherited.length > 0" :class="$style.entries">
			<CompactEntryRow v-for="(occurrence, index) in inherited"
				:key="`${occurrence.entry.id}-${occurrence.migrationDisplay ?? 'entry'}`"
				:entry="occurrence.entry"
				:list-first="direct.length === 0 && index === 0"
				:migration-display="occurrence.migrationDisplay"
				:period-label="occurrence.periodLabel"
				@updated="emit('updated', $event)" />
		</div>
	</div>
</template>

<style module>
.list { min-width: 0; }

.entries { display: flex; min-width: 0; flex-direction: column; gap: 2px; }

.divider { width: 100%; height: 1px; border: 0; background: var(--color-border); margin: calc(var(--default-grid-baseline, 4px) * 2) 0; }
</style>
