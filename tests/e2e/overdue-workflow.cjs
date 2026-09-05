const { chromium, request } = require('playwright')
const assert = require('node:assert/strict')

// Use a disposable user: the test creates and removes its own entries only.
const baseUrl = process.env.NC_BASE_URL || 'http://localhost'
const username = process.env.NC_TEST_USER
const password = process.env.NC_TEST_PASSWORD

async function main() {
	assert.ok(username && password, 'Dedicated test credentials are required.')
	const api = await request.newContext({ baseURL: baseUrl, extraHTTPHeaders: {
		Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
		'OCS-APIRequest': 'true', Accept: 'application/json',
	} })
	const ids = []
	const ocs = async (method, path, data) => {
		const response = await api.fetch(`/ocs/v2.php/apps/taskbook/api/v1${path}`, { method, data })
		assert.ok(response.ok(), `${method} ${path}: ${response.status()}`)
		return (await response.json()).ocs.data
	}
	const browser = await chromium.launch()
	try {
		const context = await browser.newContext({ viewport: { width: 1280, height: 850 } })
		context.setDefaultTimeout(15_000)
		const page = await context.newPage()
		const errors = []
		page.on('pageerror', (error) => errors.push(error.message))
		await page.goto(`${baseUrl}/index.php/login`)
		await page.locator('#user').fill(username)
		await page.locator('#password').fill(password)
		await page.locator('button[type="submit"]').click()
		await page.waitForURL((url) => !url.pathname.endsWith('/login'))
		const settings = await ocs('GET', '/settings')
		assert.equal(settings.overdueReminderEnabled, true)
		assert.equal(settings.overdueReminderTime, '08:00')
		assert.deepEqual(settings.overdueReminderDays, [1, 2, 3, 4, 5, 6, 7])
		await page.goto(`${baseUrl}/index.php/apps/taskbook/overview`)
		await page.getByText('Total completed', { exact: true }).waitFor()
		assert.equal(await page.locator('.note-card').count(), 0)
		const overviewNav = page.locator('.app-navigation-entry').filter({ hasText: /^Overview$/ }).first()
		assert.equal(await overviewNav.locator('.counter-bubble__counter').count(), 0)
		const created = await ocs('POST', '/entries', { text: 'Overdue runtime probe', type: 'task', status: 'open', important: false, contextId: settings.defaultContextId, referenceType: 'day', targetDate: '2020-01-01' })
		ids.push(created.id)
		await page.reload()
		const row = page.locator('[data-taskbook-entry-row]').filter({ hasText: 'Overdue runtime probe' })
		await row.waitFor()
		await page.locator('.note-card').filter({ hasText: 'You have 1 overdue item.' }).waitFor()
		await page.locator('.counter-bubble__counter').filter({ hasText: '1' }).waitFor()
		await page.emulateMedia({ colorScheme: 'dark' })
		assert.ok(await page.locator('.note-card').evaluate((element) => getComputedStyle(element).display !== 'none'))
		await page.emulateMedia({ colorScheme: 'light' })
		await row.focus()
		await row.getByRole('button', { name: 'Mark as completed', exact: true }).click()
		await row.waitFor({ state: 'detached' })
		await page.locator('.counter-bubble__counter').waitFor({ state: 'detached' })
		await page.locator('.note-card').waitFor({ state: 'detached' })
		await page.getByRole('navigation', { name: 'Current period views' }).getByRole('button', { name: 'Future Log', exact: true }).click()
		await page.waitForURL('**/future')
		await page.keyboard.press('Shift+N')
		const editor = page.getByRole('dialog').filter({ has: page.getByRole('textbox', { name: 'Entry text' }) })
		await editor.getByRole('textbox', { name: 'Entry text' }).fill('#n Future live runtime probe ')
		await editor.getByRole('textbox', { name: 'Entry text' }).press('Enter')
		await page.getByText('Future live runtime probe', { exact: true }).waitFor()
		const future = await ocs('GET', '/views/future')
		for (const section of future.sections) {
			for (const entry of section.entries) {
				if (entry.text === 'Future live runtime probe') { ids.push(entry.id) }
			}
		}
		for (const width of [390, 1280]) {
			await page.setViewportSize({ width, height: 844 })
			for (const path of ['overview', 'day/2026-09-04', 'week/2026-W36', 'month/2026-09', 'future']) {
				await page.goto(`${baseUrl}/index.php/apps/taskbook/${path}`)
				await page.locator('.taskbook-page-heading').waitFor()
				assert.ok(await page.locator('.taskbook-page').evaluate((el) => parseFloat(getComputedStyle(el).paddingTop) >= 44))
			}
		}
		await ocs('PUT', '/settings/overdue-reminders', { overdueReminderEnabled: false, overdueReminderTime: '09:35', overdueReminderDays: [5, 1, 5] })
		const persisted = await ocs('GET', '/settings')
		assert.equal(persisted.overdueReminderEnabled, false)
		assert.equal(persisted.overdueReminderTime, '09:35')
		assert.deepEqual(persisted.overdueReminderDays, [1, 5])
		await ocs('PUT', '/settings/overdue-reminders', { overdueReminderEnabled: true, overdueReminderTime: '08:00', overdueReminderDays: [1, 2, 3, 4, 5, 6, 7] })
		assert.deepEqual(errors, [])
		console.log('Normal runtime passed: badge zero/positive/completion, Total completed, Future quick link/live creation, five views at 390/1280px, settings defaults/persistence.')
	} finally {
		for (const id of ids) { await ocs('DELETE', `/entries/${id}`) }
		await browser.close()
		await api.dispose()
	}
}

main().catch((error) => { console.error(error.stack); process.exit(1) })
