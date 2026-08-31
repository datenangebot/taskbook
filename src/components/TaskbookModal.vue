<script setup lang="ts">
import { useId } from 'vue'
import NcModal from '@nextcloud/vue/components/NcModal'

withDefaults(defineProps<{
	name: string
	size?: 'small' | 'normal' | 'large'
}>(), {
	size: 'normal',
})

defineEmits<{ close: [] }>()

const titleId = useId()
</script>

<template>
	<NcModal :label-id="titleId"
		name=""
		:size="size"
		@close="$emit('close')">
		<section :class="$style.shell">
			<header :class="$style.header">
				<h2 :id="titleId">
					{{ name }}
				</h2>
			</header>
			<div :class="$style.content">
				<slot />
			</div>
			<footer v-if="$slots.actions" :class="$style.actions">
				<slot name="actions" />
			</footer>
		</section>
	</NcModal>
</template>

<style module>
.shell { display: flex; min-height: 100%; flex-direction: column; }

.header { padding: calc(var(--default-grid-baseline, 4px) * 5) calc(var(--default-grid-baseline, 4px) * 5) 0; }

.header h2 { margin: 0; font-size: 1.25rem; line-height: 1.35; }

.content { padding: calc(var(--default-grid-baseline, 4px) * 4) calc(var(--default-grid-baseline, 4px) * 5); }

.actions { display: flex; justify-content: end; gap: calc(var(--default-grid-baseline, 4px) * 2); padding: 0 calc(var(--default-grid-baseline, 4px) * 5) calc(var(--default-grid-baseline, 4px) * 5); }
</style>
