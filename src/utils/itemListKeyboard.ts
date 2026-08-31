import { isEditableTarget, keyboardShortcutsDisabled } from './quickAddShortcut.ts'

type ItemNavigationKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End'
export type ItemRowAction = 'edit' | 'toggle' | 'delete' | 'leave'
type ItemShortcutTarget = {
	addEventListener: (type: 'keydown', listener: (event: KeyboardEvent) => void) => void
	removeEventListener: (type: 'keydown', listener: (event: KeyboardEvent) => void) => void
}

export function itemNavigationIndex(current: number, length: number, key: ItemNavigationKey): number {
	if (length <= 0) {
		return -1
	}
	if (key === 'Home') {
		return 0
	}
	if (key === 'End') {
		return length - 1
	}
	return key === 'ArrowDown' ? Math.min(current + 1, length - 1) : Math.max(current - 1, 0)
}

function itemShortcutEventAllowed(event: KeyboardEvent): boolean {
	return !keyboardShortcutsDisabled()
		&& !event.isComposing
		&& !event.altKey
		&& !event.ctrlKey
		&& !event.metaKey
		&& !event.shiftKey
		&& !isEditableTarget(event.target)
}

export function itemShortcutsAllowed(event: KeyboardEvent): boolean {
	return itemShortcutEventAllowed(event) && event.target === event.currentTarget
}

export function itemRowAction(key: string, compact: boolean): ItemRowAction | undefined {
	if (key === ' ') {
		return 'toggle'
	}
	if (key === 'Escape') {
		return 'leave'
	}
	if (!compact && key === 'Enter') {
		return 'edit'
	}
	return !compact && key === 'Delete' ? 'delete' : undefined
}

export function activateItemRow(row: HTMLElement) {
	for (const item of itemRowsFor(row)) {
		item.tabIndex = item === row ? 0 : -1
	}
}

function isVisible(item: HTMLElement): boolean {
	return item.getClientRects().length > 0
}

function itemScopeFor(row: HTMLElement): ParentNode | null {
	return row.closest<HTMLElement>('[role="dialog"][aria-modal="true"]')
		?? row.closest<HTMLElement>('[data-taskbook-navigation-scope]')
		?? row.closest<HTMLElement>('[data-taskbook-entry-list]')
}

function itemRowsFor(row: HTMLElement): HTMLElement[] {
	return [...(itemScopeFor(row)?.querySelectorAll<HTMLElement>('[data-taskbook-entry-row]') ?? [])].filter(isVisible)
}

export function focusInitialItem(event: KeyboardEvent, items: HTMLElement[]): boolean {
	if (event.defaultPrevented || !['ArrowDown', 'ArrowUp'].includes(event.key) || !itemShortcutEventAllowed(event) || items.length === 0) {
		return false
	}
	event.preventDefault()
	activateItemRow(items[0])
	items[0].focus()
	return true
}

function visibleDialog(root: ParentNode): HTMLElement | undefined {
	return [...root.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')].filter(isVisible).at(-1)
}

export function registerImmediateItemNavigation(
	pageScope: () => ParentNode | null,
	eventTarget: ItemShortcutTarget = window,
	dialogRoot: ParentNode = document,
): () => void {
	const onKeydown = (event: KeyboardEvent) => {
		const dialog = visibleDialog(dialogRoot)
		const scope = dialog ?? pageScope()
		if (scope === null) {
			return
		}
		const items = [...scope.querySelectorAll<HTMLElement>('[data-taskbook-entry-row]')].filter(isVisible)
		focusInitialItem(event, items)
	}
	eventTarget.addEventListener('keydown', onKeydown)
	return () => eventTarget.removeEventListener('keydown', onKeydown)
}

export function handleItemListNavigation(event: KeyboardEvent): boolean {
	if (!itemShortcutsAllowed(event) || !(['ArrowDown', 'ArrowUp', 'Home', 'End'] as string[]).includes(event.key)) {
		return false
	}
	const row = event.currentTarget as HTMLElement
	const items = itemRowsFor(row)
	const current = items.indexOf(row)
	if (current === -1) {
		return false
	}
	const next = itemNavigationIndex(current, items.length, event.key as ItemNavigationKey)
	event.preventDefault()
	if (next !== current) {
		activateItemRow(items[next])
		items[next].focus()
	}
	return true
}
