import type { Context } from '../types.ts'

import { describe, expect, it } from 'vitest'
import { contextAliasForTitle, contextIdForAlias, initialContextAlias, normalizeContextAlias, validateContextAlias } from './contextAliases.ts'

function context(id: number, title: string, alias: string | null): Context {
	return { id, title, alias, icon: '😀', createdAt: '', updatedAt: '' }
}

describe('context aliases', () => {
	it('derives the first meaningful Unicode code point', () => {
		expect(initialContextAlias('   Work')).toBe('w')
		expect(initialContextAlias('Ärzte')).toBe('ä')
		expect(initialContextAlias('😀 Team')).toBe('')
	})

	it('updates an untouched proposal without overwriting a manual shortcut', () => {
		expect(contextAliasForTitle('Work', '', false)).toBe('w')
		expect(contextAliasForTitle('Personal', 'w', false)).toBe('p')
		expect(contextAliasForTitle('Office', 'job', true)).toBe('job')
	})

	it('normalizes and validates the supported grammar', () => {
		expect(normalizeContextAlias(' WoRK ')).toBe('work')
		expect(validateContextAlias('project_2', [], null)).toEqual({ valid: true, alias: 'project_2' })
		expect(validateContextAlias('@work', [], null)).toEqual({ valid: false, reason: 'invalid' })
		expect(validateContextAlias('two words', [], null)).toEqual({ valid: false, reason: 'invalid' })
	})

	it('detects duplicates case-insensitively while excluding the edited context', () => {
		const contexts = [context(1, 'Work', 'w')]
		expect(validateContextAlias('W', contexts, null)).toEqual({ valid: false, reason: 'duplicate', contextTitle: 'Work' })
		expect(validateContextAlias('W', contexts, 1)).toEqual({ valid: true, alias: 'w' })
	})

	it('resolves aliases case-insensitively and ignores missing aliases', () => {
		const contexts = [context(1, 'Legacy', null), context(2, 'Projects', 'pr')]
		expect(contextIdForAlias('PR', contexts)).toBe(2)
		expect(contextIdForAlias('missing', contexts)).toBeUndefined()
	})
})
