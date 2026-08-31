import type { EntryType } from './types.ts'

import {
	mdiAlarm,
	mdiArrowRight,
	mdiCalendarBlankOutline,
	mdiCalendarMonthOutline,
	mdiCalendarRemoveOutline,
	mdiCalendarTodayOutline,
	mdiCalendarWeekOutline,
	mdiCheck,
	mdiChevronLeft,
	mdiChevronRight,
	mdiClose,
	mdiCogOutline,
	mdiDeleteOutline,
	mdiHeartOutline,
	mdiInformationOutline,
	mdiPencil,
	mdiPlus,
	mdiViewDashboardOutline,
} from '@mdi/js'

export const iconPaths = {
	alarm: mdiAlarm,
	arrowRight: mdiArrowRight,
	calendar: mdiCalendarBlankOutline,
	calendarMonth: mdiCalendarMonthOutline,
	calendarRemove: mdiCalendarRemoveOutline,
	calendarToday: mdiCalendarTodayOutline,
	calendarWeek: mdiCalendarWeekOutline,
	check: mdiCheck,
	chevronLeft: mdiChevronLeft,
	chevronRight: mdiChevronRight,
	close: mdiClose,
	delete: mdiDeleteOutline,
	heart: mdiHeartOutline,
	information: mdiInformationOutline,
	pencil: mdiPencil,
	plus: mdiPlus,
	settings: mdiCogOutline,
	overview: mdiViewDashboardOutline,
} as const

export const entrySymbols: Record<EntryType, string> = {
	task: '·',
	appointment: '○',
	note: '-',
	migrated_task: '>',
	irrelevant_task: '(·)',
}
