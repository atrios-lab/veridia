#!/usr/bin/env bash
# Compila o Assinador Veridia (tools/assinador-local) para Windows e o põe
# em public/downloads, de onde o painel o oferece para baixar.
#
#   scripts/build-assinador.sh           compila e substitui o .exe
#   scripts/build-assinador.sh --check   testa e confere se o .exe guardado
#                                        é exatamente o deste código (CI)
#
# A compilação é reproduzível (mesma versão do Go, -trimpath, sem dados do
# git): o mesmo código dá o mesmo arquivo, byte a byte.
set -euo pipefail
cd "$(dirname "$0")/../tools/assinador-local"
export GOTOOLCHAIN=local CGO_ENABLED=0
go test ./...
GOOS=windows GOARCH=amd64 go vet ./...
saida="../../public/downloads/AssinadorVeridia.exe"
alvo="$saida"
if [ "${1:-}" = "--check" ]; then
  alvo="$(mktemp -d)/AssinadorVeridia.exe"
fi
GOOS=windows GOARCH=amd64 go build -trimpath -buildvcs=false \
  -ldflags "-H windowsgui -s -w" -o "$alvo" .
if [ "${1:-}" = "--check" ]; then
  if ! cmp -s "$alvo" "$saida"; then
    echo "public/downloads/AssinadorVeridia.exe não é o deste código."
    echo "Rode scripts/build-assinador.sh com Go $(go env GOVERSION) e faça commit."
    exit 1
  fi
  echo "AssinadorVeridia.exe confere com o código ($(sha256sum "$saida" | cut -c1-16)...)."
fi
