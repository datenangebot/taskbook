import { describe, expect, it, vi } from 'vitest'
import { createViewRefreshRegistry } from './viewRefreshRegistry.ts'

describe('view refresh registry', () => {
	it('refreshes Overview and Future Log exactly once through their route registrations', () => {
		const registry = createViewRefreshRegistry()
		const overview = vi.fn()
		const future = vi.fn()
		registry.register('overview', overview)
		registry.register('future', future)

		expect(registry.refresh('overview')).toBe(true)
		expect(registry.refresh('future')).toBe(true)
		expect(overview).toHaveBeenCalledTimes(1)
		expect(future).toHaveBeenCalledTimes(1)
	})

	it('does not let stale route cleanup clear a newer registration', () => {
		const registry = createViewRefreshRegistry()
		const oldRefresh = vi.fn()
		const newRefresh = vi.fn()
		const unregisterOld = registry.register('future', oldRefresh)
		registry.register('future', newRefresh)
		unregisterOld()

		registry.refresh('future')
		expect(oldRefresh).not.toHaveBeenCalled()
		expect(newRefresh).toHaveBeenCalledTimes(1)
	})
})
