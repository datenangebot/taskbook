type ShortcutEvent = Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'isComposing' | 'key' | 'metaKey' | 'shiftKey' | 'target'>
type ClosestTarget = EventTarget & { closest?: (selector: string) => Element | null }
type AccessibilitySettings = { disableKeyboardShortcuts?: () => boolean }
type ShortcutListener = (event: KeyboardEvent) => void
type ShortcutListenerTarget = {
	addEventListener: (type: 'keydown', listener: ShortcutListener) => void
	removeEventListener: (type: 'keydown', listener: ShortcutListener) => void
}
export type PeriodNavigationAction = 'previous' | 'next' | 'current'

const editableSelector = 'input, textarea, select, [contenteditable="true"], [role="textbox"]'

export function isEditableTarget(target: EventTarget | null): boolean {
	const element = target as ClosestTarget | null
	return typeof element?.closest === 'function' && element.closest(editableSelector) !== null
}

export function keyboardShortcutsDisabled(accessibility: AccessibilitySettings | undefined = (globalThis as typeof globalThis & { OCP?: { Accessibility?: AccessibilitySettings } }).OCP?.Accessibility): boolean {
	return accessibility?.disableKeyboardShortcuts?.() === true
}

export function isQuickAddShortcut(event: ShortcutEvent): boolean {
	return !event.isComposing
		&& event.shiftKey
		&& !event.ctrlKey
		&& !event.altKey
		&& !event.metaKey
		&& event.key.toLowerCase() === 'n'
		&& !isEditableTarget(event.target)
}

export function periodNavigationAction(event: ShortcutEvent): PeriodNavigationAction | undefined {
	if (event.isComposing || !event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || isEditableTarget(event.target)) {
		return undefined
	}
	if (event.key === 'ArrowLeft') {
		return 'previous'
	}
	if (event.key === 'ArrowRight') {
		return 'next'
	}
	return event.key === 'ArrowDown' ? 'current' : undefined
}

export function registerQuickAddShortcut(onQuickAdd: () => void, eventTarget: ShortcutListenerTarget = window, accessibility?: AccessibilitySettings): () => void {
	if (keyboardShortcutsDisabled(accessibility)) {
		return () => {}
	}

	const onKeydown: ShortcutListener = (event) => {
		if (!isQuickAddShortcut(event)) {
			return
		}
		event.preventDefault()
		onQuickAdd()
	}
	eventTarget.addEventListener('keydown', onKeydown)
	return () => eventTarget.removeEventListener('keydown', onKeydown)
}

export function registerPeriodNavigationShortcuts(onNavigate: (action: PeriodNavigationAction) => void, eventTarget: ShortcutListenerTarget = window, accessibility?: AccessibilitySettings): () => void {
	if (keyboardShortcutsDisabled(accessibility)) {
		return () => {}
	}

	const onKeydown: ShortcutListener = (event) => {
		const action = periodNavigationAction(event)
		if (action === undefined) {
			return
		}
		event.preventDefault()
		onNavigate(action)
	}
	eventTarget.addEventListener('keydown', onKeydown)
	return () => eventTarget.removeEventListener('keydown', onKeydown)
}
