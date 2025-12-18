package internal

import (
	"io"
	"io/fs"
	"os"
	"time"
)

// FS wrapper to define fixed modtime for all the files in FS.
type timedFS struct {
	fs.FS
	FixedModTime time.Time
}

func (f *timedFS) Open(name string) (fs.File, error) {
	file, err := f.FS.Open(name)
	readerAt, _ := file.(io.ReaderAt)
	seeker, _ := file.(io.Seeker)
	return &timedFile{
		File:         file,
		ReaderAt:     readerAt,
		Seeker:       seeker,
		FixedModTime: f.FixedModTime,
	}, err
}

// File wrapper to define fixed modtime for the file.
type timedFile struct {
	fs.File
	io.ReaderAt
	io.Seeker
	FixedModTime time.Time
}

func (f *timedFile) Stat() (os.FileInfo, error) {
	fileInfo, err := f.File.Stat()
	return &timedFileInfo{FileInfo: fileInfo, FixedModTime: f.FixedModTime}, err
}

// File info wrapper to define fixed modtime for the file.
type timedFileInfo struct {
	os.FileInfo
	FixedModTime time.Time
}

func (f *timedFileInfo) ModTime() time.Time {
	return f.FixedModTime
}
