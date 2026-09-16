<script setup lang="ts">
import type { Context } from '../types.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, inject } from 'vue'
import NcActionCheckbox from '@nextcloud/vue/components/NcActionCheckbox'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import { iconPaths } from '../icons.ts'
import { contextFilterKey, contextsFrom, settingsKey } from '../state.ts'

const settings = inject(settingsKey)
const selectedIds = inject(contextFilterKey)
const contexts = computed(() => contextsFrom(settings?.value ?? null))
const selectedCount = computed(() => selectedIds?.value.length ?? 0)
const filterLabel = computed(() => selectedCount.value === 0
	? t('taskbook', 'Filter by context')
	: n('taskbook', 'Filter by context, {count} selected', 'Filter by context, {count} selected', selectedCount.value, { count: selectedCount.value }))

function selected(context: Context): boolean {
	return selectedIds?.value.includes(context.id) ?? false
}

function setSelected(context: Context, active: boolean) {
	if (selectedIds === undefined) {
		return
	}
	selectedIds.value = active
		? [...new Set([...selectedIds.value, context.id])]
		: selectedIds.value.filter((id) => id !== context.id)
}
</script>

<template>
	<NcActions :aria-label="filterLabel"
		:disabled="contexts.length === 0"
		force-menu
		placement="bottom-start"
		variant="tertiary">
		<template #icon>
			<NcIconSvgWrapper :path="selectedCount === 0 ? iconPaths.filter : iconPaths.filterCheck" />
		</template>
		<NcActionCheckbox v-for="context in contexts"
			:key="context.id"
			:model-value="selected(context)"
			:value="context.id"
			@update:modelValue="setSelected(context, $event)">
			{{ context.icon }} {{ context.title }}
		</NcActionCheckbox>
	</NcActions>
</template>
