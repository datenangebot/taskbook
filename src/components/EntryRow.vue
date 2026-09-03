<script setup lang="ts">
import type { Context, Entry, EntryRequest, EntryType, ReferenceType } from '../types.ts'

import { t } from '@nextcloud/l10n'
import { nextTick, ref } from 'vue'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import NcPopover from '@nextcloud/vue/components/NcPopover'
import ContextIcon from './ContextIcon.vue'
import PriorityToggle from './PriorityToggle.vue'
import ReferenceDateActions from './ReferenceDateActions.vue'
import TaskbookModal from './TaskbookModal.vue'
import { updateEntry } from '../api.ts'
import { entrySymbols, iconPaths } from '../icons.ts'
import { notifyError, notifySuccess } from '../notifications.ts'
import { dateForReference, localDateKey } from '../utils/dates.ts'
import { entryRequestFrom } from '../utils/entryMutations.ts'
import { activateItemRow, handleItemListNavigation, itemRowAction, itemShortcutsAllowed } from '../utils/itemListKeyboard.ts'
import { parseRapidCapture } from '../utils/rapidCapture.ts'

const props = defineProps<{ entry: Entry, contexts: Context[], compact?: boolean, periodLabel?: string, migrationDisplay?: 'original' | 'current', listFirst?: boolean }>()
const emit = defineEmits<{ updated: [entry: Entry], deleted: [id: number] }>()

const editing = ref(false)
const busy = ref(false)
const confirmDelete = ref(false)
const textInput = ref<HTMLInputElement>()
const draft = ref<EntryRequest>(entryRequestFrom(props.entry))

function typeLabel(type: EntryType): string {
	return {
		task: t('taskbook', 'Task'),
		appointment: t('taskbook', 'Appointment'),
		note: t('taskbook', 'Note'),
		migrated_task: t('taskbook', 'Migrated task'),
		irrelevant_task: t('taskbook', 'Irrelevant task'),
	}[type]
}

function referenceLabel(referenceType: ReferenceType): string {
	return { day: t('taskbook', 'Day'), week: t('taskbook', 'Week'), month: t('taskbook', 'Month'), none: t('taskbook', 'None') }[referenceType]
}

function contextFor(id: number): Context {
	return props.contexts.find((context) => context.id === id) ?? props.entry.context
}

function startEdit() {
	draft.value = entryRequestFrom(props.entry)
	editing.value = true
	void nextTick(() => textInput.value?.focus())
}

function cancelEdit() {
	editing.value = false
	draft.value = entryRequestFrom(props.entry)
}

async function save() {
	if (draft.value.text.trim() === '' || busy.value) {
		return
	}
	busy.value = true
	try {
		const entry = await updateEntry(props.entry.id, { ...draft.value, text: draft.value.text.trim() })
		emit('updated', entry)
		editing.value = false
		notifySuccess(t('taskbook', 'Entry updated.'))
	} catch {
		notifyError(t('taskbook', 'Entry could not be updated.'))
	} finally {
		busy.value = false
	}
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

function focusTextEnd() {
	void nextTick(() => {
		const input = textInput.value
		input?.focus()
		input?.setSelectionRange(input.value.length, input.value.length)
	})
}

function chooseType(type: EntryType) {
	draft.value.type = type
	focusTextEnd()
}

function chooseContext(contextId: number) {
	draft.value.contextId = contextId
	focusTextEnd()
}

function chooseReference(referenceType: ReferenceType) {
	draft.value.referenceType = referenceType
	if (referenceType === 'none') {
		draft.value.targetDate = null
	} else {
		draft.value.targetDate = dateForReference(referenceType, draft.value.targetDate ?? localDateKey())
	}
	focusTextEnd()
}

function chooseDate(referenceType: ReferenceType, targetDate: string | null) {
	draft.value.referenceType = referenceType
	draft.value.targetDate = targetDate
}

function parseText() {
	const inputText = draft.value.text
	const parsed = parseRapidCapture(draft.value.text, localDateKey(), draft.value.referenceType, props.contexts)
	if (parsed.type !== undefined) {
		draft.value.type = parsed.type
	}
	if (parsed.important !== undefined) {
		draft.value.important = parsed.important
	}
	if (parsed.referenceType !== undefined) {
		draft.value.referenceType = parsed.referenceType
	}
	if (parsed.targetDate !== undefined) {
		draft.value.targetDate = parsed.targetDate
	}
	if (parsed.contextId !== undefined) {
		draft.value.contextId = parsed.contextId
	}
	draft.value.text = parsed.text
	if (parsed.text !== inputText) {
		focusTextEnd()
	}
}

function focusRow(event: FocusEvent) {
	activateItemRow(event.currentTarget as HTMLElement)
}

function handleRowKeydown(event: KeyboardEvent) {
	if (handleItemListNavigation(event) || !itemShortcutsAllowed(event)) {
		return
	}
	const action = itemRowAction(event.key, false)
	if (action === 'edit') {
		event.preventDefault()
		startEdit()
	} else if (action === 'toggle') {
		event.preventDefault()
		void toggleComplete()
	} else if (action === 'delete') {
		event.preventDefault()
		confirmDelete.value = true
	} else if (action === 'leave') {
		event.preventDefault()
		const row = event.currentTarget as HTMLElement
		row.blur()
	}
}
</script>

<template>
	<article :class="[$style.row, { [$style.completed]: entry.status === 'completed', [$style.compact]: compact, [$style.editing]: editing }]"
		:aria-label="entry.status === 'completed' ? t('taskbook', 'Completed entry: {text}', { text: entry.text }) : t('taskbook', 'Entry: {text}', { text: entry.text })"
		:data-taskbook-editor-active="editing ? 'true' : undefined"
		:data-taskbook-entry-row="true"
		:tabindex="listFirst ? 0 : -1"
		@focus="focusRow"
		@keydown="handleRowKeydown">
		<template v-if="!editing">
			<span :class="$style.priority" aria-hidden="true">{{ entry.important ? '!' : '' }}</span>
			<span :class="$style.type" :title="typeLabel(entry.type)">{{ migrationDisplay === 'current' ? entrySymbols.task : entrySymbols[entry.type] }}</span>
			<span :class="$style.text">
				{{ entry.text }} <span v-if="migrationDisplay === 'current'" :class="$style.migrationMarker" aria-hidden="true">&gt;</span>
			</span>
			<span v-if="periodLabel" :class="$style.periodLabel">{{ periodLabel }}</span>
			<NcPopover popup-role="dialog">
				<template #trigger>
					<NcButton :aria-label="t('taskbook', 'Context: {context}', { context: entry.context.title })" :class="$style.context" variant="tertiary-no-background">
						<template #icon>
							<ContextIcon :icon="entry.context.icon" />
						</template>
					</NcButton>
				</template>
				<p :class="$style.contextName">
					{{ entry.context.title }}
				</p>
			</NcPopover>
			<div :class="$style.actions" :aria-label="t('taskbook', 'Entry actions')" role="group">
				<NcButton :aria-label="entry.status === 'open' ? t('taskbook', 'Mark as completed') : t('taskbook', 'Reopen entry')"
					:disabled="busy"
					:title="entry.status === 'open' ? t('taskbook', 'Mark as completed') : t('taskbook', 'Reopen entry')"
					variant="primary"
					@click="toggleComplete">
					<template #icon>
						<NcIconSvgWrapper :path="iconPaths.check" />
					</template>
				</NcButton>
				<NcButton :aria-label="t('taskbook', 'Delete entry')"
					:disabled="busy"
					:title="t('taskbook', 'Delete entry')"
					variant="tertiary"
					@click="confirmDelete = true">
					<template #icon>
						<NcIconSvgWrapper :path="iconPaths.delete" />
					</template>
				</NcButton>
				<NcButton :aria-label="t('taskbook', 'Edit entry')"
					:disabled="busy"
					:title="t('taskbook', 'Edit entry')"
					variant="tertiary"
					@click="startEdit">
					<template #icon>
						<NcIconSvgWrapper :path="iconPaths.pencil" />
					</template>
				</NcButton>
			</div>
		</template>
		<template v-else>
			<PriorityToggle v-model="draft.important" variant="tertiary" @selected="focusTextEnd" />
			<NcActions :aria-label="t('taskbook', 'Entry type: {type}', { type: typeLabel(draft.type) })"
				force-menu
				placement="bottom-start"
				variant="tertiary">
				<template #icon>
					<span :class="$style.type" aria-hidden="true">{{ entrySymbols[draft.type] }}</span>
				</template>
				<NcActionButton v-for="type in (Object.keys(entrySymbols) as EntryType[])"
					:key="type"
					:aria-label="typeLabel(type)"
					close-after-click
					@click="chooseType(type)">
					<span :class="$style.type" aria-hidden="true">{{ entrySymbols[type] }}</span>
					{{ typeLabel(type) }}
				</NcActionButton>
			</NcActions>
			<input ref="textInput"
				v-model="draft.text"
				:aria-label="t('taskbook', 'Entry text')"
				:class="$style.editText"
				@input="parseText"
				@keydown.enter.prevent="save"
				@keydown.esc.prevent="cancelEdit">
			<NcActions :aria-label="t('taskbook', 'Context: {context}', { context: contextFor(draft.contextId).title })"
				force-menu
				placement="bottom-start"
				variant="tertiary-no-background">
				<template #icon>
					<ContextIcon :icon="contextFor(draft.contextId).icon" />
				</template>
				<NcActionButton v-for="context in contexts"
					:key="context.id"
					:aria-label="context.title"
					close-after-click
					@click="chooseContext(context.id)">
					<template #icon>
						<ContextIcon :icon="context.icon" />
					</template>
					{{ context.title }}
				</NcActionButton>
			</NcActions>
			<div :class="$style.editActions" :aria-label="t('taskbook', 'Edit controls')" role="group">
				<NcActions :aria-label="t('taskbook', 'Time reference: {reference}', { reference: referenceLabel(draft.referenceType) })"
					:menu-name="referenceLabel(draft.referenceType)"
					force-menu
					placement="bottom-start"
					variant="tertiary">
					<template #icon>
						<NcIconSvgWrapper :path="{ day: iconPaths.calendarToday, week: iconPaths.calendarWeek, month: iconPaths.calendarMonth, none: iconPaths.calendarRemove }[draft.referenceType]" />
					</template>
					<NcActionButton v-for="reference in (['day', 'week', 'month', 'none'] as ReferenceType[])"
						:key="reference"
						close-after-click
						@click="chooseReference(reference)">
						<template #icon>
							<NcIconSvgWrapper :path="{ day: iconPaths.calendarToday, week: iconPaths.calendarWeek, month: iconPaths.calendarMonth, none: iconPaths.calendarRemove }[reference]" />
						</template>
						{{ referenceLabel(reference) }}
					</NcActionButton>
				</NcActions>
				<ReferenceDateActions :reference-type="draft.referenceType"
					:target-date="draft.targetDate"
					variant="tertiary"
					@select="chooseDate"
					@selected="focusTextEnd" />
				<NcButton :aria-label="t('taskbook', 'Save changes')"
					:disabled="busy"
					:title="t('taskbook', 'Save changes')"
					variant="success"
					@click="save">
					<template #icon>
						<NcIconSvgWrapper :path="iconPaths.check" />
					</template>
				</NcButton>
				<NcButton :aria-label="t('taskbook', 'Cancel editing')"
					:disabled="busy"
					:title="t('taskbook', 'Cancel editing')"
					variant="tertiary"
					@click="cancelEdit">
					<template #icon>
						<NcIconSvgWrapper :path="iconPaths.close" />
					</template>
				</NcButton>
			</div>
		</template>
		<TaskbookModal v-if="confirmDelete"
			:name="t('taskbook', 'Delete entry?')"
			size="small"
			@close="confirmDelete = false">
			<p :class="$style.deleteText">
				{{ entry.text }}
			</p>
			<template #actions>
				<NcButton :text="t('taskbook', 'Cancel')" @click="confirmDelete = false" />
				<NcButton :text="t('taskbook', 'Delete')" variant="error" @click="emit('deleted', entry.id); confirmDelete = false" />
			</template>
		</TaskbookModal>
	</article>
</template>

<style module>
.row { display: grid; grid-template-columns: 24px 28px minmax(0, 1fr) auto 40px minmax(132px, auto); align-items: center; gap: 4px; min-height: var(--default-clickable-area); border-radius: var(--border-radius-large); padding: 2px 4px; }

.row:focus-within, .row:hover { background: var(--color-background-hover); }

.row:focus-visible { outline: 2px solid var(--color-main-text); outline-offset: -2px; background: transparent; }

.priority, .type { display: inline-flex; align-items: center; justify-content: center; min-height: var(--default-clickable-area); font-weight: var(--font-weight-bold); }

.type { font-size: 1.25rem; font-variant-numeric: tabular-nums; }

.text { min-width: 0; overflow-wrap: anywhere; }

.periodLabel { color: var(--color-text-maxcontrast); font-size: .875em; white-space: nowrap; }

.migrationMarker { color: var(--color-text-maxcontrast); font-weight: var(--font-weight-bold); }

.context { justify-self: center; }

.contextName, .deleteText { margin: 0; }

.actions, .editActions { display: flex; justify-content: end; gap: 2px; min-width: 132px; }

.actions { opacity: 0; pointer-events: none; transition: opacity 120ms ease-in-out; }

.row:hover .actions, .row:focus-within .actions { opacity: 1; pointer-events: auto; }

.completed .text, .completed .type { color: var(--color-text-maxcontrast); text-decoration: line-through; }

.editing { grid-template-columns: 24px 28px minmax(9rem, 1fr) 40px auto; }

.editText { min-width: 0; width: 100%; min-height: var(--default-clickable-area); border: 1px solid var(--color-border-maxcontrast); border-radius: var(--border-radius-element); background: var(--color-main-background); color: var(--color-main-text); padding: 0 8px; }

.compact { grid-template-columns: 20px 24px minmax(0, 1fr) auto 36px minmax(100px, auto); font-size: .9rem; }

@media (hover: none), (pointer: coarse) {
	.actions { opacity: 1; pointer-events: auto; }
}

@media (max-width: 560px) {
	.row, .editing { grid-template-columns: 24px 28px minmax(0, 1fr) auto 40px; }

	.actions, .editActions { grid-column: 3 / -1; grid-row: 2; justify-content: start; min-width: 0; }

	.periodLabel { white-space: normal; }
}
</style>
