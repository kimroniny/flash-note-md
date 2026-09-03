//go:build windows

package main

import (
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	wmDestroy        = 0x0002
	wmSize           = 0x0005
	wmClose          = 0x0010
	wmSetFont        = 0x0030
	wmCommand        = 0x0111
	wmTimer          = 0x0113
	wmCtlColorEdit   = 0x0133
	wmCtlColorList   = 0x0134
	wmCtlColorStatic = 0x0138

	wsOverlappedWindow = 0x00CF0000
	wsChild            = 0x40000000
	wsVisible          = 0x10000000
	wsVScroll          = 0x00200000
	wsTabStop          = 0x00010000
	wsClipSiblings     = 0x04000000
	wsExClientEdge     = 0x00000200

	esMultiline   = 0x0004
	esAutovscroll = 0x0040
	esAutohscroll = 0x0080
	esNoHideSel   = 0x0100
	esWantReturn  = 0x1000

	lbsNotify           = 0x0001
	lbsNoIntegralHeight = 0x0100
	lbsHasStrings       = 0x0040

	bsPushbutton = 0x00000000

	swShow    = 5
	swRestore = 9

	enChange     = 0x0300
	lbnSelChange = 1

	idcArrow = 32512

	cmdNew    = 1001
	cmdSave   = 1002
	cmdQuit   = 1003
	cmdTime   = 1004
	cmdHelp   = 1005
	cmdFolder = 1006
	cmdTheme  = 1100

	idEdit   = 20
	idList   = 21
	idFilter = 22
	idNewBtn = 23

	timerSave = 2

	emLimitText    = 0x00C5
	emReplaceSel   = 0x00C2
	emSetSel       = 0x00B1
	emSetCueBanner = 0x1501

	lbAddString    = 0x0180
	lbResetContent = 0x0184
	lbSetCurSel    = 0x0186
	lbGetCurSel    = 0x0188

	fwNormal          = 400
	fwBold            = 700
	outDefaultPrecis  = 0
	clipDefaultPrecis = 0
	variablePitch     = 2
)

type winMsg struct {
	Hwnd    uintptr
	Message uint32
	Pad     uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	X, Y    int32
	_       uint32
}

type rect struct {
	Left, Top, Right, Bottom int32
}

type wndClassEx struct {
	CbSize        uint32
	Style         uint32
	LpfnWndProc   uintptr
	CbClsExtra    int32
	CbWndExtra    int32
	HInstance     windows.Handle
	HIcon         windows.Handle
	HCursor       windows.Handle
	HbrBackground windows.Handle
	LpszMenuName  *uint16
	LpszClassName *uint16
	HIconSm       windows.Handle
}

type accel struct {
	FVirt uint8
	Pad   uint8
	Key   uint16
	Cmd   uint16
}

var (
	user32 = windows.NewLazySystemDLL("user32.dll")
	gdi32  = windows.NewLazySystemDLL("gdi32.dll")

	pRegisterClassExW     = user32.NewProc("RegisterClassExW")
	pCreateWindowExW      = user32.NewProc("CreateWindowExW")
	pDefWindowProcW       = user32.NewProc("DefWindowProcW")
	pGetMessageW          = user32.NewProc("GetMessageW")
	pTranslateMessage     = user32.NewProc("TranslateMessage")
	pDispatchMessageW     = user32.NewProc("DispatchMessageW")
	pTranslateAccelerator = user32.NewProc("TranslateAcceleratorW")
	pCreateAcceleratorTbl = user32.NewProc("CreateAcceleratorTableW")
	pShowWindow           = user32.NewProc("ShowWindow")
	pUpdateWindow         = user32.NewProc("UpdateWindow")
	pSetFocus             = user32.NewProc("SetFocus")
	pMoveWindow           = user32.NewProc("MoveWindow")
	pGetClientRect        = user32.NewProc("GetClientRect")
	pGetWindowTextLengthW = user32.NewProc("GetWindowTextLengthW")
	pGetWindowTextW       = user32.NewProc("GetWindowTextW")
	pSetWindowTextW       = user32.NewProc("SetWindowTextW")
	pSendMessageW         = user32.NewProc("SendMessageW")
	pPostQuitMessage      = user32.NewProc("PostQuitMessage")
	pLoadCursorW          = user32.NewProc("LoadCursorW")
	pLoadImageW           = user32.NewProc("LoadImageW")
	pDestroyWindow        = user32.NewProc("DestroyWindow")
	pInvalidateRect       = user32.NewProc("InvalidateRect")
	pSetTimer             = user32.NewProc("SetTimer")
	pKillTimer            = user32.NewProc("KillTimer")
	pCreateMenu           = user32.NewProc("CreateMenu")
	pCreatePopupMenu      = user32.NewProc("CreatePopupMenu")
	pAppendMenuW          = user32.NewProc("AppendMenuW")
	pSetMenu              = user32.NewProc("SetMenu")
	pDrawMenuBar          = user32.NewProc("DrawMenuBar")
	pGetSysColorBrush     = user32.NewProc("GetSysColorBrush")

	pCreateSolidBrush = gdi32.NewProc("CreateSolidBrush")
	pCreateFontW      = gdi32.NewProc("CreateFontW")
	pSetTextColor     = gdi32.NewProc("SetTextColor")
	pSetBkColor       = gdi32.NewProc("SetBkColor")
)

func loWord(v uintptr) uintptr { return v & 0xFFFF }
func hiWord(v uintptr) uintptr { return (v >> 16) & 0xFFFF }

func utf16Ptr(s string) *uint16 {
	p, _ := windows.UTF16PtrFromString(s)
	return p
}

func send(hwnd uintptr, msg uint32, w, l uintptr) uintptr {
	if hwnd == 0 {
		return 0
	}
	r, _, _ := pSendMessageW.Call(hwnd, uintptr(msg), w, l)
	return r
}

func setText(hwnd uintptr, s string) {
	if hwnd == 0 {
		return
	}
	_, _, _ = pSetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(utf16Ptr(s))))
}

func getText(hwnd uintptr) string {
	if hwnd == 0 {
		return ""
	}
	n, _, _ := pGetWindowTextLengthW.Call(hwnd)
	if n <= 0 {
		return ""
	}
	buf := make([]uint16, n+1)
	got, _, _ := pGetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&buf[0])), n+1)
	if got == 0 {
		return ""
	}
	return windows.UTF16ToString(buf)
}

func rgb(r, g, b uint8) uint32 {
	return uint32(r) | uint32(g)<<8 | uint32(b)<<16
}

func makeFont(px int32, bold bool, name string) windows.Handle {
	weight := int32(fwNormal)
	if bold {
		weight = fwBold
	}
	h, _, _ := pCreateFontW.Call(
		uintptr(px), 0, 0, 0, uintptr(weight), 0, 0, 0,
		1,
		uintptr(outDefaultPrecis), uintptr(clipDefaultPrecis), 5,
		uintptr(variablePitch),
		uintptr(unsafe.Pointer(utf16Ptr(name))),
	)
	return windows.Handle(h)
}

func appendMenu(menu uintptr, flags uint32, id uintptr, text string) {
	_, _, _ = pAppendMenuW.Call(menu, uintptr(flags), id, uintptr(unsafe.Pointer(utf16Ptr(text))))
}

func getClient(hwnd uintptr) (w, h int32) {
	var r rect
	_, _, _ = pGetClientRect.Call(hwnd, uintptr(unsafe.Pointer(&r)))
	return r.Right, r.Bottom
}
