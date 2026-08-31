<script setup lang="ts">
import type { Overview } from '../types.ts'

import { t } from '@nextcloud/l10n'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import EntrySection from '../components/EntrySection.vue'
import StatsCard from '../components/StatsCard.vue'
import { deleteEntry, getOverview } from '../api.ts'
import { notifyError, notifySuccess } from '../notifications.ts'
import { contextsFrom, entryChangeKey, settingsKey } from '../state.ts'
import { isoWeekKey, localDateKey } from '../utils/dates.ts'

const router = useRouter()
const data = ref<Overview | null>(null)
const loading = ref(true)
const settings = inject(settingsKey)
const entryChange = inject(entryChangeKey)
const contexts = computed(() => contextsFrom(settings?.value ?? null))
const statisticCards = computed(() => data.value === null
	? []
	: [
			{ label: t('taskbook', 'Open items'), value: data.value.statistics.openItems },
			{ label: t('taskbook', 'Total items completed'), value: data.value.statistics.totalItemsCompleted },
			{ label: t('taskbook', 'Overdue items'), value: data.value.statistics.overdueItems },
			{ label: t('taskbook', 'Later items'), value: data.value.statistics.laterItems },
			{ label: t('taskbook', 'Migrated items'), value: data.value.statistics.migratedItems },
		])

async function load() {
	loading.value = true
	try {
		data.value = await getOverview()
	} catch {
		notifyError(t('taskbook', 'Overview could not be loaded.'))
	} finally {
		loading.value = false
	}
}

function navigate(period: 'day' | 'week' | 'month') {
	const today = localDateKey()
	void router.push(period === 'day'
		? { name: 'day', params: { date: today } }
		: period === 'week'
			? { name: 'week', params: { week: isoWeekKey(today) } }
			: { name: 'month', params: { month: today.slice(0, 7) } })
}

async function remove(id: number) {
	try {
		await deleteEntry(id)
		if (data.value !== null) {
			data.value.overdue = data.value.overdue.filter((entry) => entry.id !== id)
		}
		notifySuccess(t('taskbook', 'Entry deleted.'))
	} catch {
		notifyError(t('taskbook', 'Entry could not be deleted.'))
	}
}

watch(entryChange ?? ref(null), (change) => { if (change !== null) { void load() } })
onMounted(load)
</script>

<template>
	<div class="taskbook-page">
		<header class="taskbook-page-header">
			<h1 class="taskbook-page-heading">
				{{ t('taskbook', 'Overview') }}
			</h1>
		</header>
		<NcLoadingIcon v-if="loading" :name="t('taskbook', 'Loading overview')" :size="32" />
		<template v-else-if="data !== null">
			<section class="taskbook-entry-section" :class="$style.quickLinks">
				<h2>{{ t('taskbook', 'Quick links') }}</h2>
				<nav :class="$style.periodLinks" :aria-label="t('taskbook', 'Current period views')">
					<NcButton :text="t('taskbook', 'Today')" variant="primary" @click="navigate('day')" />
					<NcButton :text="t('taskbook', 'Week')" variant="secondary" @click="navigate('week')" />
					<NcButton :text="t('taskbook', 'Month')" variant="secondary" @click="navigate('month')" />
				</nav>
			</section>
			<section class="taskbook-entry-section" :class="$style.stats">
				<h2>{{ t('taskbook', 'Statistics') }}</h2>
				<div :class="$style.grid">
					<StatsCard v-for="card in statisticCards"
						:key="card.label"
						:label="card.label"
						:value="card.value" />
				</div>
			</section>
			<EntrySection :class="$style.overdue"
				:contexts="contexts"
				:section="{ id: 'overdue', kind: 'Overdue', entries: data.overdue }"
				:title="t('taskbook', 'Overdue')"
				show-target-period
				@deleted="remove"
				@updated="load" />
		</template>
	</div>
</template>

<style module>
.quickLinks, .stats { margin-top: calc(var(--default-grid-baseline, 4px) * 3); }

.quickLinks h2, .stats h2 { margin: 0; font-size: 1.1rem; }

.periodLinks { display: flex; justify-content: flex-start; flex-wrap: wrap; gap: calc(var(--default-grid-baseline, 4px) * 2); margin-top: calc(var(--default-grid-baseline, 4px) * 2); }

.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin-top: 8px; }

.overdue { margin-top: calc(var(--default-grid-baseline, 4px) * 5); }

@media (max-width: 640px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
