import type { Context, EntryType, ReferenceType } from '../types.ts'

import { contextIdForAlias } from './contextAliases.ts'
import { addDays, addMonths, dateForReference, localDateKey, monthStart } from './dates.ts'

export interface RapidCaptureParse {
	text: string
	type?: EntryType
	important?: boolean
	referenceType?: ReferenceType
	targetDate?: string | null
	contextId?: number
}

type TargetCommand = 'today' | 'next' | 'after_next' | 'later' | string
interface CommandState {
	referenceChanged: boolean
	referenceType: ReferenceType
	targetCommand?: TargetCommand
}

function isValidIsoDate(value: string): boolean {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
	if (match === null) {
		return false
	}
	const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
	return localDateKey(date) === value
}

function nextAnchor(referenceType: ReferenceType, today: string): string {
	if (referenceType === 'month') {
		return addMonths(monthStart(today), 1)
	}
	return addDays(today, referenceType === 'week' ? 7 : 1)
}

function afterNextAnchor(referenceType: ReferenceType, today: string): string {
	if (referenceType === 'month') {
		return addMonths(monthStart(today), 2)
	}
	return addDays(today, referenceType === 'week' ? 14 : 2)
}

function applyCommand(token: string, result: RapidCaptureParse, state: CommandState, contexts: Context[]): boolean {
	if (token === '(·)') {
		result.type = 'irrelevant_task'
		return true
	}
	if (token === '!') {
		result.important = true
		return true
	}
	const contextAlias = /^@([\p{L}\p{N}_-]{1,16})$/u.exec(token)?.[1]
	if (contextAlias !== undefined) {
		const contextId = contextIdForAlias(contextAlias, contexts)
		if (contextId === undefined) {
			return false
		}
		result.contextId = contextId
		return true
	}
	if (/^#\d{4}-\d{2}-\d{2}$/u.test(token)) {
		const date = token.slice(1)
		if (!isValidIsoDate(date)) {
			return false
		}
		state.targetCommand = date
		return true
	}
	if (token === '#nn') {
		state.targetCommand = 'after_next'
		return true
	}
	if (token === '#n') {
		state.targetCommand = 'next'
		return true
	}
	if (token === '#t') {
		state.targetCommand = 'today'
		return true
	}
	if (token === '#l') {
		state.targetCommand = 'later'
		return true
	}
	if (['·', '○', '-', '>'].includes(token)) {
		result.type = ({ '·': 'task', '○': 'appointment', '-': 'note', '>': 'migrated_task' } as const)[token as '·' | '○' | '-' | '>']
		return true
	}
	if (token === 'o') {
		result.type = 'appointment'
		return true
	}
	if (['d', 'w', 'm'].includes(token)) {
		state.referenceType = token === 'd' ? 'day' : token === 'w' ? 'week' : 'month'
		state.referenceChanged = true
		return true
	}
	return false
}

/**
 * Parses only whitespace-completed command tokens at the leading or trailing edge.
 *
 * @param input Raw capture text.
 * @param today Local current date.
 * @param initialReferenceType Currently selected dated granularity.
 * @param contexts Authenticated user's already-loaded Contexts used to resolve `@alias` tokens.
 */
export function parseRapidCapture(input: string, today: string, initialReferenceType: ReferenceType = 'day', contexts: Context[] = []): RapidCaptureParse {
	let remaining = input.trimStart()
	const result: RapidCaptureParse = { text: input }
	let parsed = false
	const state: CommandState = { referenceChanged: false, referenceType: initialReferenceType }

	while (remaining !== '') {
		const leading = /^(\S+)(?=\s)/u.exec(remaining)?.[1]
		if (leading === undefined || !applyCommand(leading, result, state, contexts)) {
			break
		}
		remaining = remaining.slice(leading.length).trimStart()
		parsed = true
	}

	if (/\s$/u.test(remaining)) {
		let trailingText = remaining.trimEnd()
		const trailingCommands: string[] = []
		while (trailingText !== '') {
			const match = /(\S+)$/u.exec(trailingText)
			if (match === null || !applyCommand(match[1], { text: '' }, { referenceChanged: false, referenceType: initialReferenceType }, contexts)) {
				break
			}
			trailingCommands.unshift(match[1])
			trailingText = trailingText.slice(0, match.index).trimEnd()
		}
		if (trailingCommands.length > 0) {
			for (const command of trailingCommands) {
				applyCommand(command, result, state, contexts)
			}
			remaining = trailingText
			parsed = true
		}
	}

	if (state.targetCommand === 'later') {
		result.referenceType = 'none'
		result.targetDate = null
	} else if (state.targetCommand !== undefined) {
		const anchor = state.targetCommand === 'today' ? today : state.targetCommand === 'next' ? nextAnchor(state.referenceType, today) : state.targetCommand === 'after_next' ? afterNextAnchor(state.referenceType, today) : state.targetCommand
		if (state.referenceChanged) {
			result.referenceType = state.referenceType
		}
		result.targetDate = dateForReference(state.referenceType, anchor)
	} else if (state.referenceChanged) {
		result.referenceType = state.referenceType
		result.targetDate = dateForReference(state.referenceType, today)
	}

	result.text = parsed ? remaining : input
	return result
}
