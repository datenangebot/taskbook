<script setup lang="ts">
import type { EntryChange } from './state.ts'
import type { Entry, Settings } from './types.ts'

import { t } from '@nextcloud/l10n'
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NcAppContent from '@nextcloud/vue/components/NcAppContent'
import NcAppNavigation from '@nextcloud/vue/components/NcAppNavigation'
import NcAppNavigationItem from '@nextcloud/vue/components/NcAppNavigationItem'
import NcAppSettingsDialog from '@nextcloud/vue/components/NcAppSettingsDialog'
import NcContent from '@nextcloud/vue/components/NcContent'
import NcCounter from '@nextcloud/vue/components/NcCounterBubble'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import RapidCaptureModal from './components/RapidCaptureModal.vue'
import SettingsContent from './components/SettingsContent.vue'
import SupportModal from './components/SupportModal.vue'
import { getOverview, getSettings } from './api.ts'
import { iconPaths } from './icons.ts'
import { notifyError } from './notifications.ts'
import { entryChangeKey, openCaptureKey, overviewKey, overviewLoadingKey, recordEntryChangeKey, settingsKey } from './state.ts'
import { isoWeekKey, localDateKey } from './utils/dates.ts'
import { entryReadModel } from './utils/entryReadModel.ts'
import { registerImmediateItemNavigation } from './utils/itemListKeyboard.ts'
import { overdueNavigationCount } from './utils/overviewPresentation.ts'
import { registerTaskbookShortcuts } from './utils/quickAddShortcut.ts'

const route = useRoute()
const router = useRouter()
const settings = ref<Settings | null>(null)
const entryChange = ref<EntryChange | null>(null)
const { data: overview, loading: overviewLoading, reload: loadOverview } = entryReadModel(entryChange, getOverview, () => notifyError(t('taskbook', 'Overview could not be loaded.')))
const settingsOpen = ref(false)
const captureOpen = ref(false)
const supportOpen = ref(false)
let unregisterTaskbookShortcuts = () => {}
let unregisterItemNavigation = () => {}
provide(settingsKey, settings)
provide(entryChangeKey, entryChange)
provide(recordEntryChangeKey, recordEntryChange)
provide(overviewKey, overview)
provide(overviewLoadingKey, overviewLoading)
provide(openCaptureKey, () => { captureOpen.value = true })

const active = computed(() => route.name?.toString() ?? 'overview')
const overdueCount = computed(() => overdueNavigationCount(overview.value))
const nav = [
	{ name: 'overview', label: t('taskbook', 'Overview'), icon: iconPaths.overview },
	{ name: 'day', label: t('taskbook', 'Day'), icon: iconPaths.calendarToday },
	{ name: 'week', label: t('taskbook', 'Week'), icon: iconPaths.calendarWeek },
	{ name: 'month', label: t('taskbook', 'Month'), icon: iconPaths.calendarMonth },
	{ name: 'future', label: t('taskbook', 'Future Log'), icon: iconPaths.calendar },
]

async function loadSettings() { try { settings.value = await getSettings() } catch { notifyError(t('taskbook', 'Taskbook settings could not be loaded.')) } }
function navigate(name: string) { const today = localDateKey(); void router.push(name === 'day' ? { name, params: { date: today } } : name === 'week' ? { name, params: { week: isoWeekKey(today) } } : name === 'month' ? { name, params: { month: today.slice(0, 7) } } : { name }) }
function recordEntryChange(change: EntryChange) { entryChange.value = change }
function captured(entry: Entry) { recordEntryChange({ entry }) }
onMounted(() => {
	void Promise.all([loadSettings(), loadOverview()])
	unregisterTaskbookShortcuts = registerTaskbookShortcuts({
		onQuickAdd: () => { captureOpen.value = true },
		onViewNavigation: navigate,
	})
	unregisterItemNavigation = registerImmediateItemNavigation(() => document.querySelector('[data-taskbook-navigation-scope]'))
})
onBeforeUnmount(() => { unregisterTaskbookShortcuts(); unregisterItemNavigation() })
</script>

<template>
	<NcContent app-name="taskbook">
		<NcAppNavigation :aria-label="t('taskbook', 'Taskbook views')">
			<template #list>
				<ul>
					<NcAppNavigationItem v-for="item in nav"
						:key="item.name"
						:active="active === item.name"
						:name="item.label"
						@click.prevent="navigate(item.name)">
						<template #icon>
							<NcIconSvgWrapper :path="item.icon" />
						</template>
						<template #counter>
							<NcCounter v-if="item.name === 'overview' && overdueCount !== null"
								:active="active === item.name"
								:count="overdueCount"
								type="highlighted" />
						</template>
					</NcAppNavigationItem>
				</ul>
			</template><template #footer>
				<ul>
					<NcAppNavigationItem :name="t('taskbook', 'Support')" @click.prevent="supportOpen = true">
						<template #icon>
							<NcIconSvgWrapper :path="iconPaths.heart" />
						</template>
					</NcAppNavigationItem><NcAppNavigationItem :name="t('taskbook', 'Settings')" @click.prevent="settingsOpen = true">
						<template #icon>
							<NcIconSvgWrapper :path="iconPaths.settings" />
						</template>
					</NcAppNavigationItem>
				</ul>
			</template>
		</NcAppNavigation>
		<NcAppContent data-taskbook-navigation-scope>
			<RouterView />
		</NcAppContent>
		<NcAppSettingsDialog v-model:open="settingsOpen"
			:name="t('taskbook', 'Taskbook settings')"
			no-version
			show-navigation>
			<SettingsContent @changed="settings = $event" />
		</NcAppSettingsDialog>
		<RapidCaptureModal :contexts="settings?.contexts ?? []"
			:default-context-id="settings?.defaultContextId ?? null"
			:open="captureOpen"
			@saved="captured"
			@update:open="captureOpen = $event" />
		<SupportModal :open="supportOpen" @update:open="supportOpen = $event" />
	</NcContent>
</template>
