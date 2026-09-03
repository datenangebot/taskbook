import { randomUuid } from './identity.ts'
import { appendDiagnosticRecord, clearDiagnosticRecords, DATABASE_VERSION, DIAGNOSTIC_LIMIT, listDiagnosticRecords } from './storage/database.ts'

export { DIAGNOSTIC_LIMIT }

export type DiagnosticLevel = 'info' | 'warning' | 'error'

export interface DiagnosticRecord {
	id: string
	timestamp: string
	level: DiagnosticLevel
	category: string
	event: string
	message: string | null
	metadata: Record<string, unknown>
	buildVersion: string
	serviceWorkerVersion: string | null
	sessionId: string
	databaseVersion: number
}

export interface DiagnosticStore {
	append: (record: DiagnosticRecord) => Promise<void>
	list: () => Promise<DiagnosticRecord[]>
	clear: () => Promise<void>
}

export interface DiagnosticRuntimeIdentity {
	buildVersion?: string
	serviceWorkerVersion?: string | null
}

const sensitiveMetadataKey = /(?:password|token|authorization|cookie|secret|credential|account|entry|entries|body|content|text|note)/iu
const urlPattern = /https?:\/\/[^\s'"`<>]+/giu

function randomId(): string {
	return randomUuid()
}

function pageBuildVersion(): string {
	return typeof document === 'undefined' ? 'unknown' : document.documentElement.dataset.taskbookPwaBuild ?? 'unknown'
}

export function sanitizeUrl(value: string): string {
	try {
		const url = new URL(value, typeof location === 'undefined' ? 'https://taskbook.invalid' : location.origin)
		if (url.origin === 'https://taskbook.invalid') {
			return url.pathname
		}
		return `${url.origin}${url.pathname}`
	} catch {
		return value.split(/[?#]/u, 1)[0] ?? ''
	}
}

export function sanitizeText(value: string): string {
	return value
		.replace(urlPattern, (url) => sanitizeUrl(url))
		.replace(/\bBasic\s+[A-Za-z0-9+/=_-]+/giu, 'Basic [REDACTED]')
		.replace(/\b(appPassword|password|token|authorization|cookie|secret|credentials?)\b\s*([:=])\s*[^\s,;]+/giu, '$1$2[REDACTED]')
}

function sanitizeValue(value: unknown, depth = 0): unknown {
	if (depth > 4) {
		return '[TRUNCATED]'
	}
	if (typeof value === 'string') {
		return sanitizeText(value)
	}
	if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
		return value
	}
	if (Array.isArray(value)) {
		return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1))
	}
	if (value instanceof Error) {
		return errorMetadata(value)
	}
	if (typeof value === 'object') {
		const result: Record<string, unknown> = {}
		for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
			result[key] = sensitiveMetadataKey.test(key) ? '[REDACTED]' : sanitizeValue(item, depth + 1)
		}
		return result
	}
	return `[${typeof value}]`
}

export function sanitizeMetadata(metadata: Record<string, unknown> = {}): Record<string, unknown> {
	return sanitizeValue(metadata) as Record<string, unknown>
}

export function errorMetadata(error: unknown): Record<string, unknown> {
	if (!(error instanceof Error)) {
		return { errorType: error === null ? 'null' : typeof error }
	}
	return {
		errorName: sanitizeText(error.name || 'Error'),
		errorMessage: sanitizeText(error.message),
		...(typeof error.stack === 'string' && error.stack !== '' ? { stack: sanitizeText(error.stack) } : {}),
	}
}

export function trimDiagnosticRecords(records: DiagnosticRecord[], limit = DIAGNOSTIC_LIMIT): DiagnosticRecord[] {
	return [...records]
		.sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id))
		.slice(Math.max(0, records.length - limit))
}

const indexedDbStore: DiagnosticStore = {
	append: appendDiagnosticRecord,
	list: listDiagnosticRecords,
	clear: clearDiagnosticRecords,
}

export class DiagnosticLogger {
	private readonly sessionId = randomId()
	private readonly store: DiagnosticStore
	private buildVersion: string
	private serviceWorkerVersion: string | null = null

	public constructor(store: DiagnosticStore = indexedDbStore, identity: DiagnosticRuntimeIdentity = {}) {
		this.store = store
		this.buildVersion = identity.buildVersion ?? pageBuildVersion()
		this.serviceWorkerVersion = identity.serviceWorkerVersion ?? null
	}

	public setRuntimeIdentity(identity: DiagnosticRuntimeIdentity): void {
		if (identity.buildVersion !== undefined) {
			this.buildVersion = identity.buildVersion
		}
		if (identity.serviceWorkerVersion !== undefined) {
			this.serviceWorkerVersion = identity.serviceWorkerVersion
		}
	}

	public async log(level: DiagnosticLevel, category: string, event: string, metadata: Record<string, unknown> = {}, message: string | null = null): Promise<void> {
		const record: DiagnosticRecord = {
			id: randomId(),
			timestamp: new Date().toISOString(),
			level,
			category,
			event,
			message: message === null ? null : sanitizeText(message),
			metadata: sanitizeMetadata(metadata),
			buildVersion: this.buildVersion,
			serviceWorkerVersion: this.serviceWorkerVersion,
			sessionId: this.sessionId,
			databaseVersion: DATABASE_VERSION,
		}
		try {
			await this.store.append(record)
		} catch {
			// Diagnostics are best effort and must not affect the application path being observed.
		}
	}

	public async exportJsonl(): Promise<string> {
		const records = trimDiagnosticRecords(await this.store.list())
		return records.map((record) => JSON.stringify({ ...record, message: record.message === null ? null : sanitizeText(record.message), metadata: sanitizeMetadata(record.metadata) })).join('\n')
	}

	public async clear(): Promise<void> {
		await this.store.clear()
	}
}

export function diagnosticFileName(date = new Date()): string {
	const part = (value: number): string => String(value).padStart(2, '0')
	return `taskbook-pwa-diagnostics-${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}-${part(date.getHours())}${part(date.getMinutes())}${part(date.getSeconds())}.jsonl`
}

export function installGlobalDiagnosticHandlers(logger: DiagnosticLogger, target: EventTarget = window): () => void {
	const onError = (rawEvent: Event): void => {
		const event = rawEvent as ErrorEvent
		void logger.log('error', 'frontend', 'frontend.error', {
			...errorMetadata(event.error),
			source: sanitizeUrl(event.filename),
			line: event.lineno,
			column: event.colno,
		})
	}
	const onUnhandledRejection = (rawEvent: Event): void => {
		const event = rawEvent as PromiseRejectionEvent
		void logger.log('error', 'frontend', 'frontend.unhandled-rejection', errorMetadata(event.reason))
	}
	target.addEventListener('error', onError)
	target.addEventListener('unhandledrejection', onUnhandledRejection)
	return () => {
		target.removeEventListener('error', onError)
		target.removeEventListener('unhandledrejection', onUnhandledRejection)
	}
}

export const diagnostics = new DiagnosticLogger()
