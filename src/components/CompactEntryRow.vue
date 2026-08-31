<script setup lang="ts">
import type { Entry, EntryType } from '../types.ts'

import { t } from '@nextcloud/l10n'
import { ref } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import { updateEntry } from '../api.ts'
import { entrySymbols, iconPaths } from '../icons.ts'
import { notifyError, notifySuccess } from '../notifications.ts'
import { entryRequestFrom } from '../utils/entryMutations.ts'
import { activateItemRow, handleItemListNavigation, itemRowAction, itemShortcutsAllowed } from '../utils/itemListKeyboard.ts'

const props = defineProps<{ entry: Entry, migrationDisplay?: 'original' | 'current', periodLabel?: string, listFirst?: boolean }>()
const emit = defineEmits<{ updated: [entry: Entry] }>()
const busy = ref(false)

function typeLabel(type: EntryType): string {
	return {
		task: t('taskbook', 'Task'),
		appointment: t('taskbook', 'Appointment'),
		note: t('taskbook', 'Note'),
		migrated_task: t('taskbook', 'Migrated task'),
		irrelevant_task: t('taskbook', 'Irrelevant task'),
	}[type]
}

async function toggleComplete() {
	if (busy.value) {
		return
	}
	busy.value = true
	try {
		const status = props.entry.status === 'open' ? 'completed' : 'open'
		const entry = await updateEntry(props.entry.id, entryRequestFrom(props.entry, status))
		emit('updated', entry)
		notifySuccess(status === 'completed' ? t('taskbook', 'Entry completed.') : t('taskbook', 'Entry reopened.'))
	} catch {
		notifyError(t('taskbook', 'Entry could not be updated.'))
	} finally {
		busy.value = false
	}
}

function focusRow(event: FocusEvent) {
	activateItemRow(event.currentTarget as HTMLElement)
}

function handleRowKeydown(event: KeyboardEvent) {
	if (handleItemListNavigation(event) || !itemShortcutsAllowed(event)) {
		return
	}
	const action = itemRowAction(event.key, true)
	if (action === 'toggle') {
		event.preventDefault()
		void toggleComplete()
	} else if (action === 'leave') {
		event.preventDefault()
		const row = event.currentTarget as HTMLElement
		row.blur()
	}
}
</script>

<template>
	<article :aria-label="entry.status === 'completed' ? t('taskbook', 'Completed entry: {text}', { text: entry.text }) : t('taskbook', 'Entry: {text}', { text: entry.text })"
		:class="[$style.row, { [$style.completed]: entry.status === 'completed' }]"
		:data-taskbook-entry-row="true"
		:tabindex="listFirst ? 0 : -1"
		@focus="focusRow"
		@keydown="handleRowKeydown">
		<span :class="$style.priority" aria-hidden="true">{{ entry.important ? '!' : '' }}</span>
		<span :class="$style.type"
			:title="migrationDisplay === 'original' ? t('taskbook', 'Migrated task') : typeLabel(entry.type)">
			{{ migrationDisplay === 'current' ? entrySymbols.task : entrySymbols[entry.type] }}
		</span>
		<span :class="$style.text" :title="entry.text">
			{{ entry.text }} <span v-if="migrationDisplay === 'current'" :class="$style.migrationMarker" aria-hidden="true">&gt;</span>
			<span v-if="periodLabel" :class="$style.periodLabel">{{ periodLabel }}</span>
		</span>
		<NcButton :aria-label="entry.status === 'open' ? t('taskbook', 'Mark as completed') : t('taskbook', 'Reopen entry')"
			:class="$style.complete"
			:disabled="busy"
			size="small"
			:title="entry.status === 'open' ? t('taskbook', 'Mark as completed') : t('taskbook', 'Reopen entry')"
			variant="tertiary"
			@click="toggleComplete">
			<template #icon>
				<NcIconSvgWrapper :path="iconPaths.check" />
			</template>
		</NcButton>
	</article>
</template>

<style module>
.row { display: grid; grid-template-columns: 16px 20px minmax(0, 1fr) 34px; align-items: center; gap: 2px; min-width: 0; min-height: 36px; border-radius: var(--border-radius-large); color: var(--color-main-text); }

.row:hover, .row:focus-within { background: var(--color-background-hover); }

.priority, .type { display: inline-flex; align-items: center; justify-content: center; font-weight: var(--font-weight-bold); font-variant-numeric: tabular-nums; }

.text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.migrationMarker { color: var(--color-text-maxcontrast); font-weight: var(--font-weight-bold); }

.periodLabel { margin-inline-start: calc(var(--default-grid-baseline, 4px) * 2); color: var(--color-text-maxcontrast); font-size: .875em; font-weight: normal; white-space: nowrap; }

.complete { justify-self: end; opacity: 0; visibility: hidden; pointer-events: none; }

.row:hover .complete, .row:focus-within .complete { opacity: 1; visibility: visible; pointer-events: auto; }

.row:focus-visible { outline: 2px solid var(--color-main-text); outline-offset: -2px; }

.completed .text, .completed .type { color: var(--color-text-maxcontrast); text-decoration: line-through; }

@media (hover: none), (pointer: coarse) {
	.complete { opacity: 1; visibility: visible; pointer-events: auto; }
}
</style>
