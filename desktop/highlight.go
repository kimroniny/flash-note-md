//go:build windows

package main

import "regexp"

type mdSpan struct {
	Start, End int // UTF-16 offsets
	Kind       int
}

const (
	kindNormal = iota
	kindH1
	kindH2
	kindH3
	kindBold
	kindCode
	kindQuote
	kindList
)

var (
	reHeading = regexp.MustCompile(`(?m)^(#{1,3}) +.*$`)
	reQuote   = regexp.MustCompile(`(?m)^> ?.*$`)
	reList    = regexp.MustCompile(`(?m)^(?:[-*+]|\d+\.) .*$`)
	reBold    = regexp.MustCompile(`\*\*[^*\n]+\*\*`)
	reCode    = regexp.MustCompile("`[^`\n]+`")
)

func markdownSpans(text string) []mdSpan {
	var spans []mdSpan
	add := func(start, end, kind int) {
		if start < 0 || end <= start {
			return
		}
		spans = append(spans, mdSpan{Start: byteToUTF16(text, start), End: byteToUTF16(text, end), Kind: kind})
	}
	for _, m := range reHeading.FindAllStringIndex(text, -1) {
		hashes := 0
		for hashes < 3 && m[0]+hashes < m[1] && text[m[0]+hashes] == '#' {
			hashes++
		}
		kind := kindH3
		if hashes == 1 {
			kind = kindH1
		} else if hashes == 2 {
			kind = kindH2
		}
		add(m[0], m[1], kind)
	}
	for _, m := range reQuote.FindAllStringIndex(text, -1) {
		add(m[0], m[1], kindQuote)
	}
	for _, m := range reList.FindAllStringIndex(text, -1) {
		add(m[0], m[1], kindList)
	}
	for _, m := range reBold.FindAllStringIndex(text, -1) {
		add(m[0], m[1], kindBold)
	}
	for _, m := range reCode.FindAllStringIndex(text, -1) {
		add(m[0], m[1], kindCode)
	}
	return spans
}
