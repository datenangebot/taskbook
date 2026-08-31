import { describe, expect, it } from 'vitest'
import { keyboardShortcutsDisabled, registerPeriodNavigationShortcuts, registerQuickAddShortcut } from './quickAddShortcut.ts'

type ShortcutEvent = Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'isComposing' | 'key' | 'metaKey' | 'shiftKey' | 'target'>

function shortcutEvent(overrides: Partial<ShortcutEvent> = {}): ShortcutEvent {
	return { altKey: false, ctrlKey: false, isComposing: false, key: 'N', metaKey: false, shiftKey: true, target: null, ...overrides }
}

function listenerTarget() {
	let listener: ((event: KeyboardEvent) => void) | undefined
	let registered = 0
	let removed = 0
	return {
		target: {
			addEventListener: (_type: 'keydown', nextListener: (event: KeyboardEvent) => void) => {
				listener = nextListener
				registered++
			},
			removeEventListener: (_type: 'keydown', nextListener: (event: KeyboardEvent) => void) => {
				if (listener === nextListener) {
					listener = undefined
				}
				removed++
			},
		},
		dispatch: (event: ShortcutEvent) => listener?.({ ...event, preventDefault: () => {} } as KeyboardEvent),
		registered: () => registered,
		removed: () => removed,
	}
}

describe('Quick Add shortcut', () => {
	it('opens Quick Add with Shift+N', () => {
		const source = listenerTarget()
		let opened = 0
		registerQuickAddShortcut(() => { opened++ }, source.target)
		source.dispatch(shortcutEvent())
		expect(opened).toBe(1)
	})

	it('does not open Quick Add with Alt+N or other modified N shortcuts', () => {
		const source = listenerTarget()
		let opened = 0
		registerQuickAddShortcut(() => { opened++ }, source.target)
		source.dispatch(shortcutEvent({ altKey: true, shiftKey: false }))
		source.dispatch(shortcutEvent({ ctrlKey: true }))
		source.dispatch(shortcutEvent({ metaKey: true }))
		expect(opened).toBe(0)
	})

	it('does not open Quick Add while typing in an input or textarea', () => {
		const source = listenerTarget()
		const input = { closest: (selector: string) => selector.includes('input') ? {} as Element : null } as unknown as EventTarget
		const textarea = { closest: (selector: string) => selector.includes('textarea') ? {} as Element : null } as unknown as EventTarget
		let opened = 0
		registerQuickAddShortcut(() => { opened++ }, source.target)
		source.dispatch(shortcutEvent({ target: input }))
		source.dispatch(shortcutEvent({ target: textarea }))
		expect(opened).toBe(0)
	})

	it('does not register when Nextcloud keyboard shortcuts are disabled', () => {
		expect(keyboardShortcutsDisabled({ disableKeyboardShortcuts: () => true })).toBe(true)
		expect(keyboardShortcutsDisabled({ disableKeyboardShortcuts: () => false })).toBe(false)
		const source = listenerTarget()
		let opened = 0
		registerQuickAddShortcut(() => { opened++ }, source.target, { disableKeyboardShortcuts: () => true })
		source.dispatch(shortcutEvent())
		expect(source.registered()).toBe(0)
		expect(opened).toBe(0)
	})

	it('removes its listener when the component unmounts', () => {
		const source = listenerTarget()
		let opened = 0
		const unregister = registerQuickAddShortcut(() => { opened++ }, source.target)
		unregister()
		source.dispatch(shortcutEvent())
		expect(source.removed()).toBe(1)
		expect(opened).toBe(0)
	})
})

describe('period navigation shortcuts', () => {
	it('maps the three strict Shift+Arrow shortcuts', () => {
		const source = listenerTarget()
		const actions: string[] = []
		registerPeriodNavigationShortcuts((action) => actions.push(action), source.target)
		source.dispatch(shortcutEvent({ key: 'ArrowLeft' }))
		source.dispatch(shortcutEvent({ key: 'ArrowRight' }))
		source.dispatch(shortcutEvent({ key: 'ArrowDown' }))
		expect(actions).toEqual(['previous', 'next', 'current'])
	})

	it('ignores editable targets and other modifier combinations', () => {
		const source = listenerTarget()
		const input = { closest: (selector: string) => selector.includes('input') ? {} as Element : null } as unknown as EventTarget
		let navigated = 0
		registerPeriodNavigationShortcuts(() => { navigated++ }, source.target)
		source.dispatch(shortcutEvent({ key: 'ArrowRight', target: input }))
		source.dispatch(shortcutEvent({ key: 'ArrowRight', ctrlKey: true }))
		source.dispatch(shortcutEvent({ key: 'ArrowRight', altKey: true }))
		source.dispatch(shortcutEvent({ key: 'ArrowRight', metaKey: true }))
		expect(navigated).toBe(0)
	})

	it('does not register when Nextcloud keyboard shortcuts are disabled', () => {
		const source = listenerTarget()
		registerPeriodNavigationShortcuts(() => {}, source.target, { disableKeyboardShortcuts: () => true })
		expect(source.registered()).toBe(0)
	})
})
