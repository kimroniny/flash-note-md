//go:build windows

package main

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode/utf16"
)

type note struct {
	File    string
	Title   string
	ModTime time.Time
}

func dataRoot() string {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		base = os.TempDir()
	}
	return filepath.Join(base, productDir)
}

func notesDir() string {
	return filepath.Join(dataRoot(), "notes")
}

func ensureNotesDir() error {
	return os.MkdirAll(notesDir(), 0o755)
}

func nowStamp(d time.Time) string {
	return d.Format("2006-01-02 15:04")
}

func meetingTemplate() string {
	return "# 会议 " + nowStamp(time.Now()) + "\n\n"
}

func titleFromMarkdown(md string) string {
	for _, raw := range strings.Split(md, "\n") {
		line := strings.TrimSpace(raw)
		if line == "" || line == "---" || line == "***" {
			continue
		}
		for strings.HasPrefix(line, "#") {
			line = strings.TrimSpace(strings.TrimPrefix(line, "#"))
		}
		if strings.HasPrefix(line, "> ") {
			line = strings.TrimSpace(line[2:])
		}
		if strings.HasPrefix(line, "- [") || strings.HasPrefix(line, "* [") {
			if i := strings.Index(line, "] "); i >= 0 {
				line = line[i+2:]
			}
		}
		line = strings.TrimLeft(line, "-*+ ")
		line = strings.NewReplacer("*", "", "_", "", "`", "").Replace(line)
		line = strings.TrimSpace(line)
		if line != "" {
			rs := []rune(line)
			if len(rs) > 48 {
				return string(rs[:48])
			}
			return line
		}
	}
	return "未命名会议"
}

func listNotes() []note {
	_ = ensureNotesDir()
	ents, err := os.ReadDir(notesDir())
	if err != nil {
		return nil
	}
	out := make([]note, 0, len(ents))
	for _, e := range ents {
		if e.IsDir() || !strings.EqualFold(filepath.Ext(e.Name()), ".md") {
			continue
		}
		p := filepath.Join(notesDir(), e.Name())
		b, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		info, _ := e.Info()
		mt := time.Now()
		if info != nil {
			mt = info.ModTime()
		}
		out = append(out, note{File: e.Name(), Title: titleFromMarkdown(string(b)), ModTime: mt})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ModTime.After(out[j].ModTime) })
	return out
}

func readNoteFile(name string) (string, error) {
	b, err := os.ReadFile(filepath.Join(notesDir(), name))
	if err != nil {
		return "", err
	}
	return strings.ReplaceAll(string(b), "\r\n", "\n"), nil
}

func writeNoteFile(name, content string) error {
	_ = ensureNotesDir()
	content = strings.ReplaceAll(content, "\r\n", "\n")
	content = strings.ReplaceAll(content, "\n", "\r\n")
	return os.WriteFile(filepath.Join(notesDir(), name), []byte(content), 0o644)
}

func newNoteFile() (string, error) {
	_ = ensureNotesDir()
	name := time.Now().Format("20060102-150405") + ".md"
	if err := writeNoteFile(name, meetingTemplate()); err != nil {
		return "", err
	}
	return name, nil
}

func loadConfig() (last, theme string) {
	b, err := os.ReadFile(filepath.Join(dataRoot(), "config.txt"))
	if err != nil {
		return "", "paper"
	}
	theme = "paper"
	for _, line := range strings.Split(string(b), "\n") {
		k, v, ok := strings.Cut(strings.TrimSpace(line), "=")
		if !ok {
			continue
		}
		switch k {
		case "last":
			last = v
		case "theme":
			if v != "" {
				theme = v
			}
		}
	}
	return last, theme
}

func saveConfig(last, theme string) {
	_ = os.MkdirAll(dataRoot(), 0o755)
	_ = os.WriteFile(filepath.Join(dataRoot(), "config.txt"), []byte("last="+last+"\ntheme="+theme+"\n"), 0o644)
}

func utf16Len(s string) int {
	return len(utf16.Encode([]rune(s)))
}

func byteToUTF16(s string, byteOff int) int {
	if byteOff <= 0 {
		return 0
	}
	if byteOff > len(s) {
		byteOff = len(s)
	}
	return utf16Len(s[:byteOff])
}
