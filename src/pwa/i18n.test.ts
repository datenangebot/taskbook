import { describe, expect, it } from 'vitest'
import { translatePwa } from './i18n.ts'

describe('PWA localization', () => {
	it('uses the cached German catalog and falls back to English source strings', () => {
		expect(translatePwa('day', 'Day', 'de-DE')).toBe('Tag')
		expect(translatePwa('futureLog', 'Future Log', 'de-DE')).toBe('Zukunftslog')
		expect(translatePwa('overdue', 'Overdue', 'de-DE')).toBe('Überfällig')
		expect(translatePwa('syncNow', 'Synchronization', 'de-DE')).toBe('Synchronisierung')
		expect(translatePwa('missing', 'English fallback', 'de-CH')).toBe('English fallback')
	})
})
