//go:build windows

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var flavor = "portable"

const (
	appName    = "闪记"
	mutexName  = "Local\\FlashNote.yiiguo.singleton"
	productDir = "FlashNote"
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
	hwnd, _, _ := user32.NewProc("FindWindowW").Call(uintptr(unsafe.Pointer(utf16Ptr(windowClass))), 0)
	if hwnd == 0 {
		return false
	}
	_, _, _ = pShowWindow.Call(hwnd, swRestore)
	_, _, _ = user32.NewProc("SetForegroundWindow").Call(hwnd)
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
	return r == 6
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
