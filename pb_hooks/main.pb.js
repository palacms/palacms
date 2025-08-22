/// <reference path="../pb_data/types.d.ts" />
// @ts-check

onBootstrap((e) => {
	// Some typings for this should be availabe in next Pocketbase update.
	// https://github.com/pocketbase/pocketbase/discussions/7091#discussioncomment-14085548
	// TODO: Use provided typings after the Pocketbase update.
	$app.onServe().bindFunc((/** @type {core.ServeEvent} */ e) => {
		e.installerFunc = (app, systemSuperuser) => {
			systemSuperuser.setPassword('public-secret')
			app.save(systemSuperuser)
		}

		const { init_usage_stats } = require(__hooks + '/stats.cjs')
		init_usage_stats()

		e.next()
	})

	e.next()
})

// Validate records
onRecordValidate((e) => {
	if (!e.record) {
		e.next()
		return
	}

	// Select model for validation
	const { models } = require(__hooks + '/common/index.cjs')
	const collection = e.record.collection()
	const model = models[collection.name]
	if (!model) {
		e.next()
		return
	}

	// Gather and parse values
	const values = {}
	for (const field of collection.fields) {
		const name = field.getName()
		let value = e.record.get(name)
		if (field.type() === 'json') {
			value = JSON.parse(value.string())
		}
		if (field.type() === 'file') {
			// File fields are validated as strings of filenames
			value = Array.isArray(value) ? value.map((file) => file.name ?? '') : (value.name ?? '')
		}
		values[name] = value
	}

	// Validate
	try {
		model.parse(values)
	} catch (error) {
		console.error(error)
		throw new ValidationError()
	}

	e.next()
})

// Send email invitations
onRecordAfterCreateSuccess((e) => {
	if (e.record?.get('invite') === 'pending') {
		try {
			const { sendInvitation } = require(`${__hooks}/invitation.cjs`)
			sendInvitation(e)
		} catch (error) {
			console.error(error)
		}
	}

	e.next()
}, 'users')

// Send email invitations
onRecordAfterUpdateSuccess((e) => {
	if (e.record?.get('invite') === 'pending') {
		try {
			const { sendInvitation } = require(`${__hooks}/invitation.cjs`)
			sendInvitation(e)
		} catch (error) {
			console.error(error)
		}
	}

	e.next()
}, 'users')

// Serve admin pages
routerAdd('GET', '/admin/{path...}', (e) => {
	if (!e.request?.url) {
		throw new Error('No request URL')
	}

	const next = $apis.static('./pb_public', true)
	const isFile = /\.\w+$/.test(e.request.url.path)
	if (isFile || e.request.url.path === '/admin/setup') {
		next(e)
		return
	}

	const superuserCount = $app.countRecords(
		'_superusers',
		$dbx.not(
			$dbx.hashExp({
				email: '__pbinstaller@example.com'
			})
		)
	)
	const setupRequired = superuserCount === 0
	if (setupRequired) {
		e.redirect(302, '/admin/setup')
	} else {
		next(e)
	}
})

// Serve sites
routerAdd('GET', '/{path...}', (e) => {
	if (!e.request?.url) {
		throw new Error('No request URL')
	}

	// Handle missing trailing slash
	if (e.request.url.path.slice(-1) !== '/') {
		return e.redirect(301, e.request.url.path + '/')
	}

	const host = e.request.host
	const path = e.request.pathValue('path').slice(0, -1).split('/')
	const finalSlug = path[path.length - 1]

	// Find the target page by slug
	const [page] = $app.findRecordsByFilter('pages', `site.host = {:host} && slug = {:slug}`, 'id', 1, 0, { host, slug: finalSlug || null })
	if (!page && !finalSlug) {
		// Homepage not found, redirect to site editor
		return e.redirect(302, '/admin')
	} else if (!page) {
		throw new NotFoundError('Page not found')
	}

	// Check that path is correct
	let current = page
	for (const segment of [...path].reverse().slice(1)) {
		current = $app.findRecordById('pages', current.get('parent'))
		if (current.get('slug') !== segment) {
			throw new NotFoundError('Page not found')
		}
	}

	// Respond with compiled HTML
	const fileKey = page.baseFilesPath() + '/' + page.get('compiled_html')
	let fsys, reader, content
	try {
		fsys = $app.newFilesystem()
		reader = fsys.getReader(fileKey)
		content = toString(reader)
		return e.blob(200, 'text/html', content)
	} finally {
		reader?.close()
		fsys?.close()
	}
})

// Serve site previews
routerAdd('GET', '/_preview/{site}', (e) => {
	if (!e.request) {
		throw new Error('No request')
	}

	const siteId = e.request.pathValue('site')
	let site
	try {
		site = $app.findRecordById('sites', siteId)
	} catch {
		throw new NotFoundError('Site not found')
	}

	// Respond with compiled HTML
	const fileKey = site.baseFilesPath() + '/' + site.get('preview')
	let fsys, reader, content
	try {
		fsys = $app.newFilesystem()
		reader = fsys.getReader(fileKey)
		content = toString(reader)
		return e.blob(200, 'text/html', content)
	} catch {
		return e.string(404, 'Preview not found')
	} finally {
		reader?.close()
		fsys?.close()
	}
})

// Serve compiled symbol JavaScript
routerAdd('GET', '/_symbols/{filename}', (e) => {
	if (!e.request?.url) {
		throw new Error('No request URL')
	}

	const filename = e.request.pathValue('filename')

	// Filename must end with .js
	if (!filename.endsWith('.js')) {
		throw new NotFoundError('File not found')
	}

	// Find symbol
	const symbolId = filename.slice(0, -'.js'.length)
	const symbol = $app.findRecordById('site_symbols', symbolId)

	// Respond with compiled JavaScript
	const fileKey = symbol.baseFilesPath() + '/' + symbol.get('compiled_js')
	let fsys, reader, content
	try {
		fsys = $app.newFilesystem()
		reader = fsys.getReader(fileKey)
		content = toString(reader)
		return e.blob(200, 'text/javascript', content)
	} finally {
		reader?.close()
		fsys?.close()
	}
})

// Get instance ID
routerAdd('GET', '/_instance', (e) => {
	const id = $app.findFirstRecordByData('telemetry_values', 'key', 'instance_id')
	const version = $os.getenv('PALA_VERSION') || 'unknown'
	const telemetry_enabled = $os.getenv('PALA_DISABLE_USAGE_STATS') !== 'true'
	return e.json(200, { id: id.getString('value'), version, telemetry_enabled })
})
