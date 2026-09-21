//go:build windows

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
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

const trashDirName = ".trash"

type trashItem struct {
	ID        string `json:"id"`
	NoteID    string `json:"noteId"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
	DeletedAt int64  `json:"deletedAt"`
	File      string `json:"file"`
}

func trashDir() (string, error) {
	root, err := ensureStorageDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(root, trashDirName)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

func trashIndexPath(dir string) string {
	return filepath.Join(dir, "index.json")
}

func readTrashIndex(dir string) []trashItem {
	raw, err := os.ReadFile(trashIndexPath(dir))
	if err != nil {
		return nil
	}
	var items []trashItem
	if json.Unmarshal(raw, &items) != nil {
		return nil
	}
	return items
}

func writeTrashIndex(dir string, items []trashItem) error {
	if items == nil {
		items = []trashItem{}
	}
	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(trashIndexPath(dir), data, 0o644)
}

func moveFile(src, dst string) error {
	if err := os.Rename(src, dst); err == nil {
		return nil
	}
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	if err := os.WriteFile(dst, data, 0o644); err != nil {
		return err
	}
	return os.Remove(src)
}

func trashNoteFile(rel string) error {
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
	raw, err := os.ReadFile(abs)
	if err != nil {
		return err
	}
	dir, err := trashDir()
	if err != nil {
		return err
	}
	title := titleFromContent(string(raw), strings.TrimSuffix(filepath.Base(rel), filepath.Ext(rel)))
	stored := uniqueMarkdownName(dir, sanitizeFileName(title))
	if err := moveFile(abs, filepath.Join(dir, stored)); err != nil {
		return err
	}
	item := trashItem{
		ID:        fmt.Sprintf("t_%d_%d", time.Now().UnixMilli(), time.Now().UnixNano()%1000),
		NoteID:    filepath.ToSlash(rel),
		Title:     title,
		CreatedAt: info.ModTime().UnixMilli(),
		UpdatedAt: info.ModTime().UnixMilli(),
		DeletedAt: time.Now().UnixMilli(),
		File:      stored,
	}
	items := append([]trashItem{item}, readTrashIndex(dir)...)
	return writeTrashIndex(dir, items)
}

func listTrash() ([]trashItem, error) {
	dir, err := trashDir()
	if err != nil {
		return nil, err
	}
	orig := readTrashIndex(dir)
	kept := make([]trashItem, 0, len(orig))
	for _, it := range orig {
		raw, err := os.ReadFile(filepath.Join(dir, it.File))
		if err != nil {
			continue
		}
		it.Content = string(raw)
		if it.Title == "" {
			it.Title = titleFromContent(it.Content, strings.TrimSuffix(it.File, filepath.Ext(it.File)))
		}
		kept = append(kept, it)
	}
	if len(kept) != len(orig) {
		slim := make([]trashItem, len(kept))
		for i, it := range kept {
			slim[i] = it
			slim[i].Content = ""
		}
		_ = writeTrashIndex(dir, slim)
	}
	return kept, nil
}

func restoreTrash(id string) (string, error) {
	dir, err := trashDir()
	if err != nil {
		return "", err
	}
	items := readTrashIndex(dir)
	idx := -1
	var item trashItem
	for i, it := range items {
		if it.ID == id {
			idx = i
			item = it
			break
		}
	}
	if idx < 0 {
		return "", fmt.Errorf("找不到该条目")
	}
	src := filepath.Join(dir, item.File)
	root, err := ensureStorageDir()
	if err != nil {
		return "", err
	}
	destRel := item.NoteID
	destAbs, err := absInRoot(destRel)
	if err != nil {
		name := uniqueMarkdownName(root, sanitizeFileName(item.Title))
		destRel = name
		destAbs = filepath.Join(root, name)
	} else if _, statErr := os.Stat(destAbs); statErr == nil {
		parent := filepath.Dir(destAbs)
		base := sanitizeFileName(strings.TrimSuffix(filepath.Base(destRel), filepath.Ext(destRel)))
		name := uniqueMarkdownName(parent, base)
		destAbs = filepath.Join(parent, name)
		rel, relErr := filepath.Rel(root, destAbs)
		if relErr != nil {
			return "", relErr
		}
		destRel = filepath.ToSlash(rel)
	}
	if err := os.MkdirAll(filepath.Dir(destAbs), 0o755); err != nil {
		return "", err
	}
	if err := moveFile(src, destAbs); err != nil {
		return "", err
	}
	items = append(items[:idx], items[idx+1:]...)
	if err := writeTrashIndex(dir, items); err != nil {
		return "", err
	}
	return destRel, nil
}

func purgeTrash(id string) error {
	dir, err := trashDir()
	if err != nil {
		return err
	}
	items := readTrashIndex(dir)
	kept := make([]trashItem, 0, len(items))
	found := false
	for _, it := range items {
		if it.ID == id {
			found = true
			_ = os.Remove(filepath.Join(dir, it.File))
			continue
		}
		kept = append(kept, it)
	}
	if !found {
		return fmt.Errorf("找不到该条目")
	}
	return writeTrashIndex(dir, kept)
}

func emptyTrash() error {
	dir, err := trashDir()
	if err != nil {
		return err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	for _, ent := range entries {
		_ = os.RemoveAll(filepath.Join(dir, ent.Name()))
	}
	return writeTrashIndex(dir, nil)
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

func moveNoteFile(rel, destDir string) (string, error) {
	abs, err := absInRoot(rel)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return "", err
	}
	if info.IsDir() {
		return "", fmt.Errorf("不能移动文件夹")
	}
	destDir = filepath.ToSlash(filepath.Clean(strings.TrimSpace(destDir)))
	destDir = strings.Trim(destDir, "/")
	if destDir == "." {
		destDir = ""
	}
	lower := strings.ToLower(destDir)
	if lower == trashDirName || strings.HasPrefix(lower, trashDirName+"/") {
		return "", fmt.Errorf("不能移入回收站")
	}
	var destAbs string
	if destDir == "" {
		destAbs, err = ensureStorageDir()
		if err != nil {
			return "", err
		}
	} else {
		destAbs, err = absInRoot(destDir)
		if err != nil {
			return "", err
		}
		st, statErr := os.Stat(destAbs)
		if statErr != nil {
			return "", statErr
		}
		if !st.IsDir() {
			return "", fmt.Errorf("目标不是文件夹")
		}
	}
	if filepath.Clean(filepath.Dir(abs)) == filepath.Clean(destAbs) {
		return filepath.ToSlash(rel), nil
	}
	base := strings.TrimSuffix(filepath.Base(abs), filepath.Ext(abs))
	name := uniqueMarkdownName(destAbs, base)
	if err := moveFile(abs, filepath.Join(destAbs, name)); err != nil {
		return "", err
	}
	if destDir == "" {
		return name, nil
	}
	return filepath.ToSlash(filepath.Join(destDir, name)), nil
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
		{"flashTrash", func(rel string) error { return trashNoteFile(rel) }},
		{"flashTrashList", func() ([]trashItem, error) { return listTrash() }},
		{"flashRestore", func(id string) (string, error) { return restoreTrash(id) }},
		{"flashPurge", func(id string) error { return purgeTrash(id) }},
		{"flashEmptyTrash", func() error { return emptyTrash() }},
		{"flashMove", func(rel, destDir string) (string, error) { return moveNoteFile(rel, destDir) }},
	}
	for _, b := range binds {
		if err := w.Bind(b.name, b.fn); err != nil {
			return err
		}
	}
	return nil
}
