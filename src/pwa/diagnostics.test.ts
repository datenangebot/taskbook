import type { DiagnosticRecord, DiagnosticStore } from './diagnostics.ts'

import { describe, expect, it } from 'vitest'
import { DIAGNOSTIC_LIMIT, diagnosticFileName, DiagnosticLogger, installGlobalDiagnosticHandlers, sanitizeMetadata, sanitizeUrl, trimDiagnosticRecords } from './diagnostics.ts'

function record(id: string): DiagnosticRecord {
	return { id, timestamp: `2026-09-02T10:${id.padStart(6, '0')}Z`, level: 'info', category: 'test', event: 'event', message: null, metadata: {}, buildVersion: 'build', serviceWorkerVersion: 'worker', sessionId: 'session', databaseVersion: 3 }
}

describe('PWA diagnostics', () => {
	it('redacts sensitive metadata and strips URL queries and fragments centrally', () => {
		const metadata = sanitizeMetadata({ appPassword: 'app-password', Authorization: 'Basic credential', token: 'poll-token', Cookie: 'session=secret', nested: { secret: 'value' }, url: 'http://nextcloud.local/login/v2/poll?token=secret#fragment' })
		expect(metadata).toEqual({ appPassword: '[REDACTED]', Authorization: '[REDACTED]', token: '[REDACTED]', Cookie: '[REDACTED]', nested: { secret: '[REDACTED]' }, url: 'http://nextcloud.local/login/v2/poll' })
		expect(sanitizeUrl('http://nextcloud.local/ocs/v2.php/apps/taskbook/api/v1/sync?token=secret#fragment')).toBe('http://nextcloud.local/ocs/v2.php/apps/taskbook/api/v1/sync')
	})

	it('keeps a bounded oldest-first ring buffer', () => {
		const records = Array.from({ length: DIAGNOSTIC_LIMIT + 2 }, (_, index) => record(String(index)))
		const kept = trimDiagnosticRecords(records)
		expect(kept).toHaveLength(DIAGNOSTIC_LIMIT)
		expect(kept[0]?.id).toBe('2')
	})

	it('exports only the same sanitized representation it persists', async () => {
		const records: DiagnosticRecord[] = []
		const store: DiagnosticStore = {
			append: async (item) => { records.push(item) },
			list: async () => records,
			clear: async () => { records.splice(0) },
		}
		const logger = new DiagnosticLogger(store, { buildVersion: 'build-a', serviceWorkerVersion: 'taskbook-pwa-a' })
		await logger.log('info', 'auth', 'auth.poll.completed', { appPassword: 'secret-password', token: 'poll-token', Authorization: 'Basic credential', Cookie: 'session=secret', server: 'http://nextcloud.local/login?token=secret' })
		const exported = await logger.exportJsonl()
		expect(exported).not.toContain('secret-password')
		expect(exported).not.toContain('poll-token')
		expect(exported).not.toContain('Basic credential')
		expect(exported).not.toContain('session=secret')
		expect(exported).toContain('http://nextcloud.local/login')
		expect(exported).toContain('build-a')
		expect(exported).toContain('taskbook-pwa-a')
		await logger.clear()
		expect(await logger.exportJsonl()).toBe('')
	})

	it('does not propagate storage failures and produces a portable export filename', async () => {
		const store: DiagnosticStore = { append: async () => { throw new Error('unavailable') }, list: async () => [], clear: async () => {} }
		const logger = new DiagnosticLogger(store)
		await expect(logger.log('error', 'db', 'db.open.failed')).resolves.toBeUndefined()
		expect(diagnosticFileName(new Date('2026-09-02T08:07:06'))).toBe('taskbook-pwa-diagnostics-2026-09-02-080706.jsonl')
	})

	it('captures global errors and rejected promises without persisting raw rejection values', async () => {
		const records: DiagnosticRecord[] = []
		const store: DiagnosticStore = { append: async (item) => { records.push(item) }, list: async () => records, clear: async () => {} }
		const target = new EventTarget()
		const dispose = installGlobalDiagnosticHandlers(new DiagnosticLogger(store), target)
		target.dispatchEvent(Object.assign(new Event('error'), { error: new Error('token=secret-token'), filename: 'http://nextcloud.local/js/taskbook-pwa.mjs?token=secret-token', lineno: 12, colno: 4 }) as ErrorEvent)
		target.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: { token: 'secret-token' } }) as PromiseRejectionEvent)
		await new Promise((resolve) => setTimeout(resolve, 0))
		dispose()
		expect(records.map((item) => item.event)).toEqual(['frontend.error', 'frontend.unhandled-rejection'])
		expect(JSON.stringify(records)).not.toContain('secret-token')
	})
})
