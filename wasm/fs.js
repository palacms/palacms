"use strict";

(() => {
  let outputBuf = "";
  const decoder = new TextDecoder("utf-8");
  const enosys = () => {
    const err = new Error("not implemented");
    err.code = "ENOSYS";
    return err;
  };

  globalThis.fs = {
    constants: {
      O_WRONLY: -1,
      O_RDWR: -1,
      O_CREAT: -1,
      O_TRUNC: -1,
      O_APPEND: -1,
      O_EXCL: -1,
      O_DIRECTORY: -1,
    }, // unused
    writeSync(fd, buf) {
      outputBuf += decoder.decode(buf);
      const nl = outputBuf.lastIndexOf("\n");
      if (nl != -1) {
        console.log(outputBuf.substring(0, nl));
        outputBuf = outputBuf.substring(nl + 1);
      }
      return buf.length;
    },
    write(fd, buf, offset, length, position, callback) {
      if (offset !== 0 || length !== buf.length || position !== null) {
        callback(enosys());
        return;
      }
      const n = this.writeSync(fd, buf);
      callback(null, n);
    },
    chmod(path, mode, callback) {
      callback(enosys());
    },
    chown(path, uid, gid, callback) {
      callback(enosys());
    },
    close(fd, callback) {
      callback(enosys());
    },
    fchmod(fd, mode, callback) {
      callback(enosys());
    },
    fchown(fd, uid, gid, callback) {
      callback(enosys());
    },
    fstat(fd, callback) {
      callback(enosys());
    },
    fsync(fd, callback) {
      callback(null);
    },
    ftruncate(fd, length, callback) {
      callback(enosys());
    },
    lchown(path, uid, gid, callback) {
      callback(enosys());
    },
    link(path, link, callback) {
      callback(enosys());
    },
    lstat(path, callback) {
      callback(enosys());
    },
    mkdir(path, perm, callback) {
      // Ignored
      callback();
    },
    open(path, flags, mode, callback) {
      callback(enosys());
    },
    read(fd, buffer, offset, length, position, callback) {
      callback(enosys());
    },
    readdir(path, callback) {
      callback(enosys());
    },
    readlink(path, callback) {
      callback(enosys());
    },
    rename(from, to, callback) {
      callback(enosys());
    },
    rmdir(path, callback) {
      callback(enosys());
    },
    stat(path, callback) {
      callback(enosys());
    },
    symlink(path, link, callback) {
      callback(enosys());
    },
    truncate(path, length, callback) {
      callback(enosys());
    },
    unlink(path, callback) {
      callback(enosys());
    },
    utimes(path, atime, mtime, callback) {
      callback(enosys());
    },
  };
})();
