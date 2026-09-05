const { chromium, request } = require('playwright')
const assert = require('node:assert/strict')

const baseUrl = process.env.NC_BASE_URL || 'https://nextcloud.local'
const username = process.env.NC_TEST_USER
const password = process.env.NC_TEST_PASSWORD

if (!username || !password) {
	throw new Error('NC_TEST_USER and NC_TEST_PASSWORD are required.')
}

const uuid = () => crypto.randomUUID()

async function accountFromIndexedDb(page) {
	return page.evaluate(() => new Promise((resolve, reject) => {
		const open = indexedDB.open('taskbook-pwa')
		open.onerror = () => reject(open.error)
		open.onsuccess = () => {
			const get = open.result.transaction('account').objectStore('account').get('primary')
			get.onerror = () => reject(get.error)
			get.onsuccess = () => resolve(get.result)
		}
	}))
}

async function entriesFromIndexedDb(page) {
	return page.evaluate(() => new Promise((resolve, reject) => {
		const open = indexedDB.open('taskbook-pwa')
		open.onerror = () => reject(open.error)
		open.onsuccess = () => {
			const get = open.result.transaction('entries').objectStore('entries').getAll()
			get.onerror = () => reject(get.error)
			get.onsuccess = () => resolve(get.result)
		}
	}))
}

async function provision(page, context) {
	const synced = page.waitForResponse((response) => response.url().endsWith('/api/v1/sync') && response.status() === 200, { timeout: 30_000 })
	const popupPromise = context.waitForEvent('page')
	await page.getByRole('button', { name: 'Connect to Nextcloud' }).click()
	const popup = await popupPromise
	await popup.waitForLoadState('domcontentloaded')
	const login = popup.getByText('Log in', { exact: true })
	const grant = popup.getByRole('button', { name: /grant access/i })
	await login.or(grant).or(popup.locator('#user')).first().waitFor()
	if (await login.isVisible()) { await login.click() }
	await grant.or(popup.locator('#user')).first().waitFor()
	if (await popup.locator('#user').isVisible().catch(() => false)) {
		await popup.locator('#user').fill(username)
		await popup.locator('#password').fill(password)
		await popup.locator('button[type="submit"], input[type="submit"]').click()
	}
	await grant.click({ timeout: 15_000 })
	await page.getByRole('navigation', { name: 'Taskbook views' }).waitFor({ timeout: 30_000 })
	await page.locator('.sync-button[aria-label="Synchronization"]').waitFor({ timeout: 30_000 })
	await synced
	await page.locator('dialog[open]').waitFor({ state: 'detached' })
}

async function openEditorFor(page, text) {
	const row = page.locator('.entry-row').filter({ hasText: text }).first()
	await row.getByRole('button', { name: 'Edit' }).click()
	return page.getByRole('dialog')
}

async function addEntry(page, text) {
	await page.getByRole('button', { name: 'Quick Add' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.locator('textarea').fill(text)
	await dialog.getByRole('button', { name: 'Save' }).click()
}

async function main() {
	const args = baseUrl.startsWith('http://') ? [`--unsafely-treat-insecure-origin-as-secure=${baseUrl}`] : []
	const browser = await chromium.launch({ headless: true, args })
	const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, colorScheme: 'light' })
	context.setDefaultTimeout(15_000)
	const page = await context.newPage()
	await page.goto(`${baseUrl}/index.php/login`)
	await page.locator('#user').fill(username)
	await page.locator('#password').fill(password)
	await page.locator('button[type="submit"], input[type="submit"]').click()
	await page.waitForURL((url) => !url.pathname.endsWith('/login'))
	await page.goto(`${baseUrl}/index.php/apps/taskbook/pwa/`)
	await page.getByRole('heading', { name: 'Set up Taskbook' }).waitFor()
	await provision(page, context)
	await page.evaluate(() => navigator.serviceWorker.ready)

	await context.setOffline(true)
	await addEntry(page, 'Offline first')
	let dialog = await openEditorFor(page, 'Offline first')
	await dialog.locator('textarea').fill('Offline edited')
	await dialog.getByRole('button', { name: 'Save' }).click()
	await page.locator('.entry-row').filter({ hasText: 'Offline edited' }).getByRole('button', { name: 'Complete' }).click()
	await addEntry(page, 'm #n - Future offline ')
	assert.match(await page.locator('.sync-button').innerText(), /\([1-9]\d*\)$/)
	await page.reload()
	await page.getByRole('navigation', { name: 'Taskbook views' }).waitFor()
	await page.getByText('Offline edited').waitFor()
	await page.getByRole('button', { name: 'Future Log' }).click()
	await page.getByText('Future offline').waitFor()

	await context.setOffline(false)
	await page.locator('.sync-button[aria-label="Synchronization"]').waitFor({ timeout: 30_000 })
	let entries = await entriesFromIndexedDb(page)
	const edited = entries.find((entry) => entry.text === 'Offline edited')
	const future = entries.find((entry) => entry.text === 'Future offline')
	assert.ok(edited && edited.revision > 0)
	assert.ok(future && future.revision > 0)

	const account = await accountFromIndexedDb(page)
	const authorization = `Basic ${Buffer.from(`${account.loginName}:${account.appPassword}`).toString('base64')}`
	const api = await request.newContext({ baseURL: baseUrl, ignoreHTTPSErrors: true, extraHTTPHeaders: { Accept: 'application/json', Authorization: authorization, 'OCS-APIRequest': 'true' } })
	const ocs = async (method, path, data) => {
		const response = await api.fetch(path, { method, data, headers: data === undefined ? {} : { 'Content-Type': 'application/json' } })
		const body = await response.json()
		return { status: response.status(), data: body.ocs?.data }
	}

	await page.getByRole('button', { name: 'Day' }).click()
	await context.setOffline(true)
	dialog = await openEditorFor(page, 'Offline edited')
	await dialog.locator('textarea').fill('Mine one')
	await dialog.getByRole('button', { name: 'Save' }).click()
	await ocs('PATCH', `/ocs/v2.php/apps/taskbook/api/v1/entries/${edited.id}`, { text: 'Server one', type: edited.type, important: edited.important, contextId: edited.contextId, referenceType: edited.referenceType, targetDate: edited.effectiveTargetDate, status: edited.status })
	await context.setOffline(false)
	await page.getByText('This item changed on another device.').waitFor({ timeout: 30_000 })
	await page.getByRole('button', { name: 'Use server version' }).click()
	await page.getByText('Server one').waitFor()

	entries = await entriesFromIndexedDb(page)
	const serverOne = entries.find((entry) => entry.text === 'Server one')
	await context.setOffline(true)
	dialog = await openEditorFor(page, 'Server one')
	await dialog.locator('textarea').fill('Mine two')
	await dialog.getByRole('button', { name: 'Save' }).click()
	await ocs('PATCH', `/ocs/v2.php/apps/taskbook/api/v1/entries/${serverOne.id}`, { text: 'Server two', type: serverOne.type, important: serverOne.important, contextId: serverOne.contextId, referenceType: serverOne.referenceType, targetDate: serverOne.effectiveTargetDate, status: serverOne.status })
	await context.setOffline(false)
	await page.getByText('This item changed on another device.').waitFor({ timeout: 30_000 })
	await page.getByRole('button', { name: 'Keep mine' }).click()
	await page.locator('.sync-button[aria-label="Synchronization"]').waitFor({ timeout: 30_000 })
	await page.getByText('Mine two').waitFor()

	const contextId = (await entriesFromIndexedDb(page))[0].contextId
	const operationId = uuid()
	const clientUid = uuid()
	const idempotentMutation = { operationId, clientUid, type: 'create', baseRevision: 0, entry: { text: 'Idempotent probe', type: 'note', important: false, contextId, referenceType: 'none', targetDate: null, status: 'open' } }
	const first = await ocs('POST', '/ocs/v2.php/apps/taskbook/api/v1/sync', { installationId: uuid(), cursor: account.lastSyncCursor, mutations: [idempotentMutation] })
	const second = await ocs('POST', '/ocs/v2.php/apps/taskbook/api/v1/sync', { installationId: uuid(), cursor: account.lastSyncCursor, mutations: [idempotentMutation] })
	assert.equal(first.data.canonicalChanges.find((entry) => entry.clientUid === clientUid).id, second.data.canonicalChanges.find((entry) => entry.clientUid === clientUid).id)

	await context.setOffline(true)
	await page.getByRole('button', { name: 'Future Log' }).click()
	const futureRow = page.locator('.entry-row').filter({ hasText: 'Future offline' }).first()
	await futureRow.getByRole('button', { name: 'Delete' }).click()
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
	await context.setOffline(false)
	await page.locator('.sync-button[aria-label="Synchronization"]').waitFor({ timeout: 30_000 })
	assert.equal((await ocs('GET', `/ocs/v2.php/apps/taskbook/api/v1/entries/${future.id}`)).status, 404)

	await context.setOffline(true)
	const mineTwo = (await entriesFromIndexedDb(page)).find((entry) => entry.text === 'Mine two')
	await ocs('DELETE', `/ocs/v2.php/apps/taskbook/api/v1/entries/${mineTwo.id}`)
	await context.setOffline(false)
	await page.getByRole('button', { name: 'Synchronization' }).click()
	await page.getByRole('button', { name: 'Day' }).click()
	await page.getByText('Mine two').waitFor({ state: 'detached', timeout: 30_000 })

	await page.setViewportSize({ width: 1280, height: 800 })
	await page.emulateMedia({ colorScheme: 'dark' })
	assert.equal(await page.locator('footer.footer').count(), 0)
	assert.equal(await page.getByRole('button', { name: /^Overdue \(\d+\)$/ }).count(), 1)
	assert.equal(await page.locator('.main').evaluate((element) => getComputedStyle(element).overflowY), 'auto')
	assert.notEqual(await page.locator('.app-icon').evaluate((element) => getComputedStyle(element).filter), 'none')
	await page.keyboard.press('Shift+N')
	await page.getByRole('dialog').waitFor()
	await page.keyboard.press('Escape')

	await api.dispose()
	await context.close()
	await browser.close()
	console.log('PWA acceptance: offline CRUD, reload, reconnect, conflicts, tombstones, idempotency, mobile, desktop, keyboard, and dark mode passed.')
}

main().catch((error) => {
	console.error(error instanceof Error ? (error.stack ?? error.message) : String(error))
	process.exit(1)
})
