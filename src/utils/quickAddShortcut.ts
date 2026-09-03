type ShortcutEvent = Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'isComposing' | 'key' | 'metaKey' | 'shiftKey' | 'target'>
type ClosestTarget = EventTarget & { closest?: (selector: string) => Element | null }
type AccessibilitySettings = { disableKeyboardShortcuts?: () => boolean }
type ShortcutListener = (event: KeyboardEvent) => void
type ShortcutListenerTarget = {
	addEventListener: (type: 'keydown', listener: ShortcutListener) => void
	removeEventListener: (type: 'keydown', listener: ShortcutListener) => void
}
export type PeriodNavigationAction = 'previous' | 'next' | 'current'
export type ViewNavigationAction = 'overview' | 'day' | 'week' | 'month' | 'future'

interface TaskbookShortcutHandlers {
	onQuickAdd: () => void
	onViewNavigation: (action: ViewNavigationAction) => void
}

const editableSelector = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
const interactionOwnerSelector = '[data-taskbook-editor-active="true"], [role="dialog"]'
const modalSelector = '[role="dialog"][aria-modal="true"]'
const viewNavigationActions: Record<string, ViewNavigationAction> = {
	o: 'overview',
	d: 'day',
	w: 'week',
	m: 'month',
	f: 'future',
}

export function isEditableTarget(target: EventTarget | null): boolean {
	const element = target as ClosestTarget | null
	return typeof element?.closest === 'function' && element.closest(editableSelector) !== null
}

function ownsShortcutInteraction(target: EventTarget | null): boolean {
	const element = target as ClosestTarget | null
	return typeof element?.closest === 'function' && element.closest(interactionOwnerSelector) !== null
}

function visibleModalIsOpen(): boolean {
	if (typeof document === 'undefined') {
		return false
	}
	return [...document.querySelectorAll<HTMLElement>(modalSelector)].some((dialog) => dialog.getClientRects().length > 0)
}

export function keyboardShortcutsDisabled(accessibility: AccessibilitySettings | undefined = (globalThis as typeof globalThis & { OCP?: { Accessibility?: AccessibilitySettings } }).OCP?.Accessibility): boolean {
	return accessibility?.disableKeyboardShortcuts?.() === true
}

export function globalShortcutAllowed(event: ShortcutEvent): boolean {
	return !event.isComposing
		&& event.shiftKey
		&& !event.ctrlKey
		&& !event.altKey
		&& !event.metaKey
		&& !isEditableTarget(event.target)
		&& !ownsShortcutInteraction(event.target)
		&& !visibleModalIsOpen()
}

export function isQuickAddShortcut(event: ShortcutEvent): boolean {
	return globalShortcutAllowed(event) && event.key.toLowerCase() === 'n'
}

export function periodNavigationAction(event: ShortcutEvent): PeriodNavigationAction | undefined {
	if (!globalShortcutAllowed(event)) {
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

export function viewNavigationAction(event: ShortcutEvent): ViewNavigationAction | undefined {
	if (!globalShortcutAllowed(event)) {
		return undefined
	}
	return viewNavigationActions[event.key.toLowerCase()]
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

export function registerTaskbookShortcuts({ onQuickAdd, onViewNavigation }: TaskbookShortcutHandlers, eventTarget: ShortcutListenerTarget = window, accessibility?: AccessibilitySettings): () => void {
	if (keyboardShortcutsDisabled(accessibility)) {
		return () => {}
	}

	const onKeydown: ShortcutListener = (event) => {
		if (isQuickAddShortcut(event)) {
			event.preventDefault()
			onQuickAdd()
			return
		}
		const action = viewNavigationAction(event)
		if (action === undefined) {
			return
		}
		event.preventDefault()
		onViewNavigation(action)
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
