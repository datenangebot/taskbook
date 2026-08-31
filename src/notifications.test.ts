import { beforeEach, describe, expect, it, vi } from 'vitest'

const dialogs = vi.hoisted(() => ({
	showError: vi.fn(),
	showInfo: vi.fn(),
	showSuccess: vi.fn(),
	showWarning: vi.fn(),
}))

vi.mock('@nextcloud/dialogs', () => dialogs)

import { notifyError, notifyInfo, notifySuccess, notifyWarning } from './notifications.ts'

describe('Taskbook notifications', () => {
	beforeEach(() => vi.clearAllMocks())

	it('delegates each notification exactly once to @nextcloud/dialogs', () => {
		notifySuccess('Saved')
		notifyError('Failed')
		notifyInfo('Info')
		notifyWarning('Warning')

		expect(dialogs.showSuccess).toHaveBeenCalledOnce()
		expect(dialogs.showSuccess).toHaveBeenCalledWith('Saved')
		expect(dialogs.showError).toHaveBeenCalledOnce()
		expect(dialogs.showError).toHaveBeenCalledWith('Failed')
		expect(dialogs.showInfo).toHaveBeenCalledOnce()
		expect(dialogs.showWarning).toHaveBeenCalledOnce()
	})
})
