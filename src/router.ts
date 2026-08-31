import { generateUrl } from '@nextcloud/router'
import { createRouter, createWebHistory } from 'vue-router'
import FutureView from './views/FutureView.vue'
import OverviewView from './views/OverviewView.vue'
import PeriodView from './views/PeriodView.vue'
import { isoWeekKey, localDateKey } from './utils/dates.ts'

const router = createRouter({
	history: createWebHistory(generateUrl('/apps/taskbook/')),
	routes: [
		{ path: '/', redirect: '/overview' },
		{ path: '/overview', name: 'overview', component: OverviewView },
		{ path: '/day/:date', name: 'day', component: PeriodView, props: (route) => ({ mode: 'day', value: typeof route.params.date === 'string' ? route.params.date : localDateKey() }) },
		{ path: '/week/:week', name: 'week', component: PeriodView, props: (route) => ({ mode: 'week', value: typeof route.params.week === 'string' ? route.params.week : isoWeekKey(localDateKey()) }) },
		{ path: '/month/:month', name: 'month', component: PeriodView, props: (route) => ({ mode: 'month', value: typeof route.params.month === 'string' ? route.params.month : localDateKey().slice(0, 7) }) },
		{ path: '/future', name: 'future', component: FutureView },
		{ path: '/support', redirect: '/overview' },
		{ path: '/:pathMatch(.*)*', redirect: '/overview' },
	],
})

export default router
