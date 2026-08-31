import type { Context, ContextIcon, Entry, EntryRequest, EntrySection, Overview, PeriodEntriesResponse, Settings } from './types.ts'

import axios from '@nextcloud/axios'
import { generateOcsUrl } from '@nextcloud/router'

interface OcsResponse<T> {
	ocs: { data: T }
}

const headers = { Accept: 'application/json', 'OCS-APIRequest': 'true' }
const root = '/apps/taskbook/api/v1'

export function ocsErrorMessage(error: unknown): string | undefined {
	if (typeof error !== 'object' || error === null || !('response' in error)) {
		return undefined
	}
	const response = (error as { response?: { data?: { ocs?: { meta?: { message?: unknown } } } } }).response
	const message = response?.data?.ocs?.meta?.message
	return typeof message === 'string' ? message : undefined
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
	const response = await axios.get<OcsResponse<T>>(generateOcsUrl(`${root}${path}`), { headers, params })
	return response.data.ocs.data
}

export async function getSettings(): Promise<Settings> {
	return get<Settings>('/settings')
}

export async function listContexts(): Promise<Context[]> {
	return get<Context[]>('/contexts')
}

export async function createContext(title: string, icon: ContextIcon, alias: string): Promise<Context> {
	const response = await axios.post<OcsResponse<Context>>(generateOcsUrl(`${root}/contexts`), { title, icon, alias }, { headers })
	return response.data.ocs.data
}

export async function updateContext(id: number, title: string, icon: ContextIcon, alias: string): Promise<Context> {
	const response = await axios.patch<OcsResponse<Context>>(generateOcsUrl(`${root}/contexts/{id}`, { id }), { title, icon, alias }, { headers })
	return response.data.ocs.data
}

export async function deleteContext(id: number): Promise<void> {
	await axios.delete(generateOcsUrl(`${root}/contexts/{id}`, { id }), { headers })
}

export async function setDefaultContext(contextId: number): Promise<Settings> {
	const response = await axios.put<OcsResponse<Settings>>(generateOcsUrl(`${root}/settings/default-context`), { contextId }, { headers })
	return response.data.ocs.data
}

export async function createEntry(request: EntryRequest): Promise<Entry> {
	const response = await axios.post<OcsResponse<Entry>>(generateOcsUrl(`${root}/entries`), request, { headers })
	return response.data.ocs.data
}

export async function updateEntry(id: number, request: EntryRequest): Promise<Entry> {
	const response = await axios.patch<OcsResponse<Entry>>(generateOcsUrl(`${root}/entries/{id}`, { id }), request, { headers })
	return response.data.ocs.data
}

export async function deleteEntry(id: number): Promise<void> {
	await axios.delete(generateOcsUrl(`${root}/entries/{id}`, { id }), { headers })
}

export async function getOverview(): Promise<Overview> {
	return get<Overview>('/views/overview')
}

export async function getDay(date: string): Promise<{ date: string, sections: EntrySection[] }> {
	return get('/views/day', { date })
}

export async function getWeek(date: string): Promise<{ weekStart: string } & PeriodEntriesResponse> {
	return get('/views/week', { date })
}

export async function getMonth(date: string): Promise<{ monthStart: string } & PeriodEntriesResponse> {
	return get('/views/month', { date })
}

export async function getFuture(): Promise<{ sections: EntrySection[] }> {
	return get('/views/future')
}
