import { describe, expect, it } from 'vitest'
import { focusInitialItem, itemNavigationIndex, itemRowAction, itemShortcutsAllowed } from './itemListKeyboard.ts'

describe('item list keyboard navigation', () => {
	it('moves with arrows and Home/End without wrapping', () => {
		expect(itemNavigationIndex(1, 4, 'ArrowDown')).toBe(2)
		expect(itemNavigationIndex(1, 4, 'ArrowUp')).toBe(0)
		expect(itemNavigationIndex(2, 4, 'Home')).toBe(0)
		expect(itemNavigationIndex(1, 4, 'End')).toBe(3)
		expect(itemNavigationIndex(3, 4, 'ArrowDown')).toBe(3)
		expect(itemNavigationIndex(0, 4, 'ArrowUp')).toBe(0)
	})

	it('ignores editable targets, modifiers and disabled Nextcloud shortcuts', () => {
		const row = {} as EventTarget
		const input = { closest: (selector: string) => selector.includes('input') ? {} as Element : null } as unknown as EventTarget
		const event = (target: EventTarget, overrides: Partial<KeyboardEvent> = {}) => ({
			altKey: false,
			ctrlKey: false,
			currentTarget: row,
			isComposing: false,
			metaKey: false,
			shiftKey: false,
			target,
			...overrides,
		}) as KeyboardEvent
		expect(itemShortcutsAllowed(event(input))).toBe(false)
		expect(itemShortcutsAllowed(event(row, { shiftKey: true }))).toBe(false)

		const environment = globalThis as typeof globalThis & { OCP?: { Accessibility?: { disableKeyboardShortcuts?: () => boolean } } }
		const previousOcp = environment.OCP
		environment.OCP = { Accessibility: { disableKeyboardShortcuts: () => true } }
		expect(itemShortcutsAllowed(event(row))).toBe(false)
		environment.OCP = previousOcp
	})

	it('keeps edit and delete out of compact rows while allowing completion', () => {
		expect(itemRowAction('Enter', false)).toBe('edit')
		expect(itemRowAction('Delete', false)).toBe('delete')
		expect(itemRowAction(' ', false)).toBe('toggle')
		expect(itemRowAction('Enter', true)).toBeUndefined()
		expect(itemRowAction('Delete', true)).toBeUndefined()
		expect(itemRowAction(' ', true)).toBe('toggle')
	})

	it('focuses the first item with either vertical arrow without a preceding Tab', () => {
		let focused = 0
		let prevented = 0
		const row = {
			closest: () => null,
			focus: () => { focused++ },
			getClientRects: () => [1],
			tabIndex: -1,
		} as unknown as HTMLElement
		const event = (key: 'ArrowDown' | 'ArrowUp') => ({
			altKey: false,
			ctrlKey: false,
			currentTarget: null,
			defaultPrevented: false,
			isComposing: false,
			key,
			metaKey: false,
			preventDefault: () => { prevented++ },
			shiftKey: false,
			target: null,
		}) as unknown as KeyboardEvent
		expect(focusInitialItem(event('ArrowDown'), [row])).toBe(true)
		expect(focusInitialItem(event('ArrowUp'), [row])).toBe(true)
		expect(focused).toBe(2)
		expect(prevented).toBe(2)
	})
})
