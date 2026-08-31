<script setup lang="ts">
import type { ReferenceType } from '../types.ts'

import { t } from '@nextcloud/l10n'
import { computed, ref, watch } from 'vue'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActionInput from '@nextcloud/vue/components/NcActionInput'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import { iconPaths } from '../icons.ts'
import { addDays, addMonths, dateForReference, displayReferenceTarget, localDateKey, monthStart, parseLocalDate } from '../utils/dates.ts'

const props = withDefaults(defineProps<{
	referenceType: ReferenceType
	targetDate: string | null
	variant?: 'secondary' | 'tertiary' | 'tertiary-no-background'
}>(), { variant: 'secondary' })
const emit = defineEmits<{ select: [referenceType: ReferenceType, targetDate: string | null], selected: [] }>()

const actions = ref<InstanceType<typeof NcActions>>()
const customDate = ref<Date>(parseLocalDate(props.targetDate ?? localDateKey()))
const dateLabel = computed(() => displayReferenceTarget(props.referenceType, props.targetDate, {
	later: t('taskbook', 'Later'),
	week: (week, year) => t('taskbook', 'W{week} {year}', { week, year }),
}))
const optionLabels = computed(() => props.referenceType === 'day'
	? [t('taskbook', 'Today'), t('taskbook', 'Tomorrow'), t('taskbook', 'Day after tomorrow')]
	: props.referenceType === 'week'
		? [t('taskbook', 'This week'), t('taskbook', 'Next week'), t('taskbook', 'Week after next')]
		: [t('taskbook', 'This month'), t('taskbook', 'Next month'), t('taskbook', 'Month after next')])

watch(() => props.targetDate, (targetDate) => {
	customDate.value = parseLocalDate(targetDate ?? localDateKey())
})

function iconForOffset(offset: number): string {
	return offset === 0 ? iconPaths.calendarToday : iconPaths.arrowRight
}

function anchorForOffset(offset: number): string {
	const today = localDateKey()
	if (props.referenceType === 'month') {
		return addMonths(monthStart(today), offset)
	}
	return addDays(today, props.referenceType === 'week' ? offset * 7 : offset)
}

async function selectTarget(targetDate: string | null) {
	const referenceType = targetDate === null ? 'none' : props.referenceType
	emit('select', referenceType, targetDate === null ? null : dateForReference(referenceType, targetDate))
	await actions.value?.closeMenu(false)
	emit('selected')
}

function selectOffset(offset: number) {
	void selectTarget(anchorForOffset(offset))
}

function selectCustomDate(value: string | Date | number | unknown[] | null) {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		customDate.value = value
		void selectTarget(localDateKey(value))
	}
}
</script>

<template>
	<NcActions ref="actions"
		:aria-label="t('taskbook', 'Date: {date}', { date: dateLabel })"
		:menu-name="dateLabel"
		force-menu
		placement="bottom-start"
		:variant="variant">
		<template v-if="referenceType !== 'none'">
			<NcActionButton v-for="offset in [0, 1, 2]"
				:key="offset"
				@click="selectOffset(offset)">
				<template #icon>
					<NcIconSvgWrapper :path="iconForOffset(offset)" />
				</template>
				{{ optionLabels[offset] }}
			</NcActionButton>
			<NcActionInput :aria-label="t('taskbook', 'Custom target date')"
				:is-native-picker="true"
				:label="t('taskbook', 'Custom date')"
				:model-value="customDate"
				type="date"
				@update:modelValue="selectCustomDate" />
		</template>
		<NcActionButton @click="selectTarget(null)">
			<template #icon>
				<NcIconSvgWrapper :path="iconPaths.calendarRemove" />
			</template>
			{{ t('taskbook', 'Later') }}
		</NcActionButton>
	</NcActions>
</template>
