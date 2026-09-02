import type { Context, EntryRequest, EntryType, ReferenceType } from '../shared/types.ts'
import type { CoordinatorState } from './sync/coordinator.ts'
import type { PwaBootstrap, SyncConflict, SyncEntry } from './types.ts'

import { addDays, dateForReference, dateKey, displayDate, displayMonth, monthStart } from '../shared/dates.ts'
import { dayEntryGroups } from '../shared/entryGrouping.ts'
import { isQuickAddShortcut, itemNavigationIndex, itemRowAction, itemShortcutsAllowed, periodNavigationAction } from '../shared/keyboard.ts'
import { parseRapidCapture } from '../shared/rapidLogging.ts'
import { LoginFlowError, pollLogin, startLogin } from './api/loginFlow.ts'
import { revokeAppPassword } from './api/transport.ts'
import { diagnosticFileName, diagnostics, errorMetadata, installGlobalDiagnosticHandlers } from './diagnostics.ts'
import { translatePwa } from './i18n.ts'
import { clearLocalData, getAccount, keepLocalConflict, listConflicts, listContexts, listEntries, putAccount, setDatabaseDiagnosticReporter, useServerConflict } from './storage/database.ts'
import { newMutation } from './storage/outbox.ts'
import { announceRepositoryChange, createEntry, deleteEntry, onRepositoryChange, toggleEntry, updateEntry } from './storage/repository.ts'
import { SyncCoordinator } from './sync/coordinator.ts'

import './styles.css'

type InstallPrompt = Event & { prompt: () => Promise<void>, userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const root = document.querySelector<HTMLElement>('#taskbook-pwa') as HTMLElement
if (root === null) {
	throw new Error('Taskbook PWA root is missing.')
}
const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
if (iconLink === null) {
	throw new Error('Taskbook PWA icon is missing.')
}
const marker = '/apps/taskbook/pwa/'
const markerIndex = window.location.pathname.indexOf(marker)
if (markerIndex < 0) {
	throw new Error('Taskbook PWA route is invalid.')
}
const routePrefix = window.location.pathname.slice(0, markerIndex)
const webroot = routePrefix.endsWith('/index.php') ? routePrefix.slice(0, -'/index.php'.length) : routePrefix
const bootstrap: PwaBootstrap = {
	appPasswordRevokePath: `${webroot}/ocs/v2.php/core/apppassword`,
	loginFlowPath: `${webroot}/index.php/login/v2`,
	iconUrl: iconLink.href,
	manifestUrl: new URL('manifest.webmanifest', window.location.href).href,
	serviceWorkerUrl: new URL('service-worker.js', window.location.href).href,
}
const coordinator = new SyncCoordinator()
setDatabaseDiagnosticReporter((event, error) => { void diagnostics.log('error', 'db', event, errorMetadata(error)) })
installGlobalDiagnosticHandlers(diagnostics)
let account = await getAccount()
let entries: SyncEntry[] = []
let contexts: Context[] = []
let conflicts: SyncConflict[] = []
let currentView: 'day' | 'future' = 'day'
let selectedDate = dateKey(new Date(), account?.timezone)
let coordinatorState: CoordinatorState = { connection: 'unknown', sync: 'idle', message: '', pending: 0 }
let installPrompt: InstallPrompt | null = null
let updateRegistration: ServiceWorkerRegistration | null = null
let activeDialog: HTMLDialogElement | null = null
let restoreFocus: HTMLElement | null = null
let activeLoginAttempt: AbortController | null = null
let loginAttemptId = 0
let setupState: 'idle' | 'authorization-pending' | 'authenticated' | 'credential-persistence-failed' = account === null ? 'idle' : 'authenticated'
let setupError: string | null = null

function s(key: string, fallback: string): string {
	return translatePwa(key, fallback, account?.locale ?? navigator.language)
}

function element<K extends keyof HTMLElementTagNameMap>(name: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
	const node = document.createElement(name)
	if (className !== undefined) { node.className = className }
	if (text !== undefined) { node.textContent = text }
	return node
}

function button(label: string, onClick: () => void, className = ''): HTMLButtonElement {
	const node = element('button', className, label)
	node.type = 'button'
	node.addEventListener('click', onClick)
	return node
}

async function loadLocal(): Promise<void> {
	[account, entries, contexts, conflicts] = await Promise.all([getAccount(), listEntries(), listContexts(), listConflicts()])
	if (account !== null && selectedDate === '') { selectedDate = dateKey(new Date(), account.timezone) }
}

function today(): string {
	return dateKey(new Date(), account?.timezone)
}

function closeDialog(): void {
	activeDialog?.close()
}

function showDialog(dialog: HTMLDialogElement, trigger?: HTMLElement): void {
	closeDialog()
	restoreFocus = trigger ?? document.activeElement as HTMLElement | null
	activeDialog = dialog
	document.body.append(dialog)
	dialog.addEventListener('close', () => {
		dialog.remove()
		activeDialog = null
		restoreFocus?.focus()
		restoreFocus = null
	}, { once: true })
	dialog.showModal()
}

function render(): void {
	root.replaceChildren()
	root.append(renderHeader())
	const status = element('div', 'pwa-status')
	status.setAttribute('aria-live', 'polite')
	status.textContent = coordinatorState.sync === 'syncing' ? s('synchronizing', 'Synchronizing…') : coordinatorState.sync === 'failed' ? coordinatorState.message || s('syncFailed', 'Sync failed — changes remain on this device') : coordinatorState.sync === 'synchronized' ? s('synchronized', 'Synchronized') : ''
	root.append(status)

	if (account === null) {
		root.append(renderSetup())
		return
	}
	if (account.authState === 'expired') {
		const banner = element('section', 'notice notice-error')
		banner.setAttribute('role', 'alert')
		banner.append(element('strong', undefined, s('connectionExpired', 'Connection expired')), button(s('reconnect', 'Reconnect'), () => void connect()))
		root.append(banner)
	}
	if (updateRegistration !== null) {
		const banner = element('section', 'notice')
		banner.append(element('span', undefined, s('updateAvailable', 'Taskbook update available')), button(s('reload', 'Reload'), activateUpdate))
		root.append(banner)
	}
	root.append(renderConflicts(), renderNavigation())
	const main = element('main', 'main')
	main.id = 'main-content'
	main.dataset.taskbookNavigationScope = ''
	main.append(currentView === 'day' ? renderDay() : renderFuture())
	root.append(main, renderFooter())
}

function renderHeader(): HTMLElement {
	const header = element('header', 'header')
	const brand = element('div', 'brand')
	const icon = element('img', 'app-icon')
	icon.src = bootstrap.iconUrl
	icon.alt = ''
	brand.append(icon, element('span', 'title', s('taskbook', 'Taskbook')))
	const connection = element('span', `connection connection-${coordinatorState.connection}`)
	connection.setAttribute('role', 'status')
	connection.append(element('span', 'connection-dot'))
	const text = coordinatorState.connection === 'connected' ? s('connected', 'Connected') : coordinatorState.connection === 'expired' ? s('connectionExpired', 'Connection expired') : coordinatorState.connection === 'server-error' ? s('serverError', 'Server error') : s('offline', 'Offline')
	connection.append(element('span', 'connection-text', text))
	header.append(brand, connection)
	if (account !== null) {
		const actions = element('div', 'header-actions')
		actions.append(button('+', () => openEntryForm(), 'add-button'), button('⋮', () => openDeviceMenu(), 'icon-button'))
		;(actions.firstElementChild as HTMLElement).setAttribute('aria-label', s('quickAdd', 'Quick Add'))
		;(actions.lastElementChild as HTMLElement).setAttribute('aria-label', s('deviceActions', 'Device actions'))
		header.append(actions)
	}
	return header
}

function renderSetup(): HTMLElement {
	const section = element('main', 'setup')
	section.append(element('h1', undefined, s('setUp', 'Set up Taskbook')), element('p', undefined, s('setupDescription', 'Connect this offline-capable application to your Taskbook account. A dedicated app password will be created by Nextcloud.')))
	if (setupState === 'authorization-pending') {
		const pending = element('p', undefined, s('authorizationPending', 'Waiting for authorization in Nextcloud…'))
		pending.setAttribute('role', 'status')
		section.append(pending)
	}
	if (setupError !== null) {
		const notice = element('section', 'notice notice-error')
		notice.setAttribute('role', 'alert')
		notice.append(element('span', undefined, setupError), button(s('retry', 'Retry'), () => void connect()), button(s('exportDiagnostics', 'Export diagnostics'), () => void exportDiagnostics()))
		section.append(notice)
		return section
	}
	const connectButton = button(s('connect', 'Connect to Nextcloud'), () => void connect(), 'primary')
	connectButton.disabled = setupState === 'authorization-pending'
	section.append(connectButton)
	return section
}

async function connect(): Promise<void> {
	activeLoginAttempt?.abort()
	closeDialog()
	setupError = null
	setupState = 'authorization-pending'
	const controller = new AbortController()
	activeLoginAttempt = controller
	const attemptId = ++loginAttemptId
	const isCurrent = (): boolean => activeLoginAttempt === controller && loginAttemptId === attemptId
	const reportAuth = (event: string, metadata: Record<string, unknown> = {}): void => {
		const level = /(?:failed|error|unexpected)/u.test(event) ? 'error' : /(?:pending|timeout|cancelled)/u.test(event) ? 'warning' : 'info'
		void diagnostics.log(level, 'auth', event, { attemptId, ...metadata })
	}
	reportAuth('auth.start')
	render()
	try {
		const previous = account ?? undefined
		const login = await startLogin(bootstrap, { signal: controller.signal, onDiagnosticEvent: reportAuth })
		if (!isCurrent()) { return }
		const popup = window.open(login.login, '_blank', 'noopener,noreferrer')
		reportAuth('auth.login-window.opened', { popupBlocked: popup === null })
		if (popup === null) {
			const dialog = element('dialog')
			const link = element('a', 'primary', s('continueLogin', 'Continue in Nextcloud'))
			link.href = login.login
			link.target = '_blank'
			link.rel = 'noopener noreferrer'
			dialog.append(element('p', undefined, s('popupBlocked', 'Open Nextcloud to approve this Taskbook connection.')), link)
			dialog.addEventListener('close', () => { if (isCurrent()) { controller.abort() } }, { once: true })
			showDialog(dialog)
		}
		const provisionedAccount = await pollLogin(login, bootstrap, previous, { signal: controller.signal, onDiagnosticEvent: reportAuth })
		if (!isCurrent()) { return }
		reportAuth('auth.credentials.persist.start')
		try {
			await putAccount(provisionedAccount)
		} catch (error) {
			void diagnostics.log('error', 'auth', 'auth.credentials.persist.failed', { attemptId, ...errorMetadata(error) })
			closeDialog()
			setupState = 'credential-persistence-failed'
			setupError = s('credentialStorageFailed', 'Connection authorized, but the credentials could not be stored locally.')
			render()
			return
		}
		reportAuth('auth.credentials.persist.success')
		reportAuth('auth.api-client.init')
		account = provisionedAccount
		setupState = 'authenticated'
		reportAuth('auth.api-client.ready')
		activeLoginAttempt = null
		coordinator.authenticationSucceeded()
		reportAuth('auth.connected')
		closeDialog()
		render()
		try {
			await coordinator.syncNow()
			await loadLocal()
			render()
		} catch (error) {
			void diagnostics.log('error', 'sync', 'sync.initial.failed', { ...errorMetadata(error) })
			showMessage(s('initialSyncFailed', 'Connected, but the initial synchronization failed. Retry sync when the server is available.'), true)
		}
	} catch (error) {
		if (!isCurrent() || (error instanceof DOMException && error.name === 'AbortError')) { return }
		void diagnostics.log('error', 'auth', 'auth.failed', { attemptId, ...errorMetadata(error) })
		setupState = 'idle'
		setupError = error instanceof LoginFlowError && error.kind === 'expired'
			? s('connectionRequestExpired', 'The connection request expired. Start the connection again.')
			: error instanceof LoginFlowError && error.kind === 'server-unreachable'
				? s('serverUrlUnreachable', 'Nextcloud returned a server address that this browser cannot reach. Check the server canonical URL and proxy configuration.')
				: s('setupFailed', 'Taskbook could not complete the connection. Please try again.')
		render()
	} finally {
		if (isCurrent()) { activeLoginAttempt = null }
	}
}

function renderNavigation(): HTMLElement {
	const nav = element('nav', 'navigation')
	nav.setAttribute('aria-label', s('views', 'Taskbook views'))
	for (const [view, label] of [['day', s('day', 'Day')], ['future', s('futureLog', 'Future Log')]] as const) {
		const item = button(label, () => { currentView = view; render() }, currentView === view ? 'active' : '')
		item.setAttribute('aria-current', currentView === view ? 'page' : 'false')
		nav.append(item)
	}
	return nav
}

function renderDay(): HTMLElement {
	const section = element('section', 'view')
	const controls = element('div', 'period-controls')
	controls.append(button('‹', () => navigateDay(-1), 'icon-button'), button(selectedDate === today() ? s('today', 'Today') : s('goToday', 'Go to today'), () => { selectedDate = today(); render() }), button('›', () => navigateDay(1), 'icon-button'))
	controls.firstElementChild?.setAttribute('aria-label', s('previousDay', 'Previous day'))
	controls.lastElementChild?.setAttribute('aria-label', s('nextDay', 'Next day'))
	section.append(controls, element('h1', 'date-heading', displayDate(selectedDate, account?.locale)))
	const groups = dayEntryGroups(selectedDate, entries)
	const occurrences = [...groups.direct, ...groups.inherited]
	if (occurrences.length === 0) {
		section.append(element('p', 'empty', s('noEntries', 'No entries yet.')))
		return section
	}
	const list = element('div', 'entry-list')
	list.dataset.taskbookEntryList = ''
	groups.direct.forEach((occurrence, index) => list.append(renderEntry(occurrence.entry as SyncEntry, occurrence.migrationDisplay, index === 0)))
	if (groups.direct.length > 0 && groups.inherited.length > 0) { list.append(element('hr', 'entry-separator')) }
	groups.inherited.forEach((occurrence, index) => list.append(renderEntry(occurrence.entry as SyncEntry, occurrence.migrationDisplay, groups.direct.length === 0 && index === 0)))
	section.append(list)
	return section
}

function navigateDay(amount: number): void {
	selectedDate = addDays(selectedDate, amount)
	render()
}

function futureSections(): Array<{ id: string, label: string, entries: SyncEntry[] }> {
	const currentMonth = monthStart(today())
	const later = entries.filter((entry) => entry.referenceType === 'none')
	const months = new Map<string, SyncEntry[]>()
	for (const entry of entries) {
		if (entry.effectiveTargetDate !== null && monthStart(entry.effectiveTargetDate) > currentMonth) {
			const key = monthStart(entry.effectiveTargetDate)
			months.set(key, [...months.get(key) ?? [], entry])
		}
	}
	const sort = (items: SyncEntry[]) => items.sort((left, right) => Number(left.status === 'completed') - Number(right.status === 'completed') || left.createdAt.localeCompare(right.createdAt) || left.id - right.id)
	return [{ id: 'later', label: s('later', 'Later / No date'), entries: sort(later) }, ...[...months].sort(([left], [right]) => left.localeCompare(right)).map(([key, items]) => ({ id: key, label: displayMonth(key, account?.locale), entries: sort(items) }))]
}

function renderFuture(): HTMLElement {
	const section = element('section', 'view')
	section.append(element('h1', undefined, s('futureLog', 'Future Log')))
	const sections = futureSections()
	let first = true
	for (const group of sections) {
		if (group.entries.length === 0 && group.id !== 'later') { continue }
		const block = element('section', 'future-section')
		block.append(element('h2', undefined, group.label))
		if (group.entries.length === 0) { block.append(element('p', 'empty', s('noEntries', 'No entries yet.'))) }
		for (const entry of group.entries) {
			block.append(renderEntry(entry, entry.type === 'migrated_task' ? 'current' : undefined, first))
			first = false
		}
		section.append(block)
	}
	return section
}

function entrySymbol(entry: SyncEntry, migration?: 'original' | 'current'): string {
	if (migration === 'original') { return '>' }
	if (migration === 'current') { return '·' }
	return { task: '·', appointment: '○', note: '−', migrated_task: '>', irrelevant_task: '(·)' }[entry.type]
}

function handleEntryNavigation(event: KeyboardEvent): boolean {
	if (!itemShortcutsAllowed(event) || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { return false }
	const row = event.currentTarget as HTMLElement
	const items = [...root.querySelectorAll<HTMLElement>('[data-taskbook-entry-row]')].filter((item) => item.getClientRects().length > 0)
	const current = items.indexOf(row)
	if (current < 0) { return false }
	const next = itemNavigationIndex(current, items.length, event.key as 'ArrowDown' | 'ArrowUp' | 'Home' | 'End')
	event.preventDefault()
	if (next !== current) { items[next]?.focus() }
	return true
}

function renderEntry(entry: SyncEntry, migration?: 'original' | 'current', first = false): HTMLElement {
	const row = element('article', `entry-row${entry.status === 'completed' ? ' completed' : ''}`)
	row.tabIndex = first ? 0 : -1
	row.dataset.taskbookEntryRow = ''
	row.setAttribute('aria-label', `${entry.status === 'completed' ? s('completedEntry', 'Completed entry') : s('entry', 'Entry')}: ${entry.text}`)
	row.append(element('span', 'priority', entry.important ? '!' : ''), element('span', 'symbol', entrySymbol(entry, migration)))
	const text = element('span', 'entry-text', entry.text)
	if (entry.referenceType === 'week' || entry.referenceType === 'month') {
		text.append(element('small', 'period-meta', ` · ${entry.referenceType === 'week' ? s('week', 'Week') : s('month', 'Month')}`))
	}
	if (migration === 'current') { text.append(element('span', 'migration-marker', ' >')) }
	row.append(text, element('span', 'context-icon', entry.context.icon))
	const actions = element('div', 'entry-actions')
	const toggle = button(entry.status === 'open' ? '✓' : '↶', () => void mutate(() => toggleEntry(entry.clientUid, contexts)), 'icon-button')
	toggle.setAttribute('aria-label', entry.status === 'open' ? s('complete', 'Complete') : s('reopen', 'Reopen'))
	const edit = button('✎', () => openEntryForm(entry, edit), 'icon-button')
	edit.setAttribute('aria-label', s('edit', 'Edit'))
	const remove = button('×', () => confirmDelete(entry, remove), 'icon-button')
	remove.setAttribute('aria-label', s('delete', 'Delete'))
	actions.append(toggle, edit, remove)
	row.append(actions)
	row.addEventListener('focus', () => {
		for (const other of document.querySelectorAll<HTMLElement>('[data-taskbook-entry-row]')) { other.tabIndex = other === row ? 0 : -1 }
	})
	row.addEventListener('keydown', (event) => {
		if (handleEntryNavigation(event) || !itemShortcutsAllowed(event)) { return }
		const action = itemRowAction(event.key, false)
		if (action === undefined) { return }
		event.preventDefault()
		if (action === 'edit') { openEntryForm(entry, row) } else if (action === 'toggle') { void mutate(() => toggleEntry(entry.clientUid, contexts)) } else if (action === 'delete') { confirmDelete(entry, row) } else { row.blur() }
	})
	return row
}

function defaultRequest(entry?: SyncEntry): EntryRequest {
	return entry === undefined ? { text: '', type: 'task', important: false, contextId: account?.defaultContextId || contexts[0]?.id || 0, referenceType: 'day', targetDate: selectedDate || today(), status: 'open' } : { text: entry.text, type: entry.type, important: entry.important, contextId: entry.contextId, referenceType: entry.referenceType, targetDate: entry.effectiveTargetDate, status: entry.status }
}

function labeledControl(labelText: string, control: HTMLElement): HTMLLabelElement {
	const label = element('label', 'field')
	label.append(element('span', undefined, labelText), control)
	return label
}

function selectControl<T extends string>(value: T, options: Array<[T, string]>): HTMLSelectElement {
	const select = element('select')
	for (const [optionValue, label] of options) {
		const option = element('option', undefined, label)
		option.value = optionValue
		option.selected = value === optionValue
		select.append(option)
	}
	return select
}

function openEntryForm(entry?: SyncEntry, trigger?: HTMLElement): void {
	let draft = defaultRequest(entry)
	const dialog = element('dialog', 'entry-dialog')
	const form = element('form', 'entry-form')
	form.method = 'dialog'
	form.append(element('h2', undefined, entry === undefined ? s('quickAdd', 'Quick Add') : s('editEntry', 'Edit entry')))
	const important = element('input')
	important.type = 'checkbox'
	important.checked = draft.important
	const type = selectControl<EntryType>(draft.type, [['task', s('task', 'Task')], ['appointment', s('appointment', 'Appointment')], ['note', s('note', 'Note')], ['migrated_task', s('migratedTask', 'Migrated task')], ['irrelevant_task', s('irrelevantTask', 'Irrelevant task')]])
	const text = element('textarea')
	text.value = draft.text
	text.rows = 2
	text.maxLength = 2000
	text.required = true
	const context = element('select')
	for (const item of contexts) {
		const option = element('option', undefined, `${item.icon} ${item.title}`)
		option.value = String(item.id)
		option.selected = item.id === draft.contextId
		context.append(option)
	}
	const reference = selectControl<ReferenceType>(draft.referenceType, [['day', s('day', 'Day')], ['week', s('week', 'Week')], ['month', s('month', 'Month')], ['none', s('none', 'None')]])
	const target = element('input')
	target.type = 'date'
	target.value = draft.targetDate ?? ''
	target.disabled = draft.referenceType === 'none'
	text.addEventListener('input', () => {
		const parsed = parseRapidCapture(text.value, today(), reference.value as ReferenceType, contexts)
		text.value = parsed.text
		if (parsed.type !== undefined) { type.value = parsed.type }
		if (parsed.important !== undefined) { important.checked = parsed.important }
		if (parsed.contextId !== undefined) { context.value = String(parsed.contextId) }
		if (parsed.referenceType !== undefined) { reference.value = parsed.referenceType }
		if (parsed.targetDate !== undefined) { target.value = parsed.targetDate ?? '' }
		target.disabled = reference.value === 'none'
	})
	reference.addEventListener('change', () => {
		target.disabled = reference.value === 'none'
		if (!target.disabled && target.value === '') { target.value = today() }
	})
	form.append(labeledControl(s('important', 'Important'), important), labeledControl(s('type', 'Type'), type), labeledControl(s('text', 'Text'), text), labeledControl(s('context', 'Context'), context), labeledControl(s('timeReference', 'Time Reference'), reference), labeledControl(s('date', 'Date'), target))
	const actions = element('div', 'dialog-actions')
	actions.append(button(s('cancel', 'Cancel'), () => dialog.close()), element('button', 'primary', s('save', 'Save')))
	;(actions.lastElementChild as HTMLButtonElement).type = 'submit'
	form.append(actions)
	form.addEventListener('submit', (event) => {
		event.preventDefault()
		const referenceType = reference.value as ReferenceType
		draft = { text: text.value.trim(), type: type.value as EntryType, important: important.checked, contextId: Number(context.value), referenceType, targetDate: referenceType === 'none' ? null : dateForReference(referenceType, target.value || today()), status: entry?.status ?? 'open' }
		if (draft.text === '') { return }
		dialog.close()
		void mutate(() => entry === undefined ? createEntry(draft, contexts) : updateEntry(entry.clientUid, draft, contexts))
	})
	text.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit() }
	})
	dialog.append(form)
	showDialog(dialog, trigger)
	text.focus()
	text.setSelectionRange(text.value.length, text.value.length)
}

function confirmDelete(entry: SyncEntry, trigger: HTMLElement): void {
	const dialog = element('dialog')
	dialog.append(element('h2', undefined, s('deleteEntry', 'Delete entry?')), element('p', undefined, entry.text))
	const actions = element('div', 'dialog-actions')
	actions.append(button(s('cancel', 'Cancel'), () => dialog.close()), button(s('delete', 'Delete'), () => { dialog.close(); void mutate(() => deleteEntry(entry.clientUid)) }, 'danger'))
	dialog.append(actions)
	showDialog(dialog, trigger)
}

async function mutate(operation: () => Promise<unknown>): Promise<void> {
	await operation()
	await loadLocal()
	render()
	coordinator.mutationQueued()
}

function renderConflicts(): HTMLElement {
	const container = element('div', 'conflicts')
	for (const conflict of conflicts) {
		const notice = element('section', 'notice notice-warning')
		notice.append(element('p', undefined, s('conflictMessage', 'This item changed on another device.')))
		const actions = element('div')
		actions.append(button(s('keepMine', 'Keep mine'), () => void keepMine(conflict)), button(s('useServer', 'Use server version'), () => void useServer(conflict)))
		notice.append(actions)
		container.append(notice)
	}
	return container
}

async function keepMine(conflict: SyncConflict): Promise<void> {
	if (conflict.localEntry === null && conflict.mutationType !== 'delete') { return }
	const type = conflict.mutationType === 'delete' ? 'delete' : conflict.serverEntry === null ? 'create' : 'update'
	const mutation = newMutation(type, conflict.clientUid, type === 'create' ? 0 : conflict.serverRevision, type === 'delete' ? null : conflict.localEntry)
	await keepLocalConflict(conflict, mutation)
	announceRepositoryChange()
	coordinator.mutationQueued()
}

async function useServer(conflict: SyncConflict): Promise<void> {
	await useServerConflict(conflict)
	announceRepositoryChange()
	await coordinator.refreshPending()
}

function renderFooter(): HTMLElement {
	const footer = element('footer', 'footer')
	const pending = element('span', 'pending', `${coordinatorState.pending} ${s('pending', 'pending')}`)
	pending.setAttribute('aria-label', `${coordinatorState.pending} ${s('pendingChanges', 'pending changes')}`)
	footer.append(button(coordinatorState.sync === 'failed' ? s('retrySync', 'Retry sync') : s('syncNow', 'Sync now'), () => void coordinator.syncNow()), pending)
	if (coordinatorState.sync === 'failed') {
		footer.prepend(button(s('exportDiagnostics', 'Export diagnostics'), () => void exportDiagnostics()))
	}
	if (installPrompt !== null) { footer.prepend(button(s('install', 'Install'), () => void promptInstall(), 'primary')) } else if (!window.matchMedia('(display-mode: standalone)').matches) { footer.prepend(element('span', 'install-help', installInstructions())) }
	return footer
}

function installInstructions(): string {
	return /iphone|ipad|ipod/i.test(navigator.userAgent) ? s('iosInstall', 'To install, use Share, then Add to Home Screen.') : s('browserInstall', 'Install from your browser menu for standalone use.')
}

async function promptInstall(): Promise<void> {
	if (installPrompt === null) { return }
	await installPrompt.prompt()
	await installPrompt.userChoice
	installPrompt = null
	render()
}

function openDeviceMenu(): void {
	const dialog = element('dialog')
	dialog.append(
		element('h2', undefined, s('deviceActions', 'Device actions')),
		button(s('exportDiagnostics', 'Export diagnostics'), () => { dialog.close(); void exportDiagnostics() }),
		button(s('clearDiagnostics', 'Clear diagnostics'), () => { dialog.close(); confirmClearDiagnostics() }),
		button(s('disconnect', 'Disconnect this device'), () => { dialog.close(); confirmDisconnect() }, 'danger'),
		button(s('cancel', 'Cancel'), () => dialog.close()),
	)
	showDialog(dialog)
}

async function exportDiagnostics(): Promise<void> {
	try {
		const content = await diagnostics.exportJsonl()
		const link = element('a')
		const url = URL.createObjectURL(new Blob([content], { type: 'application/x-ndjson;charset=utf-8' }))
		link.href = url
		link.download = diagnosticFileName()
		link.hidden = true
		document.body.append(link)
		link.click()
		link.remove()
		window.setTimeout(() => URL.revokeObjectURL(url), 0)
		showMessage(s('diagnosticsExported', 'Diagnostics exported.'))
	} catch (error) {
		showMessage(s('diagnosticsExportFailed', 'Diagnostics could not be exported.'), true)
		void diagnostics.log('error', 'diagnostics', 'diagnostics.export.failed', errorMetadata(error))
	}
}

function confirmClearDiagnostics(): void {
	const dialog = element('dialog')
	dialog.append(element('h2', undefined, s('clearDiagnostics', 'Clear diagnostics')), element('p', undefined, s('clearDiagnosticsWarning', 'This removes diagnostic records only. Your Taskbook data and connection remain on this device.')))
	const actions = element('div', 'dialog-actions')
	actions.append(button(s('cancel', 'Cancel'), () => dialog.close()), button(s('clearDiagnostics', 'Clear diagnostics'), () => { dialog.close(); void clearDiagnostics() }, 'danger'))
	dialog.append(actions)
	showDialog(dialog)
}

async function clearDiagnostics(): Promise<void> {
	try {
		await diagnostics.clear()
		showMessage(s('diagnosticsCleared', 'Diagnostics cleared.'))
	} catch {
		showMessage(s('diagnosticsClearFailed', 'Diagnostics could not be cleared.'), true)
	}
}

function confirmDisconnect(): void {
	const dialog = element('dialog')
	dialog.append(element('h2', undefined, s('disconnect', 'Disconnect this device')), element('p', undefined, s('disconnectWarning', 'This removes local Taskbook data and pending changes from this device.')))
	const actions = element('div', 'dialog-actions')
	actions.append(button(s('cancel', 'Cancel'), () => dialog.close()), button(s('disconnect', 'Disconnect this device'), () => { dialog.close(); void disconnect() }, 'danger'))
	dialog.append(actions)
	showDialog(dialog)
}

async function disconnect(): Promise<void> {
	activeLoginAttempt?.abort()
	activeLoginAttempt = null
	let revoked = true
	if (account !== null) {
		try { await revokeAppPassword(account, bootstrap.appPasswordRevokePath) } catch { revoked = false }
	}
	await clearLocalData()
	account = null
	entries = []
	contexts = []
	conflicts = []
	render()
	if (!revoked) { showMessage(s('revocationFailed', 'Local data was removed, but the app password could not be revoked. Revoke it in Nextcloud when you are online.'), true) }
}

function showMessage(message: string, error = false): HTMLElement {
	const notice = element('div', `toast${error ? ' toast-error' : ''}`, message)
	notice.setAttribute('role', error ? 'alert' : 'status')
	document.body.append(notice)
	window.setTimeout(() => notice.remove(), 5_000)
	return notice
}

async function registerServiceWorker(): Promise<void> {
	if (!('serviceWorker' in navigator)) { return }
	try {
		const registration = await navigator.serviceWorker.register(bootstrap.serviceWorkerUrl, { scope: new URL('.', window.location.href).pathname, type: 'module' })
		void diagnostics.log('info', 'service-worker', 'service-worker.registered', { scriptUrl: bootstrap.serviceWorkerUrl, scope: registration.scope })
		if (registration.waiting) {
			updateRegistration = registration
			void diagnostics.log('info', 'service-worker', 'service-worker.update.available')
			render()
		}
		registration.addEventListener('updatefound', () => {
			void diagnostics.log('info', 'service-worker', 'service-worker.update.found')
			registration.installing?.addEventListener('statechange', () => {
				if (registration.waiting !== null && navigator.serviceWorker.controller !== null) {
					updateRegistration = registration
					void diagnostics.log('info', 'service-worker', 'service-worker.update.available')
					render()
				}
			})
		})
		navigator.serviceWorker.addEventListener('message', (event) => {
			if (event.data === 'TASKBOOK_SYNC') {
				void coordinator.syncNow()
				return
			}
			if (typeof event.data === 'object' && event.data !== null && event.data.type === 'TASKBOOK_PWA_RUNTIME') {
				diagnostics.setRuntimeIdentity({ buildVersion: typeof event.data.buildVersion === 'string' ? event.data.buildVersion : undefined, serviceWorkerVersion: typeof event.data.cacheName === 'string' ? event.data.cacheName : null })
				void diagnostics.log('info', 'service-worker', 'service-worker.runtime', { cacheName: event.data.cacheName })
				return
			}
			if (typeof event.data === 'object' && event.data !== null && event.data.type === 'TASKBOOK_PWA_DIAGNOSTIC') {
				const level = event.data.level === 'warning' || event.data.level === 'error' ? event.data.level : 'info'
				if (typeof event.data.event === 'string' && typeof event.data.metadata === 'object' && event.data.metadata !== null) {
					void diagnostics.log(level, 'service-worker', event.data.event, event.data.metadata)
				}
			}
		})
		registration.active?.postMessage('TASKBOOK_PWA_RUNTIME')
		void registration.update().catch((error: unknown) => { void diagnostics.log('warning', 'service-worker', 'service-worker.update.failed', errorMetadata(error)) })
	} catch (error) {
		void diagnostics.log('error', 'service-worker', 'service-worker.register.failed', errorMetadata(error))
	}
}

function activateUpdate(): void {
	const waiting = updateRegistration?.waiting
	if (waiting === null || waiting === undefined) { return }
	navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
	void diagnostics.log('info', 'service-worker', 'service-worker.update.activating')
	waiting.postMessage('SKIP_WAITING')
}

window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installPrompt = event as InstallPrompt; render() })
window.addEventListener('online', () => void coordinator.syncNow())
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { void coordinator.syncNow() } })
document.addEventListener('keydown', (event) => {
	if (isQuickAddShortcut(event)) { event.preventDefault(); openEntryForm(); return }
	const action = periodNavigationAction(event)
	if (currentView === 'day' && action !== undefined) {
		event.preventDefault()
		selectedDate = action === 'current' ? today() : addDays(selectedDate, action === 'previous' ? -1 : 1)
		render()
	}
	if (['ArrowDown', 'ArrowUp'].includes(event.key) && !event.defaultPrevented && document.activeElement === document.body) {
		const first = document.querySelector<HTMLElement>('[data-taskbook-entry-row]')
		if (first !== null) { event.preventDefault(); first.focus() }
	}
})

coordinator.onChange((state) => { coordinatorState = state; render() })
onRepositoryChange(() => { void loadLocal().then(render) })
await loadLocal()
if (new URLSearchParams(window.location.search).has('disconnect') && account !== null) { confirmDisconnect() }
render()
await registerServiceWorker()
await coordinator.refreshPending()
if (account !== null && account.authState === 'connected') { void coordinator.syncNow() }
