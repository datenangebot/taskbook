<script setup lang="ts">
import type { EntryGroupSummary } from '../utils/periodLayout.ts'

import { t } from '@nextcloud/l10n'

defineProps<{ summary: EntryGroupSummary }>()
</script>

<template>
	<dl :class="$style.summary" data-taskbook-calendar-summary>
		<div :class="$style.row">
			<dt :class="$style.label">
				{{ t('taskbook', 'Open') }}
			</dt>
			<dd :class="$style.value">
				{{ summary.open }}
			</dd>
		</div>
		<div :class="$style.row">
			<dt :class="$style.label">
				{{ t('taskbook', 'Closed') }}
			</dt>
			<dd :class="$style.value">
				{{ summary.closed }}
			</dd>
		</div>
	</dl>
</template>

<style module>
.summary {
	display: grid;
	width: max-content;
	max-width: 100%;
	align-self: center;
	grid-template-columns: max-content max-content;
	gap: 0 calc(var(--default-grid-baseline, 4px) * 2);
	margin: calc(var(--default-grid-baseline, 4px) / 2) auto 0;
	padding: 0;
	color: var(--color-text-maxcontrast);
	font-size: .85rem;
	line-height: 1.2;
}

.row { display: contents; }

.label,
.value {
	width: auto;
	min-width: 0;
	min-height: 0;
	margin: 0;
	padding: 0;
	line-height: inherit;
}

.label { text-align: start; }

.value { text-align: end; font-variant-numeric: tabular-nums; }
</style>
