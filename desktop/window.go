//go:build windows

package main

import (
	"os/exec"
	"strings"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

const windowClass = "FlashNoteWnd"

type appState struct {
	hwnd, edit, list, filter, newBtn uintptr
	hInst                            windows.Handle
	font, fontSmall                  windows.Handle
	brBg, brSide                     uintptr
	accel                            uintptr
	notes                            []note
	current                          string
	themeID                          string
	alive                            bool
	busy                             bool
	wndProc                          uintptr
}

var app appState

func runApp() error {
	if err := ensureNotesDir(); err != nil {
		return err
	}
	app.alive = true

	_, _, _ = user32.NewProc("SetProcessDPIAware").Call()

	var hInst windows.Handle
	_ = windows.GetModuleHandleEx(0, nil, &hInst)
	app.hInst = hInst
	app.wndProc = windows.NewCallback(mainWndProc)

	icon, _, _ := pLoadImageW.Call(uintptr(hInst), 2, 1, 0, 0, 0x00008000)
	cursor, _, _ := pLoadCursorW.Call(0, uintptr(idcArrow))
	t := themeByID("paper")
	app.brBg, _, _ = pCreateSolidBrush.Call(uintptr(t.Bg))
	app.brSide, _, _ = pCreateSolidBrush.Call(uintptr(t.SideBg))
	app.font = makeFont(-20, false, "Microsoft YaHei UI")
	app.fontSmall = makeFont(-16, false, "Microsoft YaHei UI")

	sysBg, _, _ := pGetSysColorBrush.Call(5) // COLOR_WINDOW, do not delete
	cls := wndClassEx{
		CbSize:        uint32(unsafe.Sizeof(wndClassEx{})),
		LpfnWndProc:   app.wndProc,
		HInstance:     hInst,
		HIcon:         windows.Handle(icon),
		HIconSm:       windows.Handle(icon),
		HCursor:       windows.Handle(cursor),
		HbrBackground: windows.Handle(sysBg),
		LpszClassName: utf16Ptr(windowClass),
	}
	_, _, _ = pRegisterClassExW.Call(uintptr(unsafe.Pointer(&cls)))

	screenW, _, _ := user32.NewProc("GetSystemMetrics").Call(0)
	screenH, _, _ := user32.NewProc("GetSystemMetrics").Call(1)
	ww, wh := int32(1100), int32(740)
	x, y := (int32(screenW)-ww)/2, (int32(screenH)-wh)/2

	h, _, err := pCreateWindowExW.Call(
		0,
		uintptr(unsafe.Pointer(utf16Ptr(windowClass))),
		uintptr(unsafe.Pointer(utf16Ptr(appName))),
		wsOverlappedWindow,
		uintptr(x), uintptr(y), uintptr(ww), uintptr(wh),
		0, 0, uintptr(hInst), 0,
	)
	if h == 0 {
		return err
	}
	app.hwnd = h
	buildMenu(h)
	createChildren(h)
	if app.edit == 0 {
		return err
	}
	last, themeID := loadConfig()
	app.themeID = themeID
	applyTheme(themeByID(themeID))
	refreshList("")
	if last == "" || readOpen(last) != nil {
		name, nerr := newNoteFile()
		if nerr != nil {
			return nerr
		}
		refreshList("")
		_ = readOpen(name)
	}
	layout()
	_, _, _ = pShowWindow.Call(h, swShow)
	_, _, _ = pUpdateWindow.Call(h)
	_, _, _ = pSetFocus.Call(app.edit)
	moveCaretEnd()
	return messageLoop(h)
}

func buildMenu(hwnd uintptr) {
	bar, _, _ := pCreateMenu.Call()
	file, _, _ := pCreatePopupMenu.Call()
	theme, _, _ := pCreatePopupMenu.Call()
	help, _, _ := pCreatePopupMenu.Call()
	const mfString = 0x0000
	const mfPopup = 0x0010
	const mfSep = 0x0800
	appendMenu(file, mfString, cmdNew, "新建会议\tCtrl+N")
	appendMenu(file, mfString, cmdSave, "保存\tCtrl+S")
	appendMenu(file, mfString, cmdTime, "插入时间\tF5")
	appendMenu(file, mfString, cmdFolder, "打开笔记文件夹")
	appendMenu(file, mfSep, 0, "")
	appendMenu(file, mfString, cmdQuit, "退出")
	for i, t := range themes {
		appendMenu(theme, mfString, uintptr(cmdTheme+i), t.Name)
	}
	appendMenu(help, mfString, cmdHelp, "快捷键\tF1")
	appendMenu(bar, mfPopup, file, "文件")
	appendMenu(bar, mfPopup, theme, "主题")
	appendMenu(bar, mfPopup, help, "帮助")
	_, _, _ = pSetMenu.Call(hwnd, bar)
	_, _, _ = pDrawMenuBar.Call(hwnd)

	acc := []accel{
		{FVirt: 0x09, Key: 'N', Cmd: cmdNew},
		{FVirt: 0x09, Key: 'S', Cmd: cmdSave},
		{FVirt: 0x01, Key: 0x74, Cmd: cmdTime},
		{FVirt: 0x01, Key: 0x70, Cmd: cmdHelp},
	}
	app.accel, _, _ = pCreateAcceleratorTbl.Call(uintptr(unsafe.Pointer(&acc[0])), uintptr(len(acc)))
}

func createChildren(parent uintptr) {
	// Same control class as notepad.exe: multiline EDIT with a real vertical scrollbar.
	editStyle := uintptr(wsChild | wsVisible | wsVScroll | wsTabStop | wsClipSiblings |
		esMultiline | esAutovscroll | esWantReturn | esNoHideSel)
	app.edit, _, _ = pCreateWindowExW.Call(
		wsExClientEdge,
		uintptr(unsafe.Pointer(utf16Ptr("EDIT"))),
		0,
		editStyle,
		0, 0, 100, 100,
		parent, idEdit, uintptr(app.hInst), 0,
	)
	send(app.edit, emLimitText, 0x7FFFFFFE, 0)
	send(app.edit, wmSetFont, uintptr(app.font), 1)

	app.filter, _, _ = pCreateWindowExW.Call(
		wsExClientEdge,
		uintptr(unsafe.Pointer(utf16Ptr("EDIT"))),
		0,
		wsChild|wsVisible|esAutohscroll|wsTabStop,
		0, 0, 100, 28,
		parent, idFilter, uintptr(app.hInst), 0,
	)
	send(app.filter, wmSetFont, uintptr(app.fontSmall), 1)
	send(app.filter, emSetCueBanner, 1, uintptr(unsafe.Pointer(utf16Ptr("搜索笔记"))))

	app.newBtn, _, _ = pCreateWindowExW.Call(
		0,
		uintptr(unsafe.Pointer(utf16Ptr("BUTTON"))),
		uintptr(unsafe.Pointer(utf16Ptr("新建"))),
		wsChild|wsVisible|wsTabStop|bsPushbutton,
		0, 0, 100, 28,
		parent, idNewBtn, uintptr(app.hInst), 0,
	)
	send(app.newBtn, wmSetFont, uintptr(app.fontSmall), 1)

	app.list, _, _ = pCreateWindowExW.Call(
		wsExClientEdge,
		uintptr(unsafe.Pointer(utf16Ptr("LISTBOX"))),
		0,
		wsChild|wsVisible|wsVScroll|wsTabStop|lbsNotify|lbsNoIntegralHeight|lbsHasStrings,
		0, 0, 100, 100,
		parent, idList, uintptr(app.hInst), 0,
	)
	send(app.list, wmSetFont, uintptr(app.fontSmall), 1)
}

func layout() {
	if app.hwnd == 0 || app.edit == 0 {
		return
	}
	cw, ch := getClient(app.hwnd)
	if cw <= 40 || ch <= 40 {
		return
	}
	side := int32(240)
	pad := int32(8)
	btnH := int32(32)
	filterH := int32(28)
	_, _, _ = pMoveWindow.Call(app.filter, uintptr(pad), uintptr(pad), uintptr(side-pad*2-72), uintptr(filterH), 1)
	_, _, _ = pMoveWindow.Call(app.newBtn, uintptr(side-pad-68), uintptr(pad), 68, uintptr(btnH), 1)
	_, _, _ = pMoveWindow.Call(app.list, uintptr(pad), uintptr(pad*2+btnH), uintptr(side-pad*2), uintptr(ch-pad*3-btnH), 1)
	_, _, _ = pMoveWindow.Call(app.edit, uintptr(side), 0, uintptr(cw-side), uintptr(ch), 1)
}

func messageLoop(hwnd uintptr) error {
	var msg winMsg
	for {
		r, _, _ := pGetMessageW.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
		if int32(r) <= 0 {
			return nil
		}
		if app.accel != 0 {
			tr, _, _ := pTranslateAccelerator.Call(hwnd, app.accel, uintptr(unsafe.Pointer(&msg)))
			if tr != 0 {
				continue
			}
		}
		_, _, _ = pTranslateMessage.Call(uintptr(unsafe.Pointer(&msg)))
		_, _, _ = pDispatchMessageW.Call(uintptr(unsafe.Pointer(&msg)))
	}
}

func killTimers(hwnd uintptr) {
	_, _, _ = pKillTimer.Call(hwnd, timerSave)
}

func shutdown(hwnd uintptr) {
	if !app.alive {
		return
	}
	killTimers(hwnd)
	_ = saveCurrent()
	saveConfig(app.current, app.themeID)
	app.alive = false
	_, _, _ = pDestroyWindow.Call(hwnd)
}

func mainWndProc(hwnd, msg, wParam, lParam uintptr) uintptr {
	defer func() { _ = recover() }()
	switch msg {
	case wmSize:
		layout()
		return 0
	case wmTimer:
		if !app.alive {
			return 0
		}
		if wParam == timerSave {
			killTimers(hwnd)
			_ = saveCurrent()
		}
		return 0
	case wmCommand:
		if !app.alive || app.busy {
			return 0
		}
		id := loWord(wParam)
		note := hiWord(wParam)
		switch id {
		case cmdNew, idNewBtn:
			newMeeting()
		case cmdSave:
			_ = saveCurrent()
		case cmdQuit:
			shutdown(hwnd)
		case cmdTime:
			insertTime()
		case cmdHelp:
			alertHelp()
		case cmdFolder:
			openNotesFolder()
		case idFilter:
			if note == enChange {
				refreshList(getText(app.filter))
			}
		case idList:
			if note == lbnSelChange {
				sel := int32(send(app.list, lbGetCurSel, 0, 0))
				if sel >= 0 && int(sel) < len(app.notes) {
					name := app.notes[sel].File
					if name != app.current {
						_ = saveCurrent()
						_ = readOpen(name)
					}
				}
			}
		case idEdit:
			if note == enChange {
				_, _, _ = pSetTimer.Call(hwnd, timerSave, 800, 0)
			}
		default:
			if id >= cmdTheme && int(id-cmdTheme) < len(themes) {
				app.themeID = themes[id-cmdTheme].ID
				applyTheme(themeByID(app.themeID))
				saveConfig(app.current, app.themeID)
			}
		}
		return 0
	case wmCtlColorList, wmCtlColorEdit, wmCtlColorStatic:
		t := themeByID(app.themeID)
		hdc := wParam
		_, _, _ = pSetTextColor.Call(hdc, uintptr(t.Fg))
		bg := t.SideBg
		br := app.brSide
		if lParam == app.edit {
			bg = t.Bg
			br = app.brBg
		}
		_, _, _ = pSetBkColor.Call(hdc, uintptr(bg))
		return br
	case wmClose:
		shutdown(hwnd)
		return 0
	case wmDestroy:
		app.alive = false
		killTimers(hwnd)
		_, _, _ = pPostQuitMessage.Call(0)
		return 0
	}
	r, _, _ := pDefWindowProcW.Call(hwnd, msg, wParam, lParam)
	return r
}

func applyTheme(t theme) {
	if app.brBg != 0 {
		// Keep the previous brush until process exit. Deleting a brush still
		// referenced by a window class/control can crash GDI.
	}
	app.brBg, _, _ = pCreateSolidBrush.Call(uintptr(t.Bg))
	app.brSide, _, _ = pCreateSolidBrush.Call(uintptr(t.SideBg))
	if app.hwnd != 0 {
		_, _, _ = pInvalidateRect.Call(app.hwnd, 0, 1)
	}
	if app.edit != 0 {
		_, _, _ = pInvalidateRect.Call(app.edit, 0, 1)
	}
}

func refreshList(q string) {
	if app.list == 0 {
		return
	}
	app.busy = true
	defer func() { app.busy = false }()
	send(app.list, lbResetContent, 0, 0)
	all := listNotes()
	q = strings.ToLower(strings.TrimSpace(q))
	sel := 0
	shown := 0
	filtered := make([]note, 0, len(all))
	for _, n := range all {
		if q != "" && !strings.Contains(strings.ToLower(n.Title), q) && !strings.Contains(strings.ToLower(n.File), q) {
			continue
		}
		filtered = append(filtered, n)
		send(app.list, lbAddString, 0, uintptr(unsafe.Pointer(utf16Ptr(n.Title))))
		if n.File == app.current {
			sel = shown
		}
		shown++
	}
	app.notes = filtered
	if shown > 0 {
		send(app.list, lbSetCurSel, uintptr(sel), 0)
	}
}

func readOpen(name string) error {
	body, err := readNoteFile(name)
	if err != nil {
		return err
	}
	app.busy = true
	app.current = name
	setText(app.edit, strings.ReplaceAll(body, "\n", "\r\n"))
	app.busy = false
	setText(app.hwnd, titleFromMarkdown(body)+" - "+appName)
	saveConfig(app.current, app.themeID)
	_, _, _ = pSetFocus.Call(app.edit)
	moveCaretEnd()
	return nil
}

func saveCurrent() error {
	if !app.alive || app.current == "" || app.edit == 0 {
		return nil
	}
	body := strings.ReplaceAll(getText(app.edit), "\r\n", "\n")
	if err := writeNoteFile(app.current, body); err != nil {
		return err
	}
	setText(app.hwnd, titleFromMarkdown(body)+" - "+appName)
	return nil
}

func newMeeting() {
	_ = saveCurrent()
	name, err := newNoteFile()
	if err != nil {
		alert(err.Error())
		return
	}
	refreshList(getText(app.filter))
	_ = readOpen(name)
}

func insertTime() {
	if app.edit == 0 {
		return
	}
	stamp := nowStamp(time.Now())
	send(app.edit, emReplaceSel, 1, uintptr(unsafe.Pointer(utf16Ptr(stamp))))
}

func moveCaretEnd() {
	n := send(app.edit, 0x000E, 0, 0) // WM_GETTEXTLENGTH
	send(app.edit, emSetSel, n, n)
}

func alertHelp() {
	alert("闪记是支持 Markdown 的记事本。\n\nCtrl+N  新会议\nCtrl+S  保存（平时已自动保存）\nF5      插入时间\n左侧列表切换笔记，笔记是本地 .md 文件。\n\n写法：# 标题  **强调**  `代码`  - 列表  - [ ] 待办")
}

func openNotesFolder() {
	_ = exec.Command("explorer.exe", notesDir()).Start()
}
