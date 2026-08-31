<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'

const props = withDefaults(defineProps<{
	modelValue: boolean
	variant?: 'secondary' | 'tertiary'
}>(), { variant: 'secondary' })
const emit = defineEmits<{ 'update:modelValue': [value: boolean], selected: [] }>()

function toggle() {
	emit('update:modelValue', !props.modelValue)
	emit('selected')
}
</script>

<template>
	<NcButton :aria-label="modelValue ? t('taskbook', 'Remove priority') : t('taskbook', 'Mark as important')"
		:class="$style.button"
		:pressed="modelValue"
		:text="modelValue ? '!' : '\u00a0'"
		:title="modelValue ? t('taskbook', 'Remove priority') : t('taskbook', 'Mark as important')"
		:variant="variant"
		@click="toggle" />
</template>

<style module>
.button { width: var(--default-clickable-area); min-width: var(--default-clickable-area); font-size: 1.25rem; font-weight: var(--font-weight-bold); }
</style>
