<script setup lang="ts">
import type { Entry, EntrySection as EntrySectionData } from '../types.ts'

import { t } from '@nextcloud/l10n'
import { computed, inject, onMounted, ref, watch } from 'vue'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import EntrySection from '../components/EntrySection.vue'
import { deleteEntry, getFuture } from '../api.ts'
import { notifyError, notifySuccess } from '../notifications.ts'
import { contextsFrom, entryChangeKey, openCaptureKey, settingsKey } from '../state.ts'
import { displayMonth } from '../utils/dates.ts'

const sections = ref<EntrySectionData[]>([])
const loading = ref(true)
const settings = inject(settingsKey)
const entryChange = inject(entryChangeKey)
const openCapture = inject(openCaptureKey)
const contexts = computed(() => contextsFrom(settings?.value ?? null))

async function load() { loading.value = true; try { sections.value = (await getFuture()).sections } catch { notifyError(t('taskbook', 'Future Log could not be loaded.')) } finally { loading.value = false } }
function titleFor(section: EntrySectionData): string { return section.id === 'later' ? t('taskbook', 'Later / No date') : section.id.startsWith('month-') ? displayMonth(section.id.slice('month-'.length)) : section.kind }
function upsert(entry: Entry) { sections.value = sections.value.map((section) => ({ ...section, entries: section.entries.map((item) => item.id === entry.id ? entry : item) })) }
async function remove(id: number) { try { await deleteEntry(id); sections.value = sections.value.map((section) => ({ ...section, entries: section.entries.filter((entry) => entry.id !== id) })); notifySuccess(t('taskbook', 'Entry deleted.')) } catch { notifyError(t('taskbook', 'Entry could not be deleted.')) } }
watch(entryChange ?? ref(null), (change) => { if (change === null) { return } if ('entry' in change) { upsert(change.entry) } else { sections.value = sections.value.map((section) => ({ ...section, entries: section.entries.filter((entry) => entry.id !== change.deletedId) })) } })
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
