import type { InjectionKey, Ref } from 'vue'
import type { Context, Entry, Settings } from './types.ts'

export type EntryChange = { entry: Entry } | { deletedId: number }

export const settingsKey: InjectionKey<Ref<Settings | null>> = Symbol('taskbook-settings')
export const entryChangeKey: InjectionKey<Ref<EntryChange | null>> = Symbol('taskbook-entry-change')
export const openCaptureKey: InjectionKey<() => void> = Symbol('taskbook-open-capture')

export function contextsFrom(settings: Settings | null): Context[] {
	return settings?.contexts ?? []
}
