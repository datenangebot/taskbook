import type { EntryChange } from '../state.ts'
import type { Entry } from '../types.ts'

import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { entryReadModel } from './entryReadModel.ts'

describe('mutation-driven canonical read models', () => {
	it('applies newly created Future entries and refreshed overdue counts without navigation', async () => {
		const scope = effectScope()
		const changes = ref<EntryChange | null>(null)
		const fetch = vi.fn().mockResolvedValueOnce({ entries: [], count: 0 }).mockResolvedValueOnce({ entries: [42], count: 1 }).mockResolvedValueOnce({ entries: [], count: 0 })
		const model = scope.run(() => entryReadModel(changes, fetch, vi.fn()))!
		await model.reload()
		changes.value = { entry: { id: 42 } as Entry }
		await nextTick()
		await Promise.resolve()
		expect(model.data.value).toEqual({ entries: [42], count: 1 })
		changes.value = { deletedId: 42 }
		await nextTick()
		await Promise.resolve()
		expect(model.data.value).toEqual({ entries: [], count: 0 })
		scope.stop()
	})

	it('does not let a slow earlier response restore a stale count', async () => {
		const scope = effectScope()
		let resolveEarlier!: (count: number) => void
		const fetch = vi.fn().mockReturnValueOnce(new Promise<number>((resolve) => { resolveEarlier = resolve })).mockResolvedValueOnce(0)
		const model = scope.run(() => entryReadModel(ref(null), fetch, vi.fn()))!
		const earlier = model.reload()
		await model.reload()
		resolveEarlier(4)
		await earlier
		expect(model.data.value).toBe(0)
		expect(model.loading.value).toBe(false)
		scope.stop()
	})
})
