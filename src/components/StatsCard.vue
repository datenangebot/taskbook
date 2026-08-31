<script setup lang="ts">
defineProps<{
	label: string
	value: number
}>()
</script>

<template>
	<div :class="$style.card" data-taskbook-stat-card>
		<div :class="$style.content" data-taskbook-stat-content>
			<span :class="$style.value">
				{{ value }}
			</span>
			<span :class="$style.label">
				{{ label }}
			</span>
		</div>
	</div>
</template>

<style module>
.card {
	display: flex;
	min-width: 0;
	box-sizing: border-box;
	align-items: center;
	justify-content: center;
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-large);
	padding: 8px;
	text-align: center;
}

.content {
	display: flex;
	width: 100%;
	min-width: 0;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
}

.value,
.label {
	width: 100%;
	margin: 0;
	text-align: center;
}

.value {
	font-size: 1.35rem;
	font-weight: var(--font-weight-bold);
	line-height: 1.3;
}

.label {
	color: var(--color-text-maxcontrast);
	font-size: .85rem;
	line-height: 1.3;
}
</style>
