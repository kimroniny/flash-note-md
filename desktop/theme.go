//go:build windows

package main

type theme struct {
	ID, Name               string
	Bg, Fg, Accent, SideBg uint32
	H1, Code, Quote        uint32
}

var themes = []theme{
	{ID: "paper", Name: "日光", Bg: rgb(251, 246, 238), Fg: rgb(36, 28, 20), Accent: rgb(212, 82, 30), SideBg: rgb(239, 230, 216), H1: rgb(36, 28, 20), Code: rgb(122, 48, 16), Quote: rgb(180, 83, 42)},
	{ID: "ink", Name: "墨夜", Bg: rgb(27, 24, 36), Fg: rgb(239, 232, 220), Accent: rgb(255, 154, 98), SideBg: rgb(21, 19, 29), H1: rgb(255, 224, 196), Code: rgb(255, 176, 120), Quote: rgb(255, 176, 137)},
	{ID: "sepia", Name: "羊皮纸", Bg: rgb(244, 228, 196), Fg: rgb(59, 39, 18), Accent: rgb(168, 72, 18), SideBg: rgb(234, 215, 176), H1: rgb(59, 39, 18), Code: rgb(120, 48, 12), Quote: rgb(154, 67, 18)},
	{ID: "forest", Name: "林间", Bg: rgb(238, 246, 235), Fg: rgb(26, 47, 28), Accent: rgb(47, 125, 70), SideBg: rgb(213, 230, 208), H1: rgb(26, 47, 28), Code: rgb(20, 90, 40), Quote: rgb(47, 125, 70)},
	{ID: "ocean", Name: "深海", Bg: rgb(18, 34, 50), Fg: rgb(215, 232, 244), Accent: rgb(77, 178, 214), SideBg: rgb(14, 27, 40), H1: rgb(200, 230, 245), Code: rgb(120, 200, 230), Quote: rgb(127, 208, 234)},
	{ID: "sakura", Name: "樱花", Bg: rgb(255, 244, 246), Fg: rgb(74, 30, 44), Accent: rgb(212, 83, 126), SideBg: rgb(245, 220, 226), H1: rgb(74, 30, 44), Code: rgb(160, 40, 80), Quote: rgb(196, 59, 106)},
	{ID: "slate", Name: "石墨", Bg: rgb(243, 245, 247), Fg: rgb(27, 31, 36), Accent: rgb(47, 111, 235), SideBg: rgb(230, 234, 238), H1: rgb(27, 31, 36), Code: rgb(20, 60, 140), Quote: rgb(47, 111, 235)},
	{ID: "contrast", Name: "高对比", Bg: rgb(0, 0, 0), Fg: rgb(255, 255, 255), Accent: rgb(255, 230, 0), SideBg: rgb(0, 0, 0), H1: rgb(255, 255, 255), Code: rgb(255, 230, 0), Quote: rgb(255, 230, 0)},
}

func themeByID(id string) theme {
	for _, t := range themes {
		if t.ID == id {
			return t
		}
	}
	return themes[0]
}
