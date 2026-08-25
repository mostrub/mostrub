package ui

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var raw embed.FS

func FS() (fs.FS, error) {
	return fs.Sub(raw, "dist")
}
