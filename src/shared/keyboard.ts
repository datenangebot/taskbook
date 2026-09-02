type ShortcutEvent = Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'isComposing' | 'key' | 'metaKey' | 'shiftKey' | 'target'>
type ClosestTarget = EventTarget & { closest?: (selector: string) => Element | null }

export type PeriodNavigationAction = 'previous' | 'next' | 'current'
export type ItemRowAction = 'edit' | 'toggle' | 'delete' | 'leave'

const editableSelector = 'input, textarea, select, [contenteditable="true"], [role="textbox"]'

export function isEditableTarget(target: EventTarget | null): boolean {
	const element = target as ClosestTarget | null
	return typeof element?.closest === 'function' && element.closest(editableSelector) !== null
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
	if (event.isComposing || !event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || isEditableTarget(event.target)) { return undefined }
	if (event.key === 'ArrowLeft') { return 'previous' }
	if (event.key === 'ArrowRight') { return 'next' }
	return event.key === 'ArrowDown' ? 'current' : undefined
}

export function itemRowAction(key: string, compact: boolean): ItemRowAction | undefined {
	if (key === ' ') { return 'toggle' }
	if (key === 'Escape') { return 'leave' }
	if (!compact && key === 'Enter') { return 'edit' }
	return !compact && key === 'Delete' ? 'delete' : undefined
}

export function itemShortcutsAllowed(event: KeyboardEvent, disabled = false): boolean {
	return !disabled
		&& !event.isComposing
		&& !event.altKey
		&& !event.ctrlKey
		&& !event.metaKey
		&& !event.shiftKey
		&& !isEditableTarget(event.target)
		&& event.target === event.currentTarget
}

export function itemNavigationIndex(current: number, length: number, key: 'ArrowDown' | 'ArrowUp' | 'Home' | 'End'): number {
	if (length <= 0) { return -1 }
	if (key === 'Home') { return 0 }
	if (key === 'End') { return length - 1 }
	return key === 'ArrowDown' ? Math.min(current + 1, length - 1) : Math.max(current - 1, 0)
}
