<script setup lang="ts">
import type { Overview } from '../types.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, inject, ref } from 'vue'
import { useRouter } from 'vue-router'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import EntrySection from '../components/EntrySection.vue'
import StatsCard from '../components/StatsCard.vue'
import { deleteEntry } from '../api.ts'
import { notifyError, notifySuccess } from '../notifications.ts'
import { contextsFrom, overviewKey, overviewLoadingKey, recordEntryChangeKey, settingsKey } from '../state.ts'
import { isoWeekKey, localDateKey } from '../utils/dates.ts'
import { overdueNoticeCount, overviewQuickLinks, overviewStatisticCards } from '../utils/overviewPresentation.ts'

const router = useRouter()
const data = inject(overviewKey) ?? ref<Overview | null>(null)
const loading = inject(overviewLoadingKey) ?? ref(true)
const settings = inject(settingsKey)
const recordEntryChange = inject(recordEntryChangeKey)
const contexts = computed(() => contextsFrom(settings?.value ?? null))
const statisticLabels = {
	openItems: t('taskbook', 'Open items'),
	totalItemsCompleted: t('taskbook', 'Total completed'),
	overdueItems: t('taskbook', 'Overdue items'),
	laterItems: t('taskbook', 'Later items'),
	migratedItems: t('taskbook', 'Migrated items'),
}
const statisticCards = computed(() => overviewStatisticCards(data.value, statisticLabels))
const overdueCount = computed(() => overdueNoticeCount(data.value))
const overdueNotice = computed(() => overdueCount.value === null
	? null
	: n(
			'taskbook',
			'You have {count} overdue item. Review and migrate it to keep your plans up to date.',
			'You have {count} overdue items. Review and migrate them to keep your plans up to date.',
			overdueCount.value,
			{ count: overdueCount.value },
		))
const quickLinks = overviewQuickLinks({
	day: t('taskbook', 'Today'),
	week: t('taskbook', 'Week'),
	month: t('taskbook', 'Month'),
	future: t('taskbook', 'Future Log'),
})

function navigate(period: 'day' | 'week' | 'month' | 'future') {
	const today = localDateKey()
	void router.push(period === 'future'
		? { name: 'future' }
		: period === 'day'
			? { name: 'day', params: { date: today } }
			: period === 'week'
				? { name: 'week', params: { week: isoWeekKey(today) } }
				: { name: 'month', params: { month: today.slice(0, 7) } })
}

async function remove(id: number) {
	try {
		await deleteEntry(id)
		recordEntryChange?.({ deletedId: id })
		notifySuccess(t('taskbook', 'Entry deleted.'))
	} catch {
		notifyError(t('taskbook', 'Entry could not be deleted.'))
	}
}

</script>

<template>
	<div class="taskbook-page">
		<header class="taskbook-page-header">
			<h1 class="taskbook-page-heading">
				{{ t('taskbook', 'Overview') }}
			</h1>
		</header>
		<NcNoteCard v-if="overdueNotice !== null" type="info" :text="overdueNotice" />
		<NcLoadingIcon v-if="loading" :name="t('taskbook', 'Loading overview')" :size="32" />
		<template v-else-if="data !== null">
			<section class="taskbook-entry-section" :class="$style.quickLinks">
				<h2>{{ t('taskbook', 'Quick links') }}</h2>
				<nav :class="$style.periodLinks" :aria-label="t('taskbook', 'Current period views')">
					<NcButton v-for="link in quickLinks"
						:key="link.period"
						:text="link.label"
						:variant="link.variant"
						@click="navigate(link.period)" />
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
				@deleted="remove" />
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
