import { showError, showInfo, showSuccess, showWarning } from '@nextcloud/dialogs'

export function notifySuccess(message: string): void {
	showSuccess(message)
}

export function notifyError(message: string): void {
	showError(message)
}

export function notifyInfo(message: string): void {
	showInfo(message)
}

export function notifyWarning(message: string): void {
	showWarning(message)
}
