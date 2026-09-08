//go:build windows

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"unsafe"

	"github.com/jchv/go-webview2"
	"golang.org/x/sys/windows"
)

type appConfig struct {
	StorageDir string `json:"storageDir"`
}

type fileNode struct {
	Path      string     `json:"path"`
	Name      string     `json:"name"`
	Title     string     `json:"title"`
	Dir       bool       `json:"dir"`
	UpdatedAt int64      `json:"updatedAt"`
	Children  []fileNode `json:"children,omitempty"`
}

func configPath() string {
	return filepath.Join(os.Getenv("LOCALAPPDATA"), productDir, "config.json")
}

func defaultStorageDir() string {
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		home = os.Getenv("USERPROFILE")
	}
	return filepath.Join(home, "Documents", "闪记")
}

func loadConfig() appConfig {
	raw, err := os.ReadFile(configPath())
	if err != nil {
		return appConfig{}
	}
	var cfg appConfig
	if json.Unmarshal(raw, &cfg) != nil {
		return appConfig{}
	}
	return cfg
}

func saveConfig(cfg appConfig) error {
	dir := filepath.Dir(configPath())
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configPath(), data, 0o644)
}

func ensureStorageDir() (string, error) {
	cfg := loadConfig()
	dir := strings.TrimSpace(cfg.StorageDir)
	if dir == "" {
		dir = defaultStorageDir()
		cfg.StorageDir = dir
		_ = saveConfig(cfg)
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

func saveStorageDir(dir string) error {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return fmt.Errorf("目录为空")
	}
	abs, err := filepath.Abs(dir)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(abs, 0o755); err != nil {
		return err
	}
	cfg := loadConfig()
	cfg.StorageDir = abs
	return saveConfig(cfg)
}

func absInRoot(rel string) (string, error) {
	root, err := ensureStorageDir()
	if err != nil {
		return "", err
	}
	clean := filepath.Clean(filepath.Join(root, filepath.FromSlash(rel)))
	relTo, err := filepath.Rel(root, clean)
	if err != nil || relTo == ".." || strings.HasPrefix(relTo, ".."+string(os.PathSeparator)) {
		return "", fmt.Errorf("路径无效")
	}
	return clean, nil
}

func titleFromContent(content, fallback string) string {
	for _, raw := range strings.Split(content, "\n") {
		line := strings.TrimSpace(raw)
		if line == "" || line == "---" || line == "***" || line == "___" {
			continue
		}
		line = strings.TrimLeft(line, "#")
		line = strings.TrimSpace(line)
		line = strings.TrimPrefix(line, "> ")
		if strings.HasPrefix(line, "- [") || strings.HasPrefix(line, "* [") {
			if i := strings.Index(line, "]"); i >= 0 && i+1 < len(line) {
				line = strings.TrimSpace(line[i+1:])
			}
		} else if strings.HasPrefix(line, "- ") || strings.HasPrefix(line, "* ") {
			line = strings.TrimSpace(line[2:])
		}
		line = strings.ReplaceAll(line, "*", "")
		line = strings.ReplaceAll(line, "`", "")
		line = strings.TrimSpace(line)
		if line != "" {
			runes := []rune(line)
			if len(runes) > 56 {
				return string(runes[:56])
			}
			return line
		}
	}
	if fallback != "" {
		return fallback
	}
	return "未命名"
}

func sanitizeFileName(title string) string {
	repl := strings.NewReplacer(`\`, "_", `/`, "_", `:`, "_", `*`, "_", `?`, "_", `"`, "_", `<`, "_", `>`, "_", `|`, "_")
	s := strings.TrimSpace(repl.Replace(title))
	s = strings.Trim(s, ". ")
	if s == "" {
		s = "未命名"
	}
	runes := []rune(s)
	if len(runes) > 48 {
		s = string(runes[:48])
	}
	return s
}

func uniqueMarkdownName(dir, base string) string {
	name := base + ".md"
	for i := 2; ; i++ {
		if _, err := os.Stat(filepath.Join(dir, name)); os.IsNotExist(err) {
			return name
		}
		name = fmt.Sprintf("%s-%d.md", base, i)
	}
}

func skipDirName(name string) bool {
	n := strings.ToLower(name)
	return n == ".git" || n == "node_modules" || strings.HasPrefix(name, ".")
}

func listTree() ([]fileNode, error) {
	root, err := ensureStorageDir()
	if err != nil {
		return nil, err
	}
	var walk func(abs, rel string) ([]fileNode, error)
	walk = func(abs, rel string) ([]fileNode, error) {
		entries, err := os.ReadDir(abs)
		if err != nil {
			return nil, err
		}
		out := make([]fileNode, 0, len(entries))
		for _, ent := range entries {
			name := ent.Name()
			childAbs := filepath.Join(abs, name)
			childRel := name
			if rel != "" {
				childRel = rel + "/" + name
			}
			info, err := ent.Info()
			if err != nil {
				continue
			}
			if ent.IsDir() {
				if skipDirName(name) {
					continue
				}
				kids, err := walk(childAbs, childRel)
				if err != nil {
					continue
				}
				out = append(out, fileNode{
					Path:      childRel,
					Name:      name,
					Title:     name,
					Dir:       true,
					UpdatedAt: info.ModTime().UnixMilli(),
					Children:  kids,
				})
				continue
			}
			if !strings.EqualFold(filepath.Ext(name), ".md") {
				continue
			}
			raw, _ := os.ReadFile(childAbs)
			if len(raw) > 4096 {
				raw = raw[:4096]
			}
			title := titleFromContent(string(raw), strings.TrimSuffix(name, filepath.Ext(name)))
			out = append(out, fileNode{
				Path:      childRel,
				Name:      name,
				Title:     title,
				Dir:       false,
				UpdatedAt: info.ModTime().UnixMilli(),
			})
		}
		return out, nil
	}
	return walk(root, "")
}

func readNoteFile(rel string) (string, error) {
	abs, err := absInRoot(rel)
	if err != nil {
		return "", err
	}
	raw, err := os.ReadFile(abs)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func writeNoteFile(rel, content string) error {
	abs, err := absInRoot(rel)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return err
	}
	return os.WriteFile(abs, []byte(content), 0o644)
}

func createNoteFile(title, content string) (string, error) {
	root, err := ensureStorageDir()
	if err != nil {
		return "", err
	}
	name := uniqueMarkdownName(root, sanitizeFileName(title))
	if err := os.WriteFile(filepath.Join(root, name), []byte(content), 0o644); err != nil {
		return "", err
	}
	return name, nil
}

func deleteNoteFile(rel string) error {
	abs, err := absInRoot(rel)
	if err != nil {
		return err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return fmt.Errorf("不能删除文件夹")
	}
	return os.Remove(abs)
}

type browseInfo struct {
	hwndOwner      uintptr
	pidlRoot       uintptr
	pszDisplayName *uint16
	lpszTitle      *uint16
	ulFlags        uint32
	_              uint32
	lpfn           uintptr
	lParam         uintptr
	iImage         int32
	_              uint32
}

const (
	bifReturnOnlyFSDirs = 0x00000001
	bifNewDialogStyle   = 0x00000040
	bifEditBox          = 0x00000010
)

func pickFolder(owner uintptr) (string, error) {
	shell32 := windows.NewLazySystemDLL("shell32.dll")
	ole32 := windows.NewLazySystemDLL("ole32.dll")
	shBrowse := shell32.NewProc("SHBrowseForFolderW")
	shGetPath := shell32.NewProc("SHGetPathFromIDListW")
	coTaskMemFree := ole32.NewProc("CoTaskMemFree")

	title, err := windows.UTF16PtrFromString("选择闪记笔记目录")
	if err != nil {
		return "", err
	}
	display := make([]uint16, windows.MAX_PATH)
	bi := browseInfo{
		hwndOwner:      owner,
		pszDisplayName: &display[0],
		lpszTitle:      title,
		ulFlags:        bifReturnOnlyFSDirs | bifNewDialogStyle | bifEditBox,
	}
	pidl, _, _ := shBrowse.Call(uintptr(unsafe.Pointer(&bi)))
	if pidl == 0 {
		return "", nil
	}
	defer coTaskMemFree.Call(pidl)
	buf := make([]uint16, windows.MAX_PATH)
	ok, _, _ := shGetPath.Call(pidl, uintptr(unsafe.Pointer(&buf[0])))
	if ok == 0 {
		return "", fmt.Errorf("无法读取所选目录")
	}
	return windows.UTF16ToString(buf), nil
}

func bindDesktop(w webview2.WebView) error {
	binds := []struct {
		name string
		fn   interface{}
	}{
		{"flashGetDir", func() (string, error) { return ensureStorageDir() }},
		{"flashPickDir", func() (string, error) {
			dir, err := pickFolder(uintptr(w.Window()))
			if err != nil || dir == "" {
				return "", err
			}
			if err := saveStorageDir(dir); err != nil {
				return "", err
			}
			return dir, nil
		}},
		{"flashSetDir", func(path string) (string, error) {
			if err := saveStorageDir(path); err != nil {
				return "", err
			}
			return ensureStorageDir()
		}},
		{"flashList", func() ([]fileNode, error) { return listTree() }},
		{"flashRead", func(rel string) (string, error) { return readNoteFile(rel) }},
		{"flashWrite", func(rel, content string) error { return writeNoteFile(rel, content) }},
		{"flashCreate", func(title, content string) (string, error) { return createNoteFile(title, content) }},
		{"flashDelete", func(rel string) error { return deleteNoteFile(rel) }},
	}
	for _, b := range binds {
		if err := w.Bind(b.name, b.fn); err != nil {
			return err
		}
	}
	return nil
}