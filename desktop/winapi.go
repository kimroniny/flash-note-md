//go:build windows

package main

import (
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	wmDestroy       = 0x0002
	wmSize          = 0x0005
	wmSetFocus      = 0x0007
	wmClose         = 0x0010
	wmDrawItem      = 0x002B
	wmMeasureItem   = 0x002C
	wmCommand       = 0x0111
	wmSysCommand    = 0x0112
	wmTimer         = 0x0113
	wmCtlColorEdit  = 0x0133
	wmCtlColorList  = 0x0134
	wmCtlColorStatic = 0x0138
	wmUser          = 0x0400

	wsOverlappedWindow = 0x00CF0000
	wsChild            = 0x40000000
	wsVisible          = 0x10000000
	wsVScroll          = 0x00200000
	wsHScroll          = 0x00100000
	wsBorder           = 0x00800000
	wsTabStop          = 0x00010000
	wsClipSiblings     = 0x04000000
	wsExClientEdge     = 0x00000200
	wsExCliened        = 0x00000200
	wsExWindowEdge     = 0x00000100

	esMultiline     = 0x0004
	esAutovscroll   = 0x0040
	esAutohscroll   = 0x0080
	esNoHideSel     = 0x0100
	esWantReturn    = 0x1000
	esDisableNoScrl = 0x2000

	lbsNotify          = 0x0001
	lbsNoIntegralHeight = 0x0100
	lbsHasStrings      = 0x0040

	bsPushbutton = 0x00000000

	swShow     = 5
	swRestore  = 9
	swUseDefault = 0x80000000

	enChange     = 0x0300
	lbnSelChange = 1
	bnClicked    = 0

	idcArrow = 32512
	colorWindow = 5

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

	timerColor = 1
	timerSave  = 2

	emSetBkgndColor   = wmUser + 67
	emSetCharFormat   = wmUser + 68
	emExLimitText     = wmUser + 53
	emExGetSel        = wmUser + 52
	emExSetSel        = wmUser + 55
	emHideSelection   = wmUser + 63
	emSetEventMask    = wmUser + 69
	emSetTargetDevice = wmUser + 72
	emGetTextEx       = wmUser + 94
	enmChange         = 0x00000001

	scfSelection = 0x0001
	scfAll       = 0x0004
	cfmBold      = 0x00000001
	cfmSize      = 0x80000000
	cfmColor     = 0x40000000
	cfmFace      = 0x20000000
	cfeBold      = 0x00000001

	fwNormal = 400
	fwBold   = 700
	ansiCharset = 0
	defaultQuality = 0
	outDefaultPrecis = 0
	clipDefaultPrecis = 0
	variablePitch = 2

	mbOk = 0
)

type charRange struct {
	Min int32
	Max int32
}

type charFormat struct {
	CbSize          uint32
	DwMask          uint32
	DwEffects       uint32
	YHeight         int32
	YOffset         int32
	CrTextColor     uint32
	BCharSet        byte
	BPitchAndFamily byte
	SzFaceName      [32]uint16
}

type getTextEx struct {
	Cb            uint32
	Flags         uint32
	Codepage      uint32
	LpDefaultChar *byte
	LpUsedDefChar *int32
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
	user32   = windows.NewLazySystemDLL("user32.dll")
	gdi32    = windows.NewLazySystemDLL("gdi32.dll")
	msftedit = windows.NewLazySystemDLL("msftedit.dll")

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
	pGetDlgCtrlID         = user32.NewProc("GetDlgCtrlID")
	pSetWindowPos         = user32.NewProc("SetWindowPos")
	pIsDialogMessageW     = user32.NewProc("IsDialogMessageW")
	pGetSysColorBrush     = user32.NewProc("GetSysColorBrush")

	pCreateSolidBrush = gdi32.NewProc("CreateSolidBrush")
	pCreateFontW      = gdi32.NewProc("CreateFontW")
	pSetTextColor     = gdi32.NewProc("SetTextColor")
	pSetBkColor       = gdi32.NewProc("SetBkColor")
	pDeleteObject     = gdi32.NewProc("DeleteObject")
)

type rect struct {
	Left, Top, Right, Bottom int32
}

func loWord(v uintptr) uintptr { return v & 0xFFFF }
func hiWord(v uintptr) uintptr { return (v >> 16) & 0xFFFF }

func utf16Ptr(s string) *uint16 {
	p, _ := windows.UTF16PtrFromString(s)
	return p
}

func send(hwnd uintptr, msg uint32, w, l uintptr) uintptr {
	r, _, _ := pSendMessageW.Call(hwnd, uintptr(msg), w, l)
	return r
}

func setText(hwnd uintptr, s string) {
	_, _, _ = pSetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(utf16Ptr(s))))
}

func getText(hwnd uintptr) string {
	n, _, _ := pGetWindowTextLengthW.Call(hwnd)
	if n == 0 {
		// RichEdit sometimes reports 0 via WM_GETTEXTLENGTH; still try GETTEXTEX later.
		buf := make([]uint16, 1)
		_, _, _ = pGetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&buf[0])), 1)
		return ""
	}
	buf := make([]uint16, n+1)
	_, _, _ = pGetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&buf[0])), n+1)
	return windows.UTF16ToString(buf)
}

func getRichText(hwnd uintptr) string {
	n := int(send(hwnd, 0x000E, 0, 0)) // WM_GETTEXTLENGTH
	if n <= 0 {
		return ""
	}
	buf := make([]uint16, n+2)
	gt := getTextEx{
		Cb:       uint32(len(buf) * 2),
		Flags:    1, // GT_USECRLF
		Codepage: 1200,
	}
	send(hwnd, emGetTextEx, uintptr(unsafe.Pointer(&gt)), uintptr(unsafe.Pointer(&buf[0])))
	return windows.UTF16ToString(buf)
}

func rgb(r, g, b uint8) uint32 {
	return uint32(r) | uint32(g)<<8 | uint32(b)<<16
}

func faceName(s string) [32]uint16 {
	var out [32]uint16
	u, _ := windows.UTF16FromString(s)
	copy(out[:], u)
	return out
}

func mustLoadMsftedit() error {
	return msftedit.Load()
}

func makeFont(px int32, bold bool, name string) windows.Handle {
	weight := int32(fwNormal)
	if bold {
		weight = fwBold
	}
	h, _, _ := pCreateFontW.Call(
		uintptr(px), 0, 0, 0, uintptr(weight), 0, 0, 0,
		1, // DEFAULT_CHARSET
		uintptr(outDefaultPrecis), uintptr(clipDefaultPrecis), 5, // CLEARTYPE_QUALITY
		uintptr(variablePitch),
		uintptr(unsafe.Pointer(utf16Ptr(name))),
	)
	return windows.Handle(h)
}

func appendMenu(menu uintptr, flags uint32, id uintptr, text string) {
	_, _, _ = pAppendMenuW.Call(menu, uintptr(flags), id, uintptr(unsafe.Pointer(utf16Ptr(text))))
}

func lowordLparam(lp uintptr) int32 { return int32(int16(lp & 0xFFFF)) }
func hiwordLparam(lp uintptr) int32 { return int32(int16((lp >> 16) & 0xFFFF)) }

func getClient(hwnd uintptr) (w, h int32) {
	var r rect
	_, _, _ = pGetClientRect.Call(hwnd, uintptr(unsafe.Pointer(&r)))
	return r.Right, r.Bottom
}
