package internal

// // Serve site previews
// routerAdd('GET', '/_preview/{site}', (e) => {
// 	if (!e.request) {
// 		throw new Error('No request')
// 	}

// 	const siteId = e.request.pathValue('site')
// 	let site
// 	try {
// 		site = $app.findRecordById('sites', siteId)
// 	} catch {
// 		throw new NotFoundError('Site not found')
// 	}

// 	// Respond with compiled HTML
// 	const fileKey = site.baseFilesPath() + '/' + site.get('preview')
// 	let fsys, reader, content
// 	try {
// 		fsys = $app.newFilesystem()
// 		reader = fsys.getReader(fileKey)
// 		content = toString(reader)
// 		return e.blob(200, 'text/html', content)
// 	} catch {
// 		return e.string(404, 'Preview not found')
// 	} finally {
// 		reader?.close()
// 		fsys?.close()
// 	}
// })

// // Serve compiled symbol JavaScript
// routerAdd('GET', '/_symbols/{filename}', (e) => {
// 	if (!e.request?.url) {
// 		throw new Error('No request URL')
// 	}

// 	const filename = e.request.pathValue('filename')

// 	// Filename must end with .js
// 	if (!filename.endsWith('.js')) {
// 		throw new NotFoundError('File not found')
// 	}

// 	// Find symbol
// 	const symbolId = filename.slice(0, -'.js'.length)
// 	const symbol = $app.findRecordById('site_symbols', symbolId)

// 	// Respond with compiled JavaScript
// 	const fileKey = symbol.baseFilesPath() + '/' + symbol.get('compiled_js')
// 	let fsys, reader, content
// 	try {
// 		fsys = $app.newFilesystem()
// 		reader = fsys.getReader(fileKey)
// 		content = toString(reader)
// 		return e.blob(200, 'text/javascript', content)
// 	} finally {
// 		reader?.close()
// 		fsys?.close()
// 	}
// })

// // Get instance ID
// routerAdd('GET', '/_instance', (e) => {
// 	const id = $app.findFirstRecordByData('telemetry_values', 'key', 'instance_id')
// 	const version = $os.getenv('PALA_VERSION') || 'unknown'
// 	const telemetry_enabled = $os.getenv('PALA_DISABLE_USAGE_STATS') !== 'true'
// 	return e.json(200, { id: id.getString('value'), version, telemetry_enabled })
// })

func RegisterGenerateEndpoint() {

}
