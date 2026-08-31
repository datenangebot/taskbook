<script setup lang="ts">
import type { Entry, Settings } from '../types.ts'

import { t } from '@nextcloud/l10n'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import CompactEntryGroups from './CompactEntryGroups.vue'
import RapidCaptureModal from './RapidCaptureModal.vue'
import { getDay, getSettings } from '../api.ts'
import { iconPaths } from '../icons.ts'
import { notifyError } from '../notifications.ts'
import { localDateKey } from '../utils/dates.ts'
import { sortEntriesForDisplay } from '../utils/entryMutations.ts'
import { registerImmediateItemNavigation } from '../utils/itemListKeyboard.ts'
import { dayEntryGroups } from '../utils/periodLayout.ts'
import { registerQuickAddShortcut } from '../utils/quickAddShortcut.ts'

const settings = ref<Settings | null>(null)
const entries = ref<Entry[]>([])
const loading = ref(true)
const captureOpen = ref(false)
const groups = computed(() => dayEntryGroups(localDateKey(), entries.value))
const hasEntries = computed(() => groups.value.direct.length > 0 || groups.value.inherited.length > 0)
let unregisterQuickAddShortcut = () => {}
let unregisterItemNavigation = () => {}

async function load() {
	loading.value = true
	try {
		const [day, loadedSettings] = await Promise.all([getDay(localDateKey()), getSettings()])
		entries.value = day.sections.flatMap((section) => section.entries)
		settings.value = loadedSettings
	} catch { notifyError(t('taskbook', 'Taskbook summary could not be loaded.')) } finally { loading.value = false }
}

function upsert(entry: Entry) {
	const index = entries.value.findIndex((item) => item.id === entry.id)
	entries.value = sortEntriesForDisplay(index === -1 ? [...entries.value, entry] : entries.value.map((item) => item.id === entry.id ? entry : item))
}

onMounted(() => {
	void load()
	unregisterQuickAddShortcut = registerQuickAddShortcut(() => { captureOpen.value = true })
	unregisterItemNavigation = registerImmediateItemNavigation(() => document.querySelector('[data-taskbook-dashboard-scope]'))
})
onBeforeUnmount(() => { unregisterQuickAddShortcut(); unregisterItemNavigation() })
</script>

<template>
	<section :class="$style.widget" data-taskbook-dashboard-scope data-taskbook-navigation-scope>
		<div :class="$style.controls">
			<NcButton :aria-label="t('taskbook', 'New entry')"
				:title="t('taskbook', 'New entry')"
				variant="primary"
				@click="captureOpen = true">
				<template #icon>
					<NcIconSvgWrapper :path="iconPaths.plus" />
				</template>
			</NcButton>
		</div><NcLoadingIcon v-if="loading" :name="t('taskbook', 'Loading Taskbook summary')" :size="28" /><p v-else-if="!hasEntries" :class="$style.empty">
			{{ t('taskbook', 'No entries yet.') }}
		</p><CompactEntryGroups v-else
			:direct="groups.direct"
			:inherited="groups.inherited"
			@updated="upsert" /><RapidCaptureModal :contexts="settings?.contexts ?? []"
				:default-context-id="settings?.defaultContextId ?? null"
				:open="captureOpen"
				@saved="upsert"
				@update:open="captureOpen = $event" />
	</section>
</template>

<style module>
.widget { display:flex; flex-direction:column; gap:8px; }

.controls { display:flex; justify-content:flex-end; }

.empty { margin:0; color:var(--color-text-maxcontrast); }
</style>
