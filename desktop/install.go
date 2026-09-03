//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"

	"golang.org/x/sys/windows/registry"
)

func install(self string) (string, error) {
	dir := installDir()
	dest := installedExe()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	if !sameFile(self, dest) {
		data, err := os.ReadFile(self)
		if err != nil {
			return "", err
		}
		tmp := dest + ".new"
		if err := os.WriteFile(tmp, data, 0o755); err != nil {
			return "", err
		}
		_ = os.Remove(dest)
		if err := os.Rename(tmp, dest); err != nil {
			_ = copyFile(tmp, dest)
			_ = os.Remove(tmp)
		}
	}
	if err := writeUninstallKey(dest, dir); err != nil {
		return dest, err
	}
	if err := writeShortcuts(dest, dir); err != nil {
		return dest, err
	}
	return dest, nil
}

func copyFile(src, dest string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dest, data, 0o755)
}

func uninstall() error {
	if !confirm("确定卸载闪记吗？笔记数据会留在本机，不会删除。") {
		return nil
	}
	dest := installedExe()
	dir := installDir()
	_ = removeShortcuts()
	_ = registry.DeleteKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Uninstall\FlashNote`)
	_ = os.Remove(dest)
	_ = os.Remove(dir)
	return nil
}

func writeUninstallKey(exe, dir string) error {
	k, _, err := registry.CreateKey(
		registry.CURRENT_USER,
		`Software\Microsoft\Windows\CurrentVersion\Uninstall\FlashNote`,
		registry.SET_VALUE,
	)
	if err != nil {
		return err
	}
	defer k.Close()
	_ = k.SetStringValue("DisplayName", appName)
	_ = k.SetStringValue("DisplayVersion", "1.0.0")
	_ = k.SetStringValue("Publisher", appName)
	_ = k.SetStringValue("InstallLocation", dir)
	_ = k.SetStringValue("DisplayIcon", exe)
	_ = k.SetStringValue("UninstallString", `"`+exe+`" --uninstall`)
	_ = k.SetDWordValue("NoModify", 1)
	_ = k.SetDWordValue("NoRepair", 1)
	if info, err := os.Stat(exe); err == nil {
		_ = k.SetQWordValue("EstimatedSize", uint64(info.Size()/1024))
	}
	return nil
}

func writeShortcuts(exe, dir string) error {
	script := fmt.Sprintf(`
$ErrorActionPreference = 'Stop'
$ws = New-Object -ComObject WScript.Shell
$exe = %s
$dir = %s
function Make-Link([string]$path) {
  $folder = Split-Path $path -Parent
  if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Path $folder | Out-Null }
  $s = $ws.CreateShortcut($path)
  $s.TargetPath = $exe
  $s.WorkingDirectory = $dir
  $s.IconLocation = "$exe,0"
  $s.Description = '开会即开的 Markdown 笔记'
  $s.Save()
}
$desktop = Join-Path ([Environment]::GetFolderPath('Desktop')) '闪记.lnk'
$start = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\闪记.lnk'
Make-Link $desktop
Make-Link $start
`, psQuote(exe), psQuote(dir))
	return runPowerShell(script)
}

func removeShortcuts() error {
	return runPowerShell(`
$desktop = Join-Path ([Environment]::GetFolderPath('Desktop')) '闪记.lnk'
$start = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\闪记.lnk'
Remove-Item $desktop -ErrorAction SilentlyContinue
Remove-Item $start -ErrorAction SilentlyContinue
`)
}

func runPowerShell(script string) error {
	tmp := filepath.Join(os.TempDir(), "flashnote-setup.ps1")
	body := append([]byte{0xEF, 0xBB, 0xBF}, []byte(script)...)
	if err := os.WriteFile(tmp, body, 0o644); err != nil {
		return err
	}
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", tmp)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	out, err := cmd.CombinedOutput()
	_ = os.Remove(tmp)
	if err != nil {
		return fmt.Errorf("PowerShell 失败：%w\n%s", err, out)
	}
	return nil
}

func psQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "''") + "'"
}
