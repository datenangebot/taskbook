import { describe, expect, it } from 'vitest'
import { pwaRefreshShortcut, pwaViewShortcut } from './keyboard.ts'

function event(key: string, target: EventTarget | null = null) {
	return { key, target, shiftKey: true, ctrlKey: false, altKey: false, metaKey: false, isComposing: false }
}

describe('PWA view shortcuts', () => {
	it('keeps Shift+D and Shift+F without assigning an overdue shortcut', () => {
		expect(pwaViewShortcut(event('D'))).toBe('day')
		expect(pwaViewShortcut(event('f'))).toBe('future')
		expect(pwaViewShortcut(event('o'))).toBeUndefined()
	})

	it('does not navigate while an editor is active', () => {
		const input = { closest: () => ({}) } as unknown as EventTarget
		expect(pwaViewShortcut(event('d', input))).toBeUndefined()
	})

	it('maps only unmodified Shift+R to synchronization refresh', () => {
		expect(pwaRefreshShortcut(event('R'))).toBe(true)
		expect(pwaRefreshShortcut({ ...event('R'), ctrlKey: true })).toBe(false)
		expect(pwaRefreshShortcut({ ...event('R'), metaKey: true })).toBe(false)
		expect(pwaRefreshShortcut({ ...event('r'), shiftKey: false })).toBe(false)
		const dialog = { closest: () => ({}) } as unknown as EventTarget
		expect(pwaRefreshShortcut(event('R', dialog))).toBe(false)
	})
})
