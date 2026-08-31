import { createApp } from 'vue'
import DashboardWidget from './components/DashboardWidget.vue'

import '@nextcloud/dialogs/style.css'
import './styles/icon.css'

type DashboardRegistration = { register: (widgetId: string, mount: (element: HTMLElement) => void) => void }

function registerDashboardWidget() {
	const dashboard = (window as Window & { OCA?: { Dashboard?: DashboardRegistration } }).OCA?.Dashboard
	if (dashboard !== undefined) { dashboard.register('taskbook', (element) => { createApp(DashboardWidget).mount(element) }) }
}

document.addEventListener('DOMContentLoaded', registerDashboardWidget)
