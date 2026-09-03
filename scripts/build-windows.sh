#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

npm run build
rm -rf desktop/dist
cp -a dist desktop/dist

export PATH="$PATH:$HOME/go/bin:$HOME/.local/go/bin"
if ! command -v go-winres >/dev/null 2>&1; then
  go install github.com/tc-hib/go-winres@latest
fi

(
  cd desktop
  go-winres make --in winres.json --arch amd64 --product-version 1.0.0 --file-version 1.0.0
)

mkdir -p release
ldflags_common='-s -w -H windowsgui'
export CGO_ENABLED=0
export GOOS=windows
export GOARCH=amd64

go build -C desktop -trimpath -ldflags "$ldflags_common -X main.flavor=portable" -o "$root/release/FlashNote.exe"
go build -C desktop -trimpath -ldflags "$ldflags_common -X main.flavor=setup" -o "$root/release/FlashNote-Setup.exe"

# Drop the generated syso so Linux `go build` in this folder stays quiet.
rm -f desktop/*.syso

ls -lh release/FlashNote.exe release/FlashNote-Setup.exe
