import { afterEach, describe, expect, it, vi } from 'vitest'
import { randomUuid } from './identity.ts'

afterEach(() => vi.unstubAllGlobals())

describe('randomUuid', () => {
	it('uses the browser implementation when available', () => {
		const randomUUID = vi.fn(() => '7f1d5b5a-b29b-4fd5-88e6-f3d2879cba94')
		vi.stubGlobal('crypto', { randomUUID })

		expect(randomUuid()).toBe('7f1d5b5a-b29b-4fd5-88e6-f3d2879cba94')
		expect(randomUUID).toHaveBeenCalledOnce()
	})

	it('creates an RFC 4122 version 4 UUID from getRandomValues when randomUUID is unavailable', () => {
		vi.stubGlobal('crypto', {
			getRandomValues: (bytes: Uint8Array) => {
				bytes.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
				return bytes
			},
		})

		expect(randomUuid()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
	})
})
