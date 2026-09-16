<script setup lang="ts">
import type { Entry, EntrySection as EntrySectionData } from '../types.ts'

import { t } from '@nextcloud/l10n'
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import ContextFilter from '../components/ContextFilter.vue'
import EntrySection from '../components/EntrySection.vue'
import { deleteEntry, getFuture } from '../api.ts'
import { notifyError, notifySuccess } from '../notifications.ts'
import { futureLogEntries } from '../shared/entryDomain.ts'
import { contextFilterKey, contextsFrom, entryChangeKey, openCaptureKey, recordEntryChangeKey, settingsKey, viewRefreshRegistryKey } from '../state.ts'
import { filterEntriesByContext } from '../utils/contextFilter.ts'
import { displayMonth, localDateKey } from '../utils/dates.ts'
import { entryReadModel } from '../utils/entryReadModel.ts'

const settings = inject(settingsKey)
const entryChange = inject(entryChangeKey)
const recordEntryChange = inject(recordEntryChangeKey)
const openCapture = inject(openCaptureKey)
const selectedContextIds = inject(contextFilterKey) ?? ref<number[]>([])
const viewRefreshRegistry = inject(viewRefreshRegistryKey)
const contexts = computed(() => contextsFrom(settings?.value ?? null))
const { data, loading, reload: load } = entryReadModel(entryChange ?? ref(null), getFuture, () => notifyError(t('taskbook', 'Future Log could not be loaded.')))
const sections = computed(() => data.value?.sections ?? [])
const filteredSections = computed(() => sections.value
	.map((section) => ({ ...section, entries: filterEntriesByContext(section.entries, selectedContextIds.value) }))
	.filter((section) => section.entries.length > 0))

function titleFor(section: EntrySectionData): string { return section.id === 'later' ? t('taskbook', 'Later / No date') : section.id.startsWith('month-') ? displayMonth(section.id.slice('month-'.length)) : section.kind }
function upsert(entry: Entry) {
	if (data.value !== null) {
		const eligible = futureLogEntries([entry], localDateKey()).length > 0
		data.value = {
			...data.value,
			sections: sections.value
				.map((section) => ({
					...section,
					entries: section.entries.flatMap((item) => item.id !== entry.id ? [item] : eligible ? [entry] : []),
				}))
				.filter((section) => section.id === 'later' || section.entries.length > 0),
		}
	}
}
async function remove(id: number) { try { await deleteEntry(id); recordEntryChange?.({ deletedId: id }); notifySuccess(t('taskbook', 'Entry deleted.')) } catch { notifyError(t('taskbook', 'Entry could not be deleted.')) } }
const unregisterRefresh = viewRefreshRegistry?.register('future', () => { void load() }) ?? (() => {})
onMounted(() => {
	void load()
})
onBeforeUnmount(() => { unregisterRefresh() })
</script>

<template>
	<div class="taskbook-page">
		<header class="taskbook-page-header">
			<div class="taskbook-page-heading-actions">
				<h1 class="taskbook-page-heading">
					{{ t('taskbook', 'Future Log') }}
				</h1>
				<ContextFilter />
			</div>
		</header>
		<NcLoadingIcon v-if="loading" :name="t('taskbook', 'Loading Future Log')" :size="32" />
		<p v-else-if="filteredSections.length === 0" :class="$style.empty">
			{{ t('taskbook', 'No entries yet.') }}
		</p>
		<EntrySection v-for="section in filteredSections"
			v-else
			:key="section.id"
			:addable="section.id === 'later'"
			:contexts="contexts"
			:section="section"
			:title="titleFor(section)"
			@create="openCapture?.()"
			@deleted="remove"
			@updated="upsert" />
	</div>
</template>

<style module>
.empty { margin-top: calc(var(--default-grid-baseline, 4px) * 4); color: var(--color-text-maxcontrast); }
</style>
