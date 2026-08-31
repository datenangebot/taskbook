<script setup lang="ts">
import type { Context, Entry, EntryRequest, EntryType, ReferenceType } from '../types.ts'

import { t } from '@nextcloud/l10n'
import { computed, nextTick, ref, watch } from 'vue'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import ContextIcon from './ContextIcon.vue'
import PriorityToggle from './PriorityToggle.vue'
import ReferenceDateActions from './ReferenceDateActions.vue'
import TaskbookModal from './TaskbookModal.vue'
import { createEntry } from '../api.ts'
import { entrySymbols, iconPaths } from '../icons.ts'
import { notifyError, notifySuccess } from '../notifications.ts'
import { dateForReference, localDateKey } from '../utils/dates.ts'
import { parseRapidCapture } from '../utils/rapidCapture.ts'

const props = defineProps<{ open: boolean, contexts: Context[], defaultContextId: number | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean], saved: [entry: Entry] }>()

const textInput = ref<HTMLInputElement>()
const saving = ref(false)
const form = ref<EntryRequest>(defaultRequest())
const currentContext = computed(() => props.contexts.find((context) => context.id === form.value.contextId) ?? null)

function defaultRequest(): EntryRequest {
	return { text: '', type: 'task', important: false, contextId: props.defaultContextId ?? props.contexts[0]?.id ?? 0, referenceType: 'day', targetDate: localDateKey(), status: 'open' }
}

function typeLabel(type: EntryType): string {
	return { task: t('taskbook', 'Task'), appointment: t('taskbook', 'Appointment'), note: t('taskbook', 'Note'), migrated_task: t('taskbook', 'Migrated task'), irrelevant_task: t('taskbook', 'Irrelevant task') }[type]
}

function referenceLabel(referenceType: ReferenceType): string {
	return { day: t('taskbook', 'Day'), week: t('taskbook', 'Week'), month: t('taskbook', 'Month'), none: t('taskbook', 'None') }[referenceType]
}

function referenceIcon(referenceType: ReferenceType): string {
	return { day: iconPaths.calendarToday, week: iconPaths.calendarWeek, month: iconPaths.calendarMonth, none: iconPaths.calendarRemove }[referenceType]
}

function reset() {
	form.value = defaultRequest()
}

function close() {
	if (!saving.value) {
		emit('update:open', false)
	}
}

function focusTextEnd() {
	void nextTick(() => {
		const input = textInput.value
		input?.focus()
		input?.setSelectionRange(input.value.length, input.value.length)
	})
}

function setType(type: EntryType) {
	form.value.type = type
	focusTextEnd()
}

function setContext(contextId: number) {
	form.value.contextId = contextId
	focusTextEnd()
}

function setReference(referenceType: ReferenceType) {
	form.value.referenceType = referenceType
	if (referenceType === 'none') {
		form.value.targetDate = null
	} else {
		form.value.targetDate = dateForReference(referenceType, form.value.targetDate ?? localDateKey())
	}
	focusTextEnd()
}

function setDate(referenceType: ReferenceType, targetDate: string | null) {
	form.value.referenceType = referenceType
	form.value.targetDate = targetDate
}

function parseText() {
	const rawText = form.value.text
	const parsed = parseRapidCapture(rawText, localDateKey(), form.value.referenceType, props.contexts)
	if (parsed.type !== undefined) {
		form.value.type = parsed.type
	}
	if (parsed.important !== undefined) {
		form.value.important = parsed.important
	}
	if (parsed.referenceType !== undefined) {
		form.value.referenceType = parsed.referenceType
	}
	if (parsed.targetDate !== undefined) {
		form.value.targetDate = parsed.targetDate
	}
	if (parsed.contextId !== undefined) {
		form.value.contextId = parsed.contextId
	}
	form.value.text = parsed.text
	if (parsed.text !== rawText) {
		focusTextEnd()
	}
}

async function save() {
	if (saving.value || form.value.text.trim() === '' || form.value.contextId === 0) {
		return
	}
	saving.value = true
	try {
		const entry = await createEntry({ ...form.value, text: form.value.text.trim() })
		emit('saved', entry)
		notifySuccess(t('taskbook', 'Entry created.'))
		emit('update:open', false)
	} catch {
		notifyError(t('taskbook', 'Entry could not be created.'))
	} finally {
		saving.value = false
	}
}

watch(() => props.open, (open) => {
	if (open) {
		reset()
		void nextTick(() => textInput.value?.focus())
	}
})
</script>

<template>
	<TaskbookModal v-if="open"
		:name="t('taskbook', 'New entry')"
		size="normal"
		@close="close">
		<form :class="$style.form" @submit.prevent="save" @keydown.esc.prevent="close">
			<div :class="$style.captureLine">
				<PriorityToggle v-model="form.important" variant="secondary" @selected="focusTextEnd" />
				<NcActions :aria-label="t('taskbook', 'Entry type: {type}', { type: typeLabel(form.type) })"
					force-menu
					placement="bottom-start"
					variant="secondary">
					<template #icon>
						<span :class="$style.symbol" aria-hidden="true">{{ entrySymbols[form.type] }}</span>
					</template>
					<NcActionButton v-for="type in (Object.keys(entrySymbols) as EntryType[])"
						:key="type"
						:aria-label="typeLabel(type)"
						close-after-click
						@click="setType(type)">
						<span :class="$style.symbol" aria-hidden="true">{{ entrySymbols[type] }}</span>
						{{ typeLabel(type) }}
					</NcActionButton>
				</NcActions>
				<input ref="textInput"
					v-model="form.text"
					:aria-label="t('taskbook', 'Entry text')"
					:class="$style.text"
					:placeholder="t('taskbook', 'Text…')"
					autocomplete="off"
					@input="parseText"
					@keydown.enter.prevent="save">
			</div>
			<div :class="$style.metadata">
				<label :class="$style.field">
					<span>{{ t('taskbook', 'Context') }}</span>
					<NcActions :menu-name="currentContext?.title ?? t('taskbook', 'Choose context')"
						force-menu
						placement="bottom-start"
						variant="secondary">
						<template #icon>
							<ContextIcon :icon="currentContext?.icon ?? '🗂️'" />
						</template>
						<NcActionButton v-for="context in contexts"
							:key="context.id"
							:aria-label="context.title"
							close-after-click
							@click="setContext(context.id)">
							<template #icon>
								<ContextIcon :icon="context.icon" />
							</template>
							{{ context.title }}
						</NcActionButton>
					</NcActions>
				</label>
				<div :class="$style.field">
					<span>{{ t('taskbook', 'Time reference') }}</span>
					<NcActions :menu-name="referenceLabel(form.referenceType)"
						force-menu
						placement="bottom-start"
						variant="secondary">
						<template #icon>
							<NcIconSvgWrapper :path="referenceIcon(form.referenceType)" />
						</template>
						<NcActionButton v-for="reference in (['day', 'week', 'month', 'none'] as ReferenceType[])"
							:key="reference"
							close-after-click
							@click="setReference(reference)">
							<template #icon>
								<NcIconSvgWrapper :path="referenceIcon(reference)" />
							</template>
							{{ referenceLabel(reference) }}
						</NcActionButton>
					</NcActions>
				</div>
				<div :class="$style.field">
					<span>{{ t('taskbook', 'Date') }}</span>
					<ReferenceDateActions :reference-type="form.referenceType"
						:target-date="form.targetDate"
						@select="setDate"
						@selected="focusTextEnd" />
				</div>
			</div>
			<p :class="$style.help">
				{{ t('taskbook', 'Quick add: tasks are the default. Use ! for important, - for notes, o for appointments, d, w or m for day, week or month, and @shortcut for Context. Use #t for the current period, #n for the next, #nn for the one after next, #l for later, or #YYYY-MM-DD for a specific date. Prefixes can be combined.') }}
			</p>
		</form>
		<template #actions>
			<NcButton :disabled="saving" :text="t('taskbook', 'Cancel')" @click="close" />
			<NcButton :disabled="saving || form.text.trim() === '' || form.contextId === 0"
				:text="t('taskbook', 'Save')"
				variant="primary"
				@click="save" />
		</template>
	</TaskbookModal>
</template>

<style module>
.form { display: flex; flex-direction: column; gap: calc(var(--default-grid-baseline, 4px) * 5); }

.captureLine { display: flex; align-items: center; gap: calc(var(--default-grid-baseline, 4px) * 3); }

.captureLine > :nth-child(1), .captureLine > :nth-child(2) { flex: 0 0 var(--default-clickable-area); }

.captureLine > :nth-child(3) { flex: 1 1 auto; min-width: 0; }

.symbol { display: inline-flex; min-width: 1.25rem; justify-content: center; font-size: 1.25rem; font-variant-numeric: tabular-nums; }

.text { width: 100%; min-height: var(--default-clickable-area); border: 1px solid var(--color-border-maxcontrast); border-radius: var(--border-radius-element); background: var(--color-main-background); color: var(--color-main-text); padding: 0 calc(var(--default-grid-baseline, 4px) * 2); }

.field { display: flex; flex: 0 0 var(--taskbook-meta-control-width); flex-direction: column; align-items: stretch; gap: calc(var(--default-grid-baseline, 4px) * 2); font-weight: var(--font-weight-bold); }

.field :global(.action-item), .field :global(.action-item__menutoggle) { width: 100%; }

.metadata { --taskbook-meta-control-width: 10.5rem; display: flex; flex-wrap: wrap; align-items: end; gap: calc(var(--default-grid-baseline, 4px) * 3); }

.help { margin: 0; color: var(--color-text-maxcontrast); font-size: .875rem; line-height: 1.45; }

@media (max-width: 420px) {
	.metadata { display: grid; grid-template-columns: minmax(0, 1fr); }
	.field { flex-basis: auto; min-width: 0; }
}
</style>
