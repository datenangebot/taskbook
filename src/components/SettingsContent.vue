<script setup lang="ts">
import type { Context, ContextIcon as ContextIconValue, Settings } from '../types.ts'

import { t } from '@nextcloud/l10n'
import { generateUrl } from '@nextcloud/router'
import { computed, inject, nextTick, ref, watch } from 'vue'
import NcAppSettingsSection from '@nextcloud/vue/components/NcAppSettingsSection'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcEmojiPicker from '@nextcloud/vue/components/NcEmojiPicker'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import ContextIcon from './ContextIcon.vue'
import TaskbookModal from './TaskbookModal.vue'
import { createContext, deleteContext, ocsErrorMessage, setDefaultContext, updateContext } from '../api.ts'
import { iconPaths } from '../icons.ts'
import { notifyError, notifySuccess } from '../notifications.ts'
import { settingsKey } from '../state.ts'
import { contextAliasForTitle, initialContextAlias, validateContextAlias } from '../utils/contextAliases.ts'

const emit = defineEmits<{ changed: [settings: Settings] }>()
const settings = inject(settingsKey)
const deleteCandidate = ref<Context | null>(null)
const saving = ref(false)
const defaultBusy = ref(false)
const titleInput = ref<HTMLInputElement>()
const editor = ref<{ id: number | null, title: string, icon: ContextIconValue, alias: string, shortcutTouched: boolean, isDefault: boolean } | null>(null)
const serverAliasError = ref<string | null>(null)
const contexts = computed(() => settings?.value?.contexts ?? [])
const defaultContextId = computed(() => settings?.value?.defaultContextId ?? null)
const creating = computed(() => editor.value?.id === null && editor.value !== null)
const aliasValidation = computed(() => editor.value === null ? null : validateContextAlias(editor.value.alias, contexts.value, editor.value.id))
const aliasError = computed(() => {
	if (serverAliasError.value !== null) { return serverAliasError.value }
	const validation = aliasValidation.value
	if (validation === null || validation.valid) { return null }
	if (validation.reason === 'required') {
		return editor.value?.title.trim() === '' && !editor.value.shortcutTouched ? null : t('taskbook', 'A shortcut is required.')
	}
	if (validation.reason === 'duplicate') { return t('taskbook', 'This shortcut is already used by “{context}”.', { context: validation.contextTitle }) }
	return t('taskbook', 'Use 1 to 16 letters, numbers, hyphens, or underscores.')
})
const editorInvalid = computed(() => editor.value === null || editor.value.title.trim() === '' || aliasValidation.value?.valid !== true)

function focusTitle() { void nextTick(() => titleInput.value?.focus()) }
function openNew() { if (editor.value === null) { serverAliasError.value = null; editor.value = { id: null, title: '', icon: '🗂️', alias: '', shortcutTouched: false, isDefault: false }; focusTitle() } }
function openEdit(context: Context) { serverAliasError.value = null; editor.value = { id: context.id, title: context.title, icon: context.icon, alias: context.alias ?? initialContextAlias(context.title), shortcutTouched: context.alias !== null, isDefault: context.id === defaultContextId.value }; focusTitle() }
function cancelEditor() { if (!saving.value) { editor.value = null; serverAliasError.value = null } }
function isEditing(context: Context): boolean { return editor.value?.id === context.id }
function isDefault(context: Context): boolean {
	if (isEditing(context)) { return editor.value?.isDefault === true }
	if (editor.value?.isDefault === true) { return false }
	return context.id === defaultContextId.value
}
function setEditorDefault() { if (editor.value !== null) { editor.value.isDefault = true } }
function selectEmoji(emoji: string) { if (editor.value !== null) { editor.value.icon = emoji } }
function updateAlias(event: Event) {
	if (editor.value !== null) {
		editor.value.alias = (event.target as HTMLInputElement).value
		editor.value.shortcutTouched = true
		serverAliasError.value = null
	}
}

function aliasErrorId(id: number | null): string { return `taskbook-context-shortcut-error-${id ?? 'new'}` }

function openPwa(reset = false) {
	const url = generateUrl('/apps/taskbook/pwa/') + (reset ? '?disconnect=1' : '')
	window.open(url, '_blank', 'noopener,noreferrer')
}

async function saveContext() {
	const draft = editor.value
	const validation = aliasValidation.value
	if (draft === null || saving.value || draft.title.trim() === '' || validation?.valid !== true) { return }
	saving.value = true
	try {
		const saved = draft.id === null ? await createContext(draft.title.trim(), draft.icon, validation.alias) : await updateContext(draft.id, draft.title.trim(), draft.icon, validation.alias)
		const current = settings?.value
		if (current !== null && current !== undefined) {
			let next = { ...current, contexts: draft.id === null ? [...current.contexts, saved] : current.contexts.map((context) => context.id === saved.id ? saved : context) }
			if (draft.isDefault && next.defaultContextId !== saved.id) { next = await setDefaultContext(saved.id) }
			emit('changed', next)
		}
		editor.value = null
		notifySuccess(draft.id === null ? t('taskbook', 'Context created.') : t('taskbook', 'Context updated.'))
	} catch (error) {
		if (ocsErrorMessage(error)?.includes('shortcut is already used') === true) {
			serverAliasError.value = t('taskbook', 'This shortcut is already used.')
		}
		notifyError(t('taskbook', 'Context could not be saved.'))
	} finally { saving.value = false }
}

function selectDefault(context: Context) {
	if (isEditing(context)) { setEditorDefault(); return }
	if (editor.value !== null) { editor.value.isDefault = false }
	void changeDefault(context.id)
}

async function changeDefault(contextId: number) {
	if (defaultBusy.value || contextId === defaultContextId.value) { return }
	defaultBusy.value = true
	try { emit('changed', await setDefaultContext(contextId)); notifySuccess(t('taskbook', 'Default context updated.')) } catch { notifyError(t('taskbook', 'Default context could not be updated.')) } finally { defaultBusy.value = false }
}

async function removeContext() {
	if (deleteCandidate.value === null) { return }
	const id = deleteCandidate.value.id
	try {
		await deleteContext(id)
		const current = settings?.value
		if (current !== null && current !== undefined) { emit('changed', { ...current, contexts: current.contexts.filter((context) => context.id !== id) }) }
		notifySuccess(t('taskbook', 'Context deleted.'))
		deleteCandidate.value = null
	} catch { notifyError(t('taskbook', 'Context could not be deleted.')) }
}

watch(() => editor.value?.title, (title) => {
	if (editor.value !== null && !editor.value.shortcutTouched) {
		editor.value.alias = contextAliasForTitle(title ?? '', editor.value.alias, editor.value.shortcutTouched)
		serverAliasError.value = null
	}
})
</script>

<template>
	<NcAppSettingsSection id="contexts"
		:description="t('taskbook', 'Contexts keep every entry organised without exposing them to other users.')"
		:name="t('taskbook', 'Contexts')"
		:order="10">
		<div :class="$style.content">
			<div :class="$style.header">
				<span>{{ t('taskbook', 'Icon') }}</span><span>{{ t('taskbook', 'Title') }}</span><span>{{ t('taskbook', 'Shortcut') }}</span><span>{{ t('taskbook', 'Default context') }}</span><span class="visually-hidden">{{ t('taskbook', 'Actions') }}</span>
			</div>
			<template v-for="context in contexts" :key="context.id">
				<form v-if="isEditing(context) && editor !== null"
					:class="$style.row"
					data-taskbook-editor-active="true"
					@submit.prevent="saveContext">
					<NcEmojiPicker close-on-select :selected-emoji="editor.icon" @select="selectEmoji">
						<NcButton :aria-label="t('taskbook', 'Choose icon for {context}', { context: context.title })"
							:title="t('taskbook', 'Choose icon for {context}', { context: context.title })"
							type="button"
							variant="tertiary">
							<template #icon>
								<ContextIcon :icon="editor.icon" />
							</template>
						</NcButton>
					</NcEmojiPicker>
					<input ref="titleInput"
						v-model="editor.title"
						:aria-label="t('taskbook', 'Context title')"
						autocomplete="off"
						@keydown.esc.prevent="cancelEditor">
					<label :class="$style.aliasField">
						<span :class="$style.aliasControl">
							<span aria-hidden="true">@</span>
							<input :aria-describedby="aliasError === null ? undefined : aliasErrorId(context.id)"
								:aria-invalid="aliasError !== null"
								:aria-label="t('taskbook', 'Shortcut')"
								:maxlength="16"
								:value="editor.alias"
								autocomplete="off"
								@input="updateAlias"
								@keydown.esc.prevent="cancelEditor">
						</span>
						<span v-if="aliasError !== null" :id="aliasErrorId(context.id)" :class="$style.aliasError">{{ aliasError }}</span>
					</label>
					<label :class="$style.defaultRadio">
						<input :aria-label="t('taskbook', 'Set {context} as default context', { context: context.title })"
							:checked="isDefault(context)"
							:disabled="defaultBusy"
							name="taskbook-default-context"
							type="radio"
							@change="setEditorDefault">
						<span class="visually-hidden">{{ t('taskbook', 'Default context') }}</span>
					</label>
					<div :class="$style.actions">
						<NcButton :aria-label="t('taskbook', 'Cancel editing context')"
							:disabled="saving"
							:title="t('taskbook', 'Cancel editing context')"
							type="button"
							variant="tertiary"
							@click="cancelEditor">
							<template #icon>
								<NcIconSvgWrapper :path="iconPaths.close" />
							</template>
						</NcButton>
						<NcButton :aria-label="t('taskbook', 'Save context')"
							:disabled="saving || editorInvalid"
							:title="t('taskbook', 'Save context')"
							type="submit"
							variant="primary">
							<template #icon>
								<NcIconSvgWrapper :path="iconPaths.check" />
							</template>
						</NcButton>
					</div>
				</form>
				<div v-else :class="$style.row">
					<ContextIcon :icon="context.icon" />
					<span>{{ context.title }}</span>
					<span :class="$style.aliasValue">{{ context.alias === null ? '—' : `@${context.alias}` }}</span>
					<label :class="$style.defaultRadio">
						<input :aria-label="t('taskbook', 'Set {context} as default context', { context: context.title })"
							:checked="isDefault(context)"
							:disabled="defaultBusy || editor !== null"
							name="taskbook-default-context"
							type="radio"
							@change="selectDefault(context)">
						<span class="visually-hidden">{{ t('taskbook', 'Default context') }}</span>
					</label>
					<div :class="$style.actions">
						<NcButton :aria-label="t('taskbook', 'Edit context')"
							:disabled="editor !== null"
							:title="t('taskbook', 'Edit context')"
							variant="tertiary"
							@click="openEdit(context)">
							<template #icon>
								<NcIconSvgWrapper :path="iconPaths.pencil" />
							</template>
						</NcButton>
						<NcButton :aria-label="t('taskbook', 'Delete context')"
							:disabled="contexts.length === 1 || context.id === defaultContextId || editor !== null"
							:title="t('taskbook', 'Delete context')"
							variant="tertiary"
							@click="deleteCandidate = context">
							<template #icon>
								<NcIconSvgWrapper :path="iconPaths.delete" />
							</template>
						</NcButton>
					</div>
				</div>
			</template>
			<form v-if="creating && editor !== null"
				:class="$style.row"
				data-taskbook-editor-active="true"
				@submit.prevent="saveContext">
				<NcEmojiPicker close-on-select :selected-emoji="editor.icon" @select="selectEmoji">
					<NcButton :aria-label="t('taskbook', 'Choose icon for new context')"
						:title="t('taskbook', 'Choose icon for new context')"
						type="button"
						variant="tertiary">
						<template #icon>
							<ContextIcon :icon="editor.icon" />
						</template>
					</NcButton>
				</NcEmojiPicker>
				<input ref="titleInput"
					v-model="editor.title"
					:aria-label="t('taskbook', 'Context title')"
					autocomplete="off"
					@keydown.esc.prevent="cancelEditor">
				<label :class="$style.aliasField">
					<span :class="$style.aliasControl">
						<span aria-hidden="true">@</span>
						<input :aria-describedby="aliasError === null ? undefined : aliasErrorId(null)"
							:aria-invalid="aliasError !== null"
							:aria-label="t('taskbook', 'Shortcut')"
							:maxlength="16"
							:value="editor.alias"
							autocomplete="off"
							@input="updateAlias"
							@keydown.esc.prevent="cancelEditor">
					</span>
					<span v-if="aliasError !== null" :id="aliasErrorId(null)" :class="$style.aliasError">{{ aliasError }}</span>
				</label>
				<label :class="$style.defaultRadio">
					<input :aria-label="t('taskbook', 'Set new context as default context')"
						:checked="editor.isDefault"
						:disabled="defaultBusy"
						name="taskbook-default-context"
						type="radio"
						@change="setEditorDefault">
					<span class="visually-hidden">{{ t('taskbook', 'Default context') }}</span>
				</label>
				<div :class="$style.actions">
					<NcButton :aria-label="t('taskbook', 'Cancel new context')"
						:disabled="saving"
						:title="t('taskbook', 'Cancel new context')"
						type="button"
						variant="tertiary"
						@click="cancelEditor">
						<template #icon>
							<NcIconSvgWrapper :path="iconPaths.close" />
						</template>
					</NcButton>
					<NcButton :aria-label="t('taskbook', 'Save context')"
						:disabled="saving || editorInvalid"
						:title="t('taskbook', 'Save context')"
						type="submit"
						variant="primary">
						<template #icon>
							<NcIconSvgWrapper :path="iconPaths.check" />
						</template>
					</NcButton>
				</div>
			</form>
			<NcButton :aria-label="t('taskbook', 'New context')"
				:class="$style.add"
				:disabled="editor !== null"
				:title="t('taskbook', 'New context')"
				variant="secondary"
				@click="openNew">
				<template #icon>
					<NcIconSvgWrapper :path="iconPaths.plus" />
				</template>
			</NcButton>
		</div>
	</NcAppSettingsSection>
	<TaskbookModal v-if="deleteCandidate !== null"
		:name="t('taskbook', 'Delete context?')"
		size="small"
		@close="deleteCandidate = null">
		<p>{{ deleteCandidate.title }}</p><template #actions>
			<NcButton :text="t('taskbook', 'Cancel')" @click="deleteCandidate = null" /><NcButton :text="t('taskbook', 'Delete')" variant="error" @click="removeContext" />
		</template>
	</TaskbookModal>
	<NcAppSettingsSection id="pwa"
		:description="t('taskbook', 'Install Taskbook as an offline-capable application for quick access to your Day view and Future Log.')"
		:name="t('taskbook', 'Progressive Web App')"
		:order="20">
		<div :class="$style.pwaActions">
			<NcButton :text="t('taskbook', 'Open / Set up PWA')" variant="primary" @click="openPwa()" />
			<NcButton :text="t('taskbook', 'Reset PWA connection')" variant="secondary" @click="openPwa(true)" />
		</div>
	</NcAppSettingsSection>
	<NcAppSettingsSection id="keyboard-shortcuts"
		:name="t('taskbook', 'Keyboard shortcuts')"
		:order="30">
		<div :class="$style.shortcuts">
			<p>{{ t('taskbook', 'Keyboard shortcuts are available while using Taskbook unless they are disabled in your Nextcloud accessibility settings. View shortcuts are inactive while a text field or editor is open.') }}</p>
			<p :class="$style.shortcutHeading">
				{{ t('taskbook', 'View navigation') }}
			</p>
			<dl>
				<div><dt><kbd>Shift</kbd> + <kbd>O</kbd></dt><dd>{{ t('taskbook', 'Overview') }}</dd></div>
				<div><dt><kbd>Shift</kbd> + <kbd>D</kbd></dt><dd>{{ t('taskbook', 'Day') }}</dd></div>
				<div><dt><kbd>Shift</kbd> + <kbd>W</kbd></dt><dd>{{ t('taskbook', 'Week') }}</dd></div>
				<div><dt><kbd>Shift</kbd> + <kbd>M</kbd></dt><dd>{{ t('taskbook', 'Month') }}</dd></div>
				<div><dt><kbd>Shift</kbd> + <kbd>F</kbd></dt><dd>{{ t('taskbook', 'Future Log') }}</dd></div>
				<div><dt><kbd>Shift</kbd> + <kbd>N</kbd></dt><dd>{{ t('taskbook', 'New entry') }}</dd></div>
			</dl>
			<p :class="$style.shortcutHeading">
				{{ t('taskbook', 'Period navigation') }}
			</p>
			<dl>
				<div><dt><kbd>Shift</kbd> + <kbd>←</kbd></dt><dd>{{ t('taskbook', 'Previous day, week or month') }}</dd></div>
				<div><dt><kbd>Shift</kbd> + <kbd>→</kbd></dt><dd>{{ t('taskbook', 'Next day, week or month') }}</dd></div>
				<div><dt><kbd>Shift</kbd> + <kbd>↓</kbd></dt><dd>{{ t('taskbook', 'Go to today, this week or this month') }}</dd></div>
			</dl>
			<p :class="$style.shortcutHeading">
				{{ t('taskbook', 'Item navigation') }}
			</p>
			<dl>
				<div><dt><kbd>↓</kbd></dt><dd>{{ t('taskbook', 'Focus the first item or move to the next item') }}</dd></div>
				<div><dt><kbd>↑</kbd></dt><dd>{{ t('taskbook', 'Focus the first item or move to the previous item') }}</dd></div>
				<div><dt><kbd>Home</kbd></dt><dd>{{ t('taskbook', 'First item') }}</dd></div>
				<div><dt><kbd>End</kbd></dt><dd>{{ t('taskbook', 'Last item') }}</dd></div>
				<div><dt><kbd>Enter</kbd></dt><dd>{{ t('taskbook', 'Edit selected item where editing is available') }}</dd></div>
				<div><dt><kbd>Space</kbd></dt><dd>{{ t('taskbook', 'Complete or reopen selected item') }}</dd></div>
				<div><dt><kbd>Delete</kbd></dt><dd>{{ t('taskbook', 'Delete selected item where deleting is available') }}</dd></div>
				<div><dt><kbd>Escape</kbd></dt><dd>{{ t('taskbook', 'Leave selection or cancel editing') }}</dd></div>
			</dl>
			<p>{{ t('taskbook', 'Edit and Delete are available only in views that expose those actions.') }}</p>
			<p :class="$style.shortcutNote">
				{{ t('taskbook', 'Taskbook shortcuts follow your Nextcloud accessibility preference for keyboard shortcuts.') }}
			</p>
		</div>
	</NcAppSettingsSection>
</template>

<style module>
.content { display:flex; flex-direction:column; gap:8px; padding-inline:16px; }

.header, .row { display:grid; grid-template-columns:minmax(2.75rem, auto) minmax(12rem, 1fr) minmax(9rem, .7fr) minmax(9.5rem, max-content) auto; align-items:center; gap:8px; min-height:var(--default-clickable-area); }

.header { color:var(--color-text-maxcontrast); font-size:.85rem; font-weight:var(--font-weight-bold); }

.header span:nth-child(4) { white-space:nowrap; }

.row > input { min-width:0; min-height:var(--default-clickable-area); border:1px solid var(--color-border-maxcontrast); border-radius:var(--border-radius-element); background:var(--color-main-background); color:var(--color-main-text); padding:0 8px; font:inherit; }

.aliasField { display:flex; min-width:0; flex-direction:column; gap:2px; }

.aliasControl { display:flex; min-width:0; min-height:var(--default-clickable-area); align-items:center; gap:4px; border:1px solid var(--color-border-maxcontrast); border-radius:var(--border-radius-element); padding-inline:8px; }

.aliasControl:focus-within { border-color:var(--color-primary-element); outline:2px solid var(--color-primary-element); outline-offset:-2px; }

.aliasControl input { width:100%; min-width:0; min-height:calc(var(--default-clickable-area) - 2px); border:0; background:transparent; color:var(--color-main-text); padding:0; font:inherit; outline:0; }

.aliasError { color:var(--color-error-text); font-size:.8rem; line-height:1.25; }

.aliasValue { color:var(--color-text-maxcontrast); font-variant-numeric:tabular-nums; }

.actions { display:flex; gap:2px; }

.add { align-self:start; }

.defaultRadio { display:flex; min-height:var(--default-clickable-area); align-items:center; justify-content:center; }

.shortcuts { display:flex; flex-direction:column; gap:8px; padding-inline:16px; }

.shortcuts p, .shortcuts dl, .shortcuts dd { margin:0; }

.shortcutHeading { font-weight:var(--font-weight-bold); }

.shortcuts dl { display:flex; flex-direction:column; gap:4px; }

.shortcuts dl div { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }

.shortcuts dt { min-width:8.5rem; }

.shortcuts kbd { border:1px solid var(--color-border); border-radius:var(--border-radius-element); background:var(--color-background-dark); padding:1px 4px; font:inherit; }

.shortcutNote { color:var(--color-text-maxcontrast); font-size:.9rem; }

.pwaActions { display:flex; flex-wrap:wrap; gap:8px; padding-inline:16px; }

@media (max-width:640px) {
	.header { display:none; }

	.row { grid-template-columns:minmax(2.75rem, auto) minmax(0, 1fr) auto; }

	.aliasField, .aliasValue, .defaultRadio { grid-column:2; justify-content:start; }

	.actions { grid-column:3; grid-row:1 / span 3; align-self:center; }
}
</style>
