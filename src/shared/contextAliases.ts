import type { Context } from './types.ts'

export type ContextAliasValidation
	= { valid: true, alias: string }
		| { valid: false, reason: 'required' | 'invalid' }
		| { valid: false, reason: 'duplicate', contextTitle: string }

const aliasPattern = /^[\p{L}\p{N}_-]{1,16}$/u

export function normalizeContextAlias(alias: string): string {
	return alias.trim().toLowerCase()
}

export function initialContextAlias(title: string): string {
	const character = [...title.trim()][0]
	if (character === undefined) {
		return ''
	}
	const alias = character.toLowerCase()
	return aliasPattern.test(alias) ? alias : ''
}

export function contextAliasForTitle(title: string, currentAlias: string, shortcutTouched: boolean): string {
	return shortcutTouched ? currentAlias : initialContextAlias(title)
}

export function validateContextAlias(alias: string, contexts: Context[], currentId: number | null): ContextAliasValidation {
	const normalized = normalizeContextAlias(alias)
	if (normalized === '') {
		return { valid: false, reason: 'required' }
	}
	if (!aliasPattern.test(normalized)) {
		return { valid: false, reason: 'invalid' }
	}
	const duplicate = contexts.find((context) => context.id !== currentId && context.alias !== null && normalizeContextAlias(context.alias) === normalized)
	return duplicate === undefined ? { valid: true, alias: normalized } : { valid: false, reason: 'duplicate', contextTitle: duplicate.title }
}

export function contextIdForAlias(alias: string, contexts: Context[]): number | undefined {
	const normalized = normalizeContextAlias(alias)
	return contexts.find((context) => context.alias !== null && normalizeContextAlias(context.alias) === normalized)?.id
}
