<script setup lang="ts">
import type { Entry } from '../types.ts'

import { getFirstDay, t } from '@nextcloud/l10n'
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import DayContent from '../components/DayContent.vue'
import EntryOccurrenceSection from '../components/EntryOccurrenceSection.vue'
import MonthCalendar from '../components/MonthCalendar.vue'
import PeriodPageHeader from '../components/PeriodPageHeader.vue'
import { deleteEntry, getDay, getMonth, getWeek } from '../api.ts'
import { notifyError, notifySuccess } from '../notifications.ts'
import { contextsFrom, entryChangeKey, openCaptureKey, recordEntryChangeKey, settingsKey } from '../state.ts'
import { addDays, addMonths, displayDate, displayMonth, displayWeek, isoWeekKey, localDateKey, monthStart, weekFromKey, weekStart } from '../utils/dates.ts'
import { sortEntriesForDisplay } from '../utils/entryMutations.ts'
import { dayEntryGroups, monthCalendar, monthEntries, weekDayEntries, weekEntryGroups } from '../utils/periodLayout.ts'
import { registerPeriodNavigationShortcuts } from '../utils/quickAddShortcut.ts'

const props = defineProps<{ mode: 'day' | 'week' | 'month', value: string }>()
const router = useRouter()
const settings = inject(settingsKey)
const entryChange = inject(entryChangeKey)
const recordEntryChange = inject(recordEntryChangeKey)
const openCapture = inject(openCaptureKey)
const contexts = computed(() => contextsFrom(settings?.value ?? null))
const entries = ref<Entry[]>([])
const loading = ref(true)
const firstDay = Number(getFirstDay())
let unregisterPeriodNavigationShortcuts = () => {}

const anchor = computed(() => props.mode === 'week' ? weekFromKey(props.value) : props.mode === 'month' ? `${props.value.slice(0, 7)}-01` : props.value)
const title = computed(() => props.mode === 'day' ? t('taskbook', 'Day') : props.mode === 'week' ? t('taskbook', 'Week') : t('taskbook', 'Month'))
const currentLabel = computed(() => props.mode === 'day' ? t('taskbook', 'Today') : props.mode === 'week' ? t('taskbook', 'This week') : t('taskbook', 'This month'))
const display = computed(() => props.mode === 'day' ? displayDate(anchor.value) : props.mode === 'week' ? displayWeek(anchor.value) : displayMonth(anchor.value))
const isCurrentPeriod = computed(() => {
	const today = localDateKey()
	return props.mode === 'day' ? anchor.value === today : props.mode === 'week' ? weekStart(anchor.value) === weekStart(today) : monthStart(anchor.value) === monthStart(today)
})
const dayGroups = computed(() => dayEntryGroups(anchor.value, entries.value))
const weekDays = computed(() => weekDayEntries(anchor.value, entries.value))
const weekDayColumns = computed(() => [weekDays.value.slice(0, 4), weekDays.value.slice(4)])
const weeklyEntries = computed(() => weekEntryGroups(anchor.value, entries.value))
const calendarRows = computed(() => monthCalendar(anchor.value, entries.value, firstDay))
const selectedMonthEntries = computed(() => monthEntries(anchor.value, entries.value))

async function load() {
	loading.value = true
	try {
		if (props.mode === 'day') {
			const response = await getDay(anchor.value)
			entries.value = response.sections.flatMap((section) => section.entries)
		} else if (props.mode === 'week') {
			entries.value = (await getWeek(anchor.value)).entries
		} else {
			entries.value = (await getMonth(anchor.value)).entries
		}
	} catch {
		notifyError(t('taskbook', 'Entries could not be loaded.'))
	} finally {
		loading.value = false
	}
}

function reloadAfterUpdate() {
	void load()
}

function mergeUpdated(entry: Entry) {
	entries.value = sortEntriesForDisplay(entries.value.map((item) => item.id === entry.id ? entry : item))
}

async function remove(id: number) {
	try {
		await deleteEntry(id)
		entries.value = entries.value.filter((entry) => entry.id !== id)
		recordEntryChange?.({ deletedId: id })
		notifySuccess(t('taskbook', 'Entry deleted.'))
	} catch {
		notifyError(t('taskbook', 'Entry could not be deleted.'))
	}
}

function shift(amount: number) {
	const next = props.mode === 'day' ? addDays(anchor.value, amount) : props.mode === 'week' ? addDays(anchor.value, amount * 7) : addMonths(anchor.value, amount)
	void router.push(props.mode === 'day' ? { name: 'day', params: { date: next } } : props.mode === 'week' ? { name: 'week', params: { week: isoWeekKey(next) } } : { name: 'month', params: { month: next.slice(0, 7) } })
}

function current() {
	const today = localDateKey()
	void router.push(props.mode === 'day' ? { name: 'day', params: { date: today } } : props.mode === 'week' ? { name: 'week', params: { week: isoWeekKey(today) } } : { name: 'month', params: { month: today.slice(0, 7) } })
}

watch(() => props.value, load)
watch(entryChange ?? ref(null), (change) => { if (change !== null) { void load() } })
onMounted(() => {
	void load()
	unregisterPeriodNavigationShortcuts = registerPeriodNavigationShortcuts((action) => {
		if (action === 'previous') {
			shift(-1)
		} else if (action === 'next') {
			shift(1)
		} else if (!isCurrentPeriod.value) {
			current()
		}
	})
})
onBeforeUnmount(() => unregisterPeriodNavigationShortcuts())
</script>

<template>
	<div class="taskbook-page" :class="{ 'taskbook-page--wide': mode !== 'day' }">
		<PeriodPageHeader :current="isCurrentPeriod"
			:current-label="currentLabel"
			:title="title"
			@create="openCapture?.()"
			@current="current"
			@next="shift(1)"
			@previous="shift(-1)" />
		<p class="taskbook-period-label">
			{{ display }}
		</p>
		<NcLoadingIcon v-if="loading" :name="t('taskbook', 'Loading entries')" :size="32" />
		<DayContent v-else-if="mode === 'day'"
			:contexts="contexts"
			:date="anchor"
			:direct="dayGroups.direct"
			:inherited="dayGroups.inherited"
			@deleted="remove"
			@updated="reloadAfterUpdate" />
		<div v-else-if="mode === 'week'" :class="$style.weekGrid">
			<div v-for="(column, columnIndex) in weekDayColumns" :key="columnIndex" :class="$style.weekColumn">
				<DayContent v-for="day in column"
					:key="day.date"
					:contexts="contexts"
					:date="day.date"
					:direct="day.direct"
					:inherited="day.inherited"
					boxed
					compact
					heading
					heading-link
					@deleted="remove"
					@updated="mergeUpdated" />
				<div v-if="columnIndex === 1" class="taskbook-lightweight-container">
					<EntryOccurrenceSection :contexts="contexts"
						compact
						:entries="weeklyEntries.direct"
						:inherited-entries="weeklyEntries.monthDerived"
						:title="t('taskbook', 'Week')"
						@deleted="remove"
						@updated="mergeUpdated" />
				</div>
			</div>
		</div>
		<template v-else>
			<EntryOccurrenceSection :class="$style.monthEntries"
				:contexts="contexts"
				:entries="selectedMonthEntries"
				:title="t('taskbook', 'Month entries')"
				@deleted="remove"
				@updated="mergeUpdated" />
			<MonthCalendar :class="$style.monthCalendar"
				:first-day="firstDay"
				:rows="calendarRows"
				@updated="mergeUpdated" />
		</template>
	</div>
</template>

<style module>
.weekGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: calc(var(--default-grid-baseline, 4px) * 4); }

.weekColumn { display: flex; min-width: 0; flex-direction: column; gap: calc(var(--default-grid-baseline, 4px) * 4); }

.monthEntries, .monthCalendar { margin-top: calc(var(--default-grid-baseline, 4px) * 2); }

@media (max-width: 760px) {
	.weekGrid { grid-template-columns: minmax(0, 1fr); }
}
</style>
