//go:build windows

package main

import (
	"embed"
	"fmt"
	"io/fs"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"syscall"
	"unsafe"

	"github.com/jchv/go-webview2"
	"github.com/jchv/go-webview2/pkg/edge"
	"golang.org/x/sys/windows"
)

//go:embed all:dist
var distFS embed.FS

var flavor = "portable"

const (
	appName     = "闪记"
	mutexName   = "Local\\FlashNote.yiiguo.singleton"
	windowClass = "webview"
	productDir  = "FlashNote"
)

func main() {
	args := os.Args[1:]
	if hasFlag(args, "--uninstall") {
		if err := uninstall(); err != nil {
			alert(err.Error())
			os.Exit(1)
		}
		return
	}

	self, err := os.Executable()
	if err != nil {
		alert("无法定位程序本身：" + err.Error())
		os.Exit(1)
	}
	self, _ = filepath.Abs(self)

	wantInstall := flavor == "setup" || hasFlag(args, "--install") || strings.Contains(strings.ToLower(filepath.Base(self)), "setup")
	if wantInstall {
		installed, err := install(self)
		if err != nil {
			alert("安装失败：" + err.Error())
			os.Exit(1)
		}
		if !sameFile(self, installed) {
			if err := launchDetached(installed); err != nil {
				alert("已安装，但启动失败：" + err.Error())
				os.Exit(1)
			}
			return
		}
	}

	if restored := focusExisting(); restored {
		return
	}
	release, err := acquireMutex()
	if err != nil {
		if focusExisting() {
			return
		}
		alert("闪记已经在运行。")
		return
	}
	defer release()

	if err := runApp(); err != nil {
		alert(err.Error())
		os.Exit(1)
	}
}

func hasFlag(args []string, name string) bool {
	for _, a := range args {
		if strings.EqualFold(a, name) {
			return true
		}
	}
	return false
}

func serveNoteAsset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	rel := strings.TrimPrefix(r.URL.Path, "/~notes/")
	if unescaped, err := url.PathUnescape(rel); err == nil {
		rel = unescaped
	}
	rel = strings.TrimPrefix(filepath.ToSlash(rel), "/")
	if rel == "" || strings.Contains(rel, "..") {
		http.NotFound(w, r)
		return
	}
	abs, err := absInRoot(rel)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	info, err := os.Stat(abs)
	if err != nil || info.IsDir() {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, abs)
}

func runApp() error {
	_ = mime.AddExtensionType(".webmanifest", "application/manifest+json")
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		return fmt.Errorf("读取内置界面失败：%w", err)
	}

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		if focusExisting() {
			return nil
		}
		return fmt.Errorf("无法启动本地界面：%w", err)
	}
	defer ln.Close()
	uiURL := "http://" + ln.Addr().String() + "/"

	mux := http.NewServeMux()
	mux.Handle("/~notes/", http.HandlerFunc(serveNoteAsset))
	mux.Handle("/", http.FileServer(http.FS(sub)))
	srv := &http.Server{Handler: mux}
	go func() { _ = srv.Serve(ln) }()

	dataDir := filepath.Join(os.Getenv("LOCALAPPDATA"), productDir, "webview2")
	_ = os.MkdirAll(dataDir, 0o755)

	_ = windows.CoInitializeEx(0, windows.COINIT_APARTMENTTHREADED)

	w := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug:     false,
		AutoFocus: true,
		DataPath:  dataDir,
		WindowOptions: webview2.WindowOptions{
			Title:  appName,
			Width:  1180,
			Height: 780,
			IconId: 2,
			Center: true,
		},
	})
	if w == nil {
		return fmt.Errorf("无法创建窗口。请安装 Microsoft Edge 或 WebView2 运行时：\nhttps://go.microsoft.com/fwlink/p/?LinkId=2124703")
	}
	disableBrowserAccelerators(w)
	defer w.Destroy()
	if err := bindDesktop(w); err != nil {
		return fmt.Errorf("无法连接本地存储：%w", err)
	}
	w.SetSize(720, 520, webview2.HintMin)
	w.Navigate(uiURL)
	w.Run()
	_ = srv.Close()
	return nil
}

func disableBrowserAccelerators(w webview2.WebView) {
	rv := reflect.ValueOf(w)
	for rv.Kind() == reflect.Interface || rv.Kind() == reflect.Ptr {
		if rv.IsNil() {
			return
		}
		rv = rv.Elem()
	}
	field := rv.FieldByName("browser")
	if !field.IsValid() {
		return
	}
	browser := reflect.NewAt(field.Type(), unsafe.Pointer(field.UnsafeAddr())).Elem().Interface()
	chromium, ok := browser.(interface {
		GetSettings() (*edge.ICoreWebViewSettings, error)
	})
	if !ok {
		return
	}
	settings, err := chromium.GetSettings()
	if err != nil || settings == nil {
		return
	}
	_ = settings.PutAreBrowserAcceleratorKeysEnabled(false)
}

func acquireMutex() (func(), error) {
	name, err := windows.UTF16PtrFromString(mutexName)
	if err != nil {
		return nil, err
	}
	handle, err := windows.CreateMutex(nil, false, name)
	if err == windows.ERROR_ALREADY_EXISTS {
		if handle != 0 {
			_ = windows.CloseHandle(handle)
		}
		return nil, err
	}
	if err != nil {
		return nil, err
	}
	return func() { _ = windows.CloseHandle(handle) }, nil
}

func focusExisting() bool {
	user32 := windows.NewLazySystemDLL("user32.dll")
	enumWindows := user32.NewProc("EnumWindows")
	getClassName := user32.NewProc("GetClassNameW")
	getWindowText := user32.NewProc("GetWindowTextW")
	isWindowVisible := user32.NewProc("IsWindowVisible")
	showWindow := user32.NewProc("ShowWindow")
	setForeground := user32.NewProc("SetForegroundWindow")

	var found uintptr
	cb := syscall.NewCallback(func(hwnd, _ uintptr) uintptr {
		vis, _, _ := isWindowVisible.Call(hwnd)
		if vis == 0 {
			return 1
		}
		classBuf := make([]uint16, 256)
		_, _, _ = getClassName.Call(hwnd, uintptr(unsafe.Pointer(&classBuf[0])), 256)
		if windows.UTF16ToString(classBuf) != windowClass {
			return 1
		}
		titleBuf := make([]uint16, 512)
		_, _, _ = getWindowText.Call(hwnd, uintptr(unsafe.Pointer(&titleBuf[0])), 512)
		title := windows.UTF16ToString(titleBuf)
		if title == appName || strings.Contains(title, appName) {
			found = hwnd
			return 0
		}
		return 1
	})
	_, _, _ = enumWindows.Call(cb, 0)
	if found == 0 {
		return false
	}
	_, _, _ = showWindow.Call(found, 9) // SW_RESTORE
	_, _, _ = setForeground.Call(found)
	return true
}

func alert(msg string) {
	caption, _ := windows.UTF16PtrFromString(appName)
	text, _ := windows.UTF16PtrFromString(msg)
	_, _ = windows.MessageBox(0, text, caption, windows.MB_OK|windows.MB_ICONERROR)
}

func confirm(msg string) bool {
	caption, _ := windows.UTF16PtrFromString(appName)
	text, _ := windows.UTF16PtrFromString(msg)
	r, _ := windows.MessageBox(0, text, caption, windows.MB_YESNO|windows.MB_ICONQUESTION)
	return r == 6 // IDYES
}

func installDir() string {
	return filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", productDir)
}

func installedExe() string {
	return filepath.Join(installDir(), "FlashNote.exe")
}

func sameFile(a, b string) bool {
	absA, err1 := filepath.Abs(a)
	absB, err2 := filepath.Abs(b)
	if err1 != nil || err2 != nil {
		return strings.EqualFold(a, b)
	}
	return strings.EqualFold(absA, absB)
}

func launchDetached(exe string) error {
	cmd := exec.Command(exe)
	cmd.Dir = filepath.Dir(exe)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: false}
	return cmd.Start()
}
