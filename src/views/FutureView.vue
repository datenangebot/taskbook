<script setup lang="ts">
import type { Entry, EntrySection as EntrySectionData } from '../types.ts'

import { t } from '@nextcloud/l10n'
import { computed, inject, onMounted, ref } from 'vue'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import EntrySection from '../components/EntrySection.vue'
import { deleteEntry, getFuture } from '../api.ts'
import { notifyError, notifySuccess } from '../notifications.ts'
import { contextsFrom, entryChangeKey, openCaptureKey, recordEntryChangeKey, settingsKey } from '../state.ts'
import { displayMonth } from '../utils/dates.ts'
import { entryReadModel } from '../utils/entryReadModel.ts'

const settings = inject(settingsKey)
const entryChange = inject(entryChangeKey)
const recordEntryChange = inject(recordEntryChangeKey)
const openCapture = inject(openCaptureKey)
const contexts = computed(() => contextsFrom(settings?.value ?? null))
const { data, loading, reload: load } = entryReadModel(entryChange ?? ref(null), getFuture, () => notifyError(t('taskbook', 'Future Log could not be loaded.')))
const sections = computed(() => data.value?.sections ?? [])

function titleFor(section: EntrySectionData): string { return section.id === 'later' ? t('taskbook', 'Later / No date') : section.id.startsWith('month-') ? displayMonth(section.id.slice('month-'.length)) : section.kind }
function upsert(entry: Entry) { if (data.value !== null) { data.value = { ...data.value, sections: sections.value.map((section) => ({ ...section, entries: section.entries.map((item) => item.id === entry.id ? entry : item) })) } } }
async function remove(id: number) { try { await deleteEntry(id); recordEntryChange?.({ deletedId: id }); notifySuccess(t('taskbook', 'Entry deleted.')) } catch { notifyError(t('taskbook', 'Entry could not be deleted.')) } }
onMounted(load)
</script>

<template>
	<div class="taskbook-page">
		<header class="taskbook-page-header">
			<h1 class="taskbook-page-heading">
				{{ t('taskbook', 'Future Log') }}
			</h1>
		</header><NcLoadingIcon v-if="loading" :name="t('taskbook', 'Loading Future Log')" :size="32" /><EntrySection v-for="section in sections"
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
