'use strict'
;(() => {
	const decoder = new TextDecoder('utf-8')
	let outputBuf = ''

	const errors = (message, code) => {
		const err = new Error(message)
		err.code = code
		return err
	}
	errors.enosys = () => errors('function not implemented', 'ENOSYS')
	errors.eacces = () => errors('permission denied', 'EACCES')
	errors.enoent = () => errors('no such file or directory', 'ENOENT')
	errors.eio = () => errors('input/output error', 'EIO')
	errors.eisdir = () => errors('is directory', 'EISDIR')
	errors.ebadf = () => errors('Bad file descriptor', 'EBADF')
	const ErrorHandler = (callback) => (error) => {
		if (error instanceof DOMException && error.name === 'NotAllowedError') {
			callback(errors.eacces())
		} else if (error instanceof DOMException && error.name === 'NotFoundError') {
			callback(errors.enoent())
		} else {
			console.error(error)
			callback(errors.eio())
		}
	}

	const getPathSegements = (path) => {
		const leadingSlash = /^\//
		const trailingSlash = /\/$/
		const trimmedPath = path.replace(leadingSlash, '').replace(trailingSlash, '')
		if (trimmedPath === '') {
			return []
		}

		const segments = trimmedPath.split('/')
		return segments
	}
	const resolveDirectory = async (path) => {
		const root = await navigator.storage.getDirectory()
		const segments = getPathSegements(path)
		let dir = root
		for (const segment of segments) {
			dir = await dir.getDirectoryHandle(segment)
		}
		return dir
	}
	const resolveFile = async (path, options) => {
		const segments = getPathSegements(path)
		const [name] = segments.slice(-1)
		const dir = await resolveDirectory('/' + segments.slice(0, -1).join('/'))
		const file = await dir.getFileHandle(name, options)
		return file
	}

	let nextFd = 3
	const handles = new Map()

	globalThis.output ||= console.log
	globalThis.fs = {
		constants: {
			O_WRONLY: 1 << 0,
			O_RDWR: 1 << 1,
			O_CREAT: 1 << 2,
			O_TRUNC: 1 << 3,
			O_APPEND: 1 << 4,
			O_EXCL: 1 << 5,
			O_DIRECTORY: 1 << 6
		},

		writeSync(fd, buf) {
			outputBuf += decoder.decode(buf)
			const nl = outputBuf.lastIndexOf('\n')
			if (nl != -1) {
				globalThis.output(outputBuf.substring(0, nl))
				outputBuf = outputBuf.substring(nl + 1)
			}
			return buf.length
		},

		write(fd, buf, offset, length, position, callback) {
			if ([1, 2].includes(fd)) {
				// STDOUT or STDERR
				if (offset !== 0 || length !== buf.length || position !== null) {
					callback(errors.enosys())
					return
				}
				const n = this.writeSync(fd, buf)
				callback(null, n)
			} else {
				if (!handles.has(fd)) {
					callback(errors.ebadf())
					return
				}

				const handle = handles.get(fd)
				if (position !== null) {
					handle.pos = position
				}

				const n = handle.write(buf, { at: handle.pos })
				handle.pos += n
				callback(null, n)
			}
		},

		chmod(path, mode, callback) {
			callback(errors.enosys())
		},

		chown(path, uid, gid, callback) {
			callback(errors.enosys())
		},

		close(fd, callback) {
			if (!handles.has(fd)) {
				callback(errors.ebadf())
				return
			}

			const handle = handles.get(fd)
			handle.close()
			handles.delete(fd)
			callback(null)
		},

		fchmod(fd, mode, callback) {
			callback(errors.enosys())
		},

		fchown(fd, uid, gid, callback) {
			callback(errors.enosys())
		},

		fstat(fd, callback) {
			if (!handles.has(fd)) {
				callback(errors.ebadf())
			}

			const handle = handles.get(fd)
			callback(null, {
				dev: 0,
				ino: 0,
				mode: 0o100755,
				nlink: 0,
				uid: 0,
				gid: 0,
				rdev: 0,
				size: handle.getSize(),
				blksize: 0,
				blocks: 0,
				atimeMs: 0,
				mtimeMs: 0,
				ctimeMs: 0,
				isDirectory: () => false
			})
		},

		fsync(fd, callback) {
			if (!handles.has(fd)) {
				callback(errors.ebadf())
				return
			}

			const handle = handles.get(fd)
			handle.flush()
			callback(null)
		},

		ftruncate(fd, length, callback) {
			if (!handles.has(fd)) {
				callback(errors.ebadf())
			}

			const handle = handles.get(fd)
			handle.truncate(length)
			callback(null)
		},

		lchown(path, uid, gid, callback) {
			callback(errors.enosys())
		},

		link(path, link, callback) {
			callback(errors.enosys())
		},

		lstat(path, callback) {
			this.stat(path, callback)
		},

		mkdir(path, perm, callback) {
			const segments = getPathSegements(path)
			const [name] = segments.slice(-1)
			const parentPath = '/' + segments.slice(0, -1).join('/')
			resolveDirectory(parentPath)
				.then(async (dir) => {
					await dir.getDirectoryHandle(name, { create: true })
					callback(null)
				})
				.catch(ErrorHandler(callback))
		},

		open(path, flags, mode, callback) {
			const options = { create: !!(flags & this.constants.O_CREAT) }
			resolveFile(path, options)
				.then(async (f) => {
					const fd = nextFd++
					const handle = await f.createSyncAccessHandle()
					handle.pos = 0
					handles.set(fd, handle)
					callback(null, fd)
				})
				.catch(ErrorHandler(callback))
		},

		read(fd, buffer, offset, length, position, callback) {
			if (!handles.has(fd)) {
				callback(errors.ebadf())
				return
			}

			const handle = handles.get(fd)
			if (position !== null) {
				handle.pos = position
			}

			const n = handle.read(buffer, { at: handle.pos })
			handle.pos += n
			callback(null, n)
		},

		readdir(path, callback) {
			callback(errors.enosys())
		},

		readlink(path, callback) {
			callback(errors.enosys())
		},

		rename(from, to, callback) {
			let buffer
			Promise.resolve()
				.then(async () => {
					const segments = getPathSegements(from)
					const [name] = segments.slice(-1)
					const parentPath = '/' + segments.slice(0, -1).join('/')
					const dir = await resolveDirectory(parentPath)
					const f = await dir.getFileHandle(name)
					const handle = await f.createSyncAccessHandle()
					const size = handle.getSize()
					buffer = new Uint8Array(size)
					handle.read(buffer)
					handle.close()
					await dir.removeEntry(name, { recursive: true })
				})
				.then(async () => {
					const segments = getPathSegements(to)
					const [name] = segments.slice(-1)
					const parentPath = '/' + segments.slice(0, -1).join('/')
					const dir = await resolveDirectory(parentPath)
					const f = await dir.getFileHandle(name, { create: true })
					const handle = await f.createSyncAccessHandle()
					handle.write(buffer)
					handle.close()
				})
				.then(() => {
					callback(null)
				})
				.catch(ErrorHandler(callback))
		},

		rmdir(path, callback) {
			const segments = getPathSegements(path)
			const [name] = segments.slice(-1)
			const parentPath = '/' + segments.slice(0, -1).join('/')
			resolveDirectory(parentPath)
				.then(async (dir) => {
					await dir.removeEntry(name, { recursive: true })
					callback(null)
				})
				.catch(ErrorHandler(callback))
		},

		stat(path, callback) {
			const segments = getPathSegements(path)
			const [name] = segments.slice(-1)
			const parentPath = '/' + segments.slice(0, -1).join('/')
			resolveDirectory(parentPath)
				.then(async (parent) => {
					try {
						const f = await parent.getFileHandle(name)
						const file = await f.getFile()
						callback(null, {
							dev: 0,
							ino: 0,
							mode: 0o100755,
							nlink: 0,
							uid: 0,
							gid: 0,
							rdev: 0,
							size: file.size,
							blksize: 0,
							blocks: 0,
							atimeMs: 0,
							mtimeMs: 0,
							ctimeMs: 0
						})
					} catch (error) {
						if (error instanceof DOMException && error.name === 'TypeMismatchError') {
							callback(null, {
								dev: 0,
								ino: 0,
								mode: 0o40755,
								nlink: 0,
								uid: 0,
								gid: 0,
								rdev: 0,
								size: 0,
								blksize: 0,
								blocks: 0,
								atimeMs: 0,
								mtimeMs: 0,
								ctimeMs: 0
							})
						} else {
							throw error
						}
					}
				})
				.catch(ErrorHandler(callback))
		},

		symlink(path, link, callback) {
			callback(errors.enosys())
		},

		truncate(path, length, callback) {
			resolveFile(path)
				.then(async (f) => {
					const handle = await f.createSyncAccessHandle()
					handle.truncate(length)
					handle.close()
					callback(null)
				})
				.catch(ErrorHandler(callback))
		},

		unlink(path, callback) {
			const segments = getPathSegements(path)
			const [name] = segments.slice(-1)
			const parentPath = '/' + segments.slice(0, -1).join('/')
			resolveDirectory(parentPath)
				.then(async (parent) => {
					await parent.removeEntry(name)
					callback(null)
				})
				.catch(ErrorHandler(callback))
		},

		utimes(path, atime, mtime, callback) {
			callback(errors.enosys())
		}
	}
})()
