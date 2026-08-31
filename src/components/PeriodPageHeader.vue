<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import { iconPaths } from '../icons.ts'

defineProps<{ title: string, currentLabel: string, current: boolean }>()
const emit = defineEmits<{ previous: [], current: [], next: [], create: [] }>()
</script>

<template>
	<header class="taskbook-page-header">
		<h1 class="taskbook-page-heading">
			{{ title }}
		</h1>
		<div class="taskbook-period-navigation">
			<NcButton :aria-label="t('taskbook', 'Previous period')"
				:title="t('taskbook', 'Previous period')"
				variant="tertiary"
				@click="emit('previous')">
				<template #icon>
					<NcIconSvgWrapper :path="iconPaths.chevronLeft" />
				</template>
			</NcButton>
			<NcButton :disabled="current"
				:text="currentLabel"
				variant="tertiary"
				@click="emit('current')" />
			<NcButton :aria-label="t('taskbook', 'Next period')"
				:title="t('taskbook', 'Next period')"
				variant="tertiary"
				@click="emit('next')">
				<template #icon>
					<NcIconSvgWrapper :path="iconPaths.chevronRight" />
				</template>
			</NcButton>
			<NcButton :aria-label="t('taskbook', 'New entry')"
				:title="t('taskbook', 'New entry')"
				variant="primary"
				@click="emit('create')">
				<template #icon>
					<NcIconSvgWrapper :path="iconPaths.plus" />
				</template>
			</NcButton>
		</div>
	</header>
</template>
