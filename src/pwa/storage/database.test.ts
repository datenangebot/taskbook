import { describe, expect, it } from 'vitest'
import { DATABASE_VERSION, schemaUpgradeSteps } from './database.ts'

describe('PWA IndexedDB schema migrations', () => {
	it('applies every migration to a new database', () => {
		expect(DATABASE_VERSION).toBe(3)
		expect(schemaUpgradeSteps(0)).toEqual([1, 2, 3])
	})

	it('adds conflicts and diagnostics without replacing earlier stores', () => {
		expect(schemaUpgradeSteps(1)).toEqual([2, 3])
		expect(schemaUpgradeSteps(2)).toEqual([3])
		expect(schemaUpgradeSteps(3)).toEqual([])
	})
})
