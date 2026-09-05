import type { InjectionKey, Ref } from 'vue'
import type { Context, Entry, Overview, Settings } from './types.ts'

export type EntryChange = { entry: Entry } | { deletedId: number }

export const settingsKey: InjectionKey<Ref<Settings | null>> = Symbol('taskbook-settings')
export const entryChangeKey: InjectionKey<Ref<EntryChange | null>> = Symbol('taskbook-entry-change')
export const recordEntryChangeKey: InjectionKey<(change: EntryChange) => void> = Symbol('taskbook-record-entry-change')
export const overviewKey: InjectionKey<Ref<Overview | null>> = Symbol('taskbook-overview')
export const overviewLoadingKey: InjectionKey<Ref<boolean>> = Symbol('taskbook-overview-loading')
export const openCaptureKey: InjectionKey<() => void> = Symbol('taskbook-open-capture')

export function contextsFrom(settings: Settings | null): Context[] {
	return settings?.contexts ?? []
}
