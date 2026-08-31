import { describe, expect, it } from 'vitest'
import { displayReferenceTarget } from './dates.ts'

const translations = {
	later: 'Later',
	week: (week: string, year: string) => `W${week} ${year}`,
}

describe('displayReferenceTarget', () => {
	it('formats resolved day, week, month and later targets', () => {
		expect(displayReferenceTarget('day', '2026-08-29', translations)).not.toBe('Today')
		expect(displayReferenceTarget('week', '2026-08-29', translations)).toBe('W35 2026')
		expect(displayReferenceTarget('month', '2026-08-29', translations)).toBe('2026-08')
		expect(displayReferenceTarget('none', null, translations)).toBe('Later')
	})

	it('uses the ISO week-year at year boundaries', () => {
		expect(displayReferenceTarget('week', '2027-01-01', translations)).toBe('W53 2026')
	})
})
