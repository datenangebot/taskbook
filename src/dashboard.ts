import { createApp } from 'vue'
import DashboardWidget from './components/DashboardWidget.vue'

import '@nextcloud/dialogs/style.css'
import './styles/icon.css'

type DashboardRegistration = { register: (widgetId: string, mount: (element: HTMLElement) => void) => void }

export const dashboardMountClass = 'taskbook-dashboard-mount'

export function prepareDashboardMount(element: HTMLElement) {
	element.classList.add(dashboardMountClass)
}

function registerDashboardWidget() {
	const dashboard = (window as Window & { OCA?: { Dashboard?: DashboardRegistration } }).OCA?.Dashboard
	if (dashboard !== undefined) {
		dashboard.register('taskbook', (element) => {
			prepareDashboardMount(element)
			createApp(DashboardWidget).mount(element)
		})
	}
}

document.addEventListener('DOMContentLoaded', registerDashboardWidget)
