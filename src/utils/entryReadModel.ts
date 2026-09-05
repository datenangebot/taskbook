import type { Ref } from 'vue'
import type { EntryChange } from '../state.ts'

import { shallowRef, watch } from 'vue'

// Refresh server-derived views after mutations; a late response cannot undo a newer one.
export function entryReadModel<T>(changes: Ref<EntryChange | null>, fetch: () => Promise<T>, onError: () => void) {
	const data = shallowRef<T | null>(null)
	const loading = shallowRef(true)
	let requestId = 0
	async function reload() {
		const current = ++requestId
		loading.value = data.value === null
		try {
			const response = await fetch()
			if (current === requestId) { data.value = response }
		} catch {
			if (current === requestId) { onError() }
		} finally {
			if (current === requestId) { loading.value = false }
		}
	}
	watch(changes, (change) => { if (change !== null) { void reload() } })
	return { data, loading, reload }
}
