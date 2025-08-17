/// <reference path="../pb_data/types.d.ts" />

// API endpoint to check if setup is needed
routerAdd('GET', '/_api/setup-status', (e) => {
	try {
		const hasUsers = $app.findFirstRecordByFilter('users', '') !== null
		let hasSuperusers = false
		try {
			hasSuperusers = $app.findFirstRecordByFilter('_superusers', '') !== null
		} catch (superuserError) {
			// _superusers collection might not exist or be accessible
			console.log('Could not check superusers:', superuserError)
			hasSuperusers = false
		}

		return e.json(200, {
			setupComplete: hasUsers,
			hasSuperuser: hasSuperusers
		})
	} catch (error) {
		// If error checking, assume setup is needed
		return e.json(200, { setupComplete: false, hasSuperuser: false })
	}
})

// API endpoint to create superuser using PocketBase admin API
routerAdd('POST', '/_api/create-superuser', (e) => {
	try {
		// Get email and password from request body first
		let email
		let password
		try {
			const body = e.request.header.get('content-type')?.includes('application/json') ? JSON.parse(readerToString(e.request.body)) : {}
			email = body.email
			password = body.password
		} catch (err) {
			console.log('Could not parse request body, using defaults')
		}

		// Check if superuser already exists with this email
		try {
			const existingSuperuser = $app.findFirstRecordByFilter('_superusers', `email = "${email}"`)
			if (existingSuperuser) {
				// Superuser with this email already exists, return success
				return e.json(200, {
					success: true,
					credentials: { email, password: 'Same as admin password' },
					message: 'Superuser already exists with this email.'
				})
			}
		} catch (err) {
			// _superusers collection might not exist or be accessible, continue
			console.log('Error checking existing superusers:', err)
		}

		// Create superuser using PocketBase admin API
		const superusersCollection = $app.findCollectionByNameOrId('_superusers')
		const admin = new Record(superusersCollection, {
			email: email,
			password: password
		})

		$app.save(admin)

		return e.json(200, {
			success: true,
			credentials: { email, password },
			message: 'Superuser created successfully. You can change the password from the admin interface.'
		})
	} catch (error) {
		console.error('Error creating superuser:', error)
		return e.json(500, { error: 'Failed to create superuser: ' + error.message })
	}
})

onRecordValidate((e) => {
	if (!e.record) {
		e.next()
		return
	}

	const collection = e.record.collection()

	// Skip validation for users collection during creation
	// The users collection has its own validation
	if (collection.name === 'users') {
		e.next()
		return
	}

	// Select model for validation
	const { models } = require(__hooks + '/common/index.cjs')
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

onRecordAfterCreateSuccess((e) => {
	if (e.record.get('invite') === 'pending') {
		try {
			const { sendInvitation } = require(`${__hooks}/invitation.cjs`)
			sendInvitation(e)
		} catch (error) {
			console.error(error)
		}
	}

	e.next()
}, 'users')

onRecordAfterUpdateSuccess((e) => {
	if (e.record.get('invite') === 'pending') {
		try {
			const { sendInvitation } = require(`${__hooks}/invitation.cjs`)
			sendInvitation(e)
		} catch (error) {
			console.error(error)
		}
	}

	e.next()
}, 'users')

routerAdd('GET', '/{path...}', (e) => {
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
		return e.notFoundError('Page not found')
	}

	// Check that path is correct
	let current = page
	for (const segment of [...path].reverse().slice(1)) {
		current = $app.findRecordById('pages', current.get('parent'))
		if (current.get('slug') !== segment) {
			return e.notFoundError('Page not found')
		}
	}

	// Respond with compiled HTML
	const fileKey = page.baseFilesPath() + '/' + page.get('compiled_html')
	let fsys, reader, content
	try {
		fsys = $app.newFilesystem()
		reader = fsys.getFile(fileKey)
		content = toString(reader)
		return e.blob(200, 'text/html', content)
	} finally {
		reader?.close()
		fsys?.close()
	}
})

routerAdd('GET', '/_preview/{site}', (e) => {
	const siteId = e.request.pathValue('site')
	let site
	try {
		site = $app.findRecordById('sites', siteId)
	} catch {
		return e.string(404, 'Site not found')
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

routerAdd('GET', '/_symbols/{filename}', (e) => {
	const filename = e.request.pathValue('filename')

	// Filename must end with .js
	if (!filename.endsWith('.js')) {
		return e.notFoundError('File not found')
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
