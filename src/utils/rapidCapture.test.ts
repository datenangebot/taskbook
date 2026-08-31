import type { Context } from '../types.ts'

import { describe, expect, it } from 'vitest'
import { parseRapidCapture } from './rapidCapture.ts'

const today = '2026-08-28'
const contexts: Context[] = [
	{ id: 1, title: 'Work', icon: '💼', alias: 'w', createdAt: '', updatedAt: '' },
	{ id: 2, title: 'Projects', icon: '🚀', alias: 'pr', createdAt: '', updatedAt: '' },
]

describe('parseRapidCapture', () => {
	it('parses the supported type prefixes', () => {
		expect(parseRapidCapture('- hello', today)).toMatchObject({ type: 'note', text: 'hello' })
		expect(parseRapidCapture('o dentist', today)).toMatchObject({ type: 'appointment', text: 'dentist' })
		expect(parseRapidCapture('○ dentist', today)).toMatchObject({ type: 'appointment', text: 'dentist' })
	})

	it('parses priority and time-reference prefixes', () => {
		expect(parseRapidCapture('! task', today)).toMatchObject({ important: true, text: 'task' })
		expect(parseRapidCapture('d call', today)).toMatchObject({ referenceType: 'day', targetDate: '2026-08-28', text: 'call' })
		expect(parseRapidCapture('w review', today)).toMatchObject({ referenceType: 'week', targetDate: '2026-08-24', text: 'review' })
		expect(parseRapidCapture('m planning', today)).toMatchObject({ referenceType: 'month', targetDate: '2026-08-01', text: 'planning' })
	})

	it('waits for whitespace before consuming a command token', () => {
		expect(parseRapidCapture('#n', today)).toEqual({ text: '#n' })
		expect(parseRapidCapture('#nn', today)).toEqual({ text: '#nn' })
		expect(parseRapidCapture('#t', today)).toEqual({ text: '#t' })
		expect(parseRapidCapture('#2026-09-1', today)).toEqual({ text: '#2026-09-1' })
		expect(parseRapidCapture('w', today)).toEqual({ text: 'w' })
		expect(parseRapidCapture('!', today)).toEqual({ text: '!' })
		expect(parseRapidCapture('#n ', today)).toEqual({ targetDate: '2026-08-29', text: '' })
		expect(parseRapidCapture('#nn ', today)).toEqual({ targetDate: '2026-08-30', text: '' })
		expect(parseRapidCapture('#t ', today)).toEqual({ targetDate: '2026-08-28', text: '' })
		expect(parseRapidCapture('w ', today)).toEqual({ referenceType: 'week', targetDate: '2026-08-24', text: '' })
		expect(parseRapidCapture('! ', today)).toEqual({ important: true, text: '' })
	})

	it('resolves whitespace-completed Context aliases case-insensitively', () => {
		expect(parseRapidCapture('@w', today, 'day', contexts)).toEqual({ text: '@w' })
		expect(parseRapidCapture('@w ', today, 'day', contexts)).toEqual({ contextId: 1, text: '' })
		expect(parseRapidCapture('@PR Review', today, 'day', contexts)).toEqual({ contextId: 2, text: 'Review' })
		expect(parseRapidCapture('Prepare report @W ', today, 'day', contexts)).toEqual({ contextId: 1, text: 'Prepare report' })
	})

	it('retains unknown aliases and ordinary email text', () => {
		expect(parseRapidCapture('@missing ', today, 'day', contexts)).toEqual({ text: '@missing ' })
		expect(parseRapidCapture('Email john@example.com ', today, 'day', contexts)).toEqual({ text: 'Email john@example.com ' })
	})

	it('keeps w and @w namespaces distinct and combines aliases with other commands', () => {
		expect(parseRapidCapture('w ', today, 'day', contexts)).toEqual({ referenceType: 'week', targetDate: '2026-08-24', text: '' })
		expect(parseRapidCapture('@w ', today, 'day', contexts)).toEqual({ contextId: 1, text: '' })
		expect(parseRapidCapture('! w #n @pr - Review', today, 'day', contexts)).toEqual({ important: true, referenceType: 'week', targetDate: '2026-08-31', contextId: 2, type: 'note', text: 'Review' })
	})

	it('combines leading prefixes in their typed order', () => {
		expect(parseRapidCapture('! w - weekly review', today)).toEqual({ important: true, referenceType: 'week', targetDate: '2026-08-24', type: 'note', text: 'weekly review' })
	})

	it('parses today and next target prefixes using the final reference type', () => {
		expect(parseRapidCapture('#t Call customer', today)).toEqual({ targetDate: '2026-08-28', text: 'Call customer' })
		expect(parseRapidCapture('#n Call customer', today)).toEqual({ targetDate: '2026-08-29', text: 'Call customer' })
		expect(parseRapidCapture('w #n Weekly planning', today)).toEqual({ referenceType: 'week', targetDate: '2026-08-31', text: 'Weekly planning' })
		expect(parseRapidCapture('#n w Weekly planning', today)).toEqual({ referenceType: 'week', targetDate: '2026-08-31', text: 'Weekly planning' })
		expect(parseRapidCapture('m #n Monthly planning', today)).toEqual({ referenceType: 'month', targetDate: '2026-09-01', text: 'Monthly planning' })
		expect(parseRapidCapture('w #t Weekly review', today)).toEqual({ referenceType: 'week', targetDate: '2026-08-24', text: 'Weekly review' })
		expect(parseRapidCapture('m #t Monthly review', today)).toEqual({ referenceType: 'month', targetDate: '2026-08-01', text: 'Monthly review' })
	})

	it('parses the period after next and later without partially consuming #nn', () => {
		expect(parseRapidCapture('#nn test', today)).toEqual({ targetDate: '2026-08-30', text: 'test' })
		expect(parseRapidCapture('w #nn test', today)).toEqual({ referenceType: 'week', targetDate: '2026-09-07', text: 'test' })
		expect(parseRapidCapture('m #nn test', today)).toEqual({ referenceType: 'month', targetDate: '2026-10-01', text: 'test' })
		expect(parseRapidCapture('#l test', today)).toEqual({ referenceType: 'none', targetDate: null, text: 'test' })
		expect(parseRapidCapture('! w #nn - Review', today)).toEqual({ important: true, referenceType: 'week', targetDate: '2026-09-07', type: 'note', text: 'Review' })
		expect(parseRapidCapture('m #l - Someday idea', today)).toEqual({ referenceType: 'none', targetDate: null, type: 'note', text: 'Someday idea' })
	})

	it('normalizes explicit target dates for the final reference type', () => {
		expect(parseRapidCapture('#2026-09-15 Submit report', today)).toEqual({ targetDate: '2026-09-15', text: 'Submit report' })
		expect(parseRapidCapture('w #2026-09-15 Weekly report', today)).toEqual({ referenceType: 'week', targetDate: '2026-09-14', text: 'Weekly report' })
		expect(parseRapidCapture('m #2026-09-15 Monthly report', today)).toEqual({ referenceType: 'month', targetDate: '2026-09-01', text: 'Monthly report' })
	})

	it('combines target, priority, type and reference prefixes in any supported order', () => {
		expect(parseRapidCapture('! w #n - Weekly retrospective', today)).toEqual({ important: true, referenceType: 'week', targetDate: '2026-08-31', type: 'note', text: 'Weekly retrospective' })
		expect(parseRapidCapture(' !  m  #2026-10-01  ·  Prepare taxes', today)).toEqual({ important: true, referenceType: 'month', targetDate: '2026-10-01', type: 'task', text: 'Prepare taxes' })
	})

	it('validates dates and uses local calendar arithmetic across boundaries', () => {
		expect(parseRapidCapture('#2026-02-29 Invalid date', today)).toEqual({ text: '#2026-02-29 Invalid date' })
		expect(parseRapidCapture('#2028-02-29 Leap day', today)).toEqual({ targetDate: '2028-02-29', text: 'Leap day' })
		expect(parseRapidCapture('#n New year', '2026-12-31')).toEqual({ targetDate: '2027-01-01', text: 'New year' })
		expect(parseRapidCapture('w #n Next week', '2026-12-31')).toEqual({ referenceType: 'week', targetDate: '2027-01-04', text: 'Next week' })
		expect(parseRapidCapture('m #n Next month', '2026-12-31')).toEqual({ referenceType: 'month', targetDate: '2027-01-01', text: 'Next month' })
	})

	it('keeps the selected granularity for date commands', () => {
		expect(parseRapidCapture('#t ', today, 'week')).toEqual({ targetDate: '2026-08-24', text: '' })
		expect(parseRapidCapture('#n ', today, 'week')).toEqual({ targetDate: '2026-08-31', text: '' })
		expect(parseRapidCapture('#nn ', today, 'week')).toEqual({ targetDate: '2026-09-07', text: '' })
		expect(parseRapidCapture('#t ', today, 'month')).toEqual({ targetDate: '2026-08-01', text: '' })
		expect(parseRapidCapture('#n ', today, 'month')).toEqual({ targetDate: '2026-09-01', text: '' })
		expect(parseRapidCapture('#2026-09-15 ', today, 'month')).toEqual({ targetDate: '2026-09-01', text: '' })
	})

	it('does not consume ordinary words as ASCII prefixes', () => {
		expect(parseRapidCapture('work item', today)).toEqual({ text: 'work item' })
		expect(parseRapidCapture('open issue', today)).toEqual({ text: 'open issue' })
		expect(parseRapidCapture('Discuss issue #123', today)).toEqual({ text: 'Discuss issue #123' })
		expect(parseRapidCapture('#news', today)).toEqual({ text: '#news' })
	})

	it('waits for whitespace before consuming trailing commands', () => {
		expect(parseRapidCapture('Call customer w', today)).toEqual({ text: 'Call customer w' })
		expect(parseRapidCapture('Call customer #n', today)).toEqual({ text: 'Call customer #n' })
		expect(parseRapidCapture('Call customer w ', today)).toEqual({ referenceType: 'week', targetDate: '2026-08-24', text: 'Call customer' })
		expect(parseRapidCapture('Call customer ! ', today)).toEqual({ important: true, text: 'Call customer' })
		expect(parseRapidCapture('Meeting o ', today)).toEqual({ type: 'appointment', text: 'Meeting' })
	})

	it('parses coherent trailing command sequences', () => {
		expect(parseRapidCapture('Planning m #n ', today)).toEqual({ referenceType: 'month', targetDate: '2026-09-01', text: 'Planning' })
		expect(parseRapidCapture('Planning w #nn ', today)).toEqual({ referenceType: 'week', targetDate: '2026-09-07', text: 'Planning' })
		expect(parseRapidCapture('Weekly retrospective - ! w #n ', today)).toEqual({ type: 'note', important: true, referenceType: 'week', targetDate: '2026-08-31', text: 'Weekly retrospective' })
		expect(parseRapidCapture('Submit report #2026-09-15 ', today)).toEqual({ targetDate: '2026-09-15', text: 'Submit report' })
	})

	it('keeps the selected granularity for trailing date commands', () => {
		expect(parseRapidCapture('Planning #n ', today, 'week')).toEqual({ targetDate: '2026-08-31', text: 'Planning' })
		expect(parseRapidCapture('Planning #nn ', today, 'month')).toEqual({ targetDate: '2026-10-01', text: 'Planning' })
	})

	it('does not interpret command-like words in the middle of ordinary text', () => {
		expect(parseRapidCapture('Talk about w project ', today)).toEqual({ text: 'Talk about w project ' })
		expect(parseRapidCapture('Discuss #n planning later ', today)).toEqual({ text: 'Discuss #n planning later ' })
	})
})
