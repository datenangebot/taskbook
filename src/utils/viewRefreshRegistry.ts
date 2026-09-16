export type DataViewName = 'overview' | 'day' | 'week' | 'month' | 'future'

export type ViewRefreshRegistry = {
	register: (view: DataViewName, refresh: () => void) => () => void
	refresh: (view: string) => boolean
}

export function createViewRefreshRegistry(): ViewRefreshRegistry {
	const handlers = new Map<DataViewName, () => void>()
	return {
		register(view, refresh) {
			handlers.set(view, refresh)
			return () => {
				if (handlers.get(view) === refresh) {
					handlers.delete(view)
				}
			}
		},
		refresh(view) {
			const refresh = handlers.get(view as DataViewName)
			if (refresh === undefined) {
				return false
			}
			refresh()
			return true
		},
	}
}
