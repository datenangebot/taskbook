<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import { generateUrl } from '@nextcloud/router'
import NcButton from '@nextcloud/vue/components/NcButton'
import TaskbookModal from './TaskbookModal.vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const bankMail = 'mailto:support@datenangebot.de?subject=Bank%20transfer%20details&body=Hello%2C%0A%0AI%20would%20like%20to%20support%20your%20open-source%20work%20by%20bank%20transfer.%0ACould%20you%20please%20send%20me%20the%20bank%20details%3F%0A%0AThank%20you.'

function close() {
	emit('update:open', false)
}
</script>

<template>
	<TaskbookModal v-if="open"
		:name="t('taskbook', 'Support open-source development')"
		size="normal"
		@close="close">
		<div :class="$style.copy">
			<p>{{ t('taskbook', 'I’m passionate about building useful, privacy-respecting open-source software that gives people more control over their digital lives.') }}</p>
			<p>{{ t('taskbook', 'Contributions help support development, maintenance, testing, documentation, infrastructure, and the time needed to keep these projects useful and evolving.') }}</p>
			<p>{{ t('taskbook', 'Every contribution, large or small, is also a meaningful sign that this work matters to someone.') }}</p>
			<section>
				<h3>{{ t('taskbook', 'PayPal') }}</h3>
				<p>{{ t('taskbook', 'Make a donation via PayPal.') }}</p>
				<NcButton href="https://www.paypal.com/donate/?hosted_button_id=3NBB57F2WUFTN" target="_blank" :text="t('taskbook', 'Donate with PayPal')">
					<template #icon>
						<img :alt="t('taskbook', 'PayPal')" :src="generateUrl('/apps/taskbook/img/donation/paypal.svg')">
					</template>
				</NcButton>
			</section>
			<section>
				<h3>{{ t('taskbook', 'Bank transfer') }}</h3>
				<p>{{ t('taskbook', 'Bank transfer details can be requested personally by email.') }}</p>
				<NcButton :href="bankMail" :text="t('taskbook', 'Request bank details')" />
			</section>
			<p :class="$style.note">
				{{ t('taskbook', 'Support does not buy feature priority, guaranteed support, or access to private data.') }}
			</p>
		</div>
		<template #actions>
			<NcButton :text="t('taskbook', 'Close')" @click="close" />
		</template>
	</TaskbookModal>
</template>

<style module>
.copy { display: flex; flex-direction: column; gap: calc(var(--default-grid-baseline, 4px) * 3); }

.copy p, .copy h3 { margin: 0; }

.copy p { line-height: 1.55; }

.copy section { display: flex; flex-direction: column; gap: calc(var(--default-grid-baseline, 4px) * 2); }

.copy h3 { font-size: 1.1rem; }

.copy img { width: 24px; height: 24px; }

.note { color: var(--color-text-maxcontrast); }
</style>
