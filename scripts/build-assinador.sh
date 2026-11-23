#!/usr/bin/env bash
# Compila o Assinador Veridia (tools/assinador-local) para Windows e monta o
# instalador, que o painel oferece para baixar.
#
#   scripts/build-assinador.sh           compila e substitui os dois arquivos
#   scripts/build-assinador.sh --check   testa e confere se os arquivos
#                                        guardados são exatamente os deste
#                                        código (CI)
#
# Gera:
#   tools/assinador-local/dist/AssinadorVeridia.exe  o programa
#   public/downloads/InstalarAssinadorVeridia.exe     o instalador (Inno Setup)
#
# O instalador sai do tools/assinador-local/instalador/AssinadorVeridia.iss.
# A variável ISCC diz como chamar o compilador do Inno Setup 6.5.4. Sem ela,
# o script prepara o Inno Setup no Wine (scripts/inno-setup.sh). No Windows:
#   ISCC="/c/Program Files (x86)/Inno Setup 6/ISCC.exe" scripts/build-assinador.sh
#
# As duas compilações são reproduzíveis (mesma versão do Go e do Inno Setup,
# -trimpath, sem dados do git, data fixa nos arquivos do instalador): o mesmo
# código dá os mesmos arquivos, byte a byte.
set -euo pipefail
raiz="$(cd "$(dirname "$0")/.." && pwd)"
cd "$raiz/tools/assinador-local"
export GOTOOLCHAIN=local CGO_ENABLED=0
go test ./...
GOOS=windows GOARCH=amd64 go vet ./...

programa="dist/AssinadorVeridia.exe"
instalador="$raiz/public/downloads/InstalarAssinadorVeridia.exe"
versao="$(sed -n 's/^const Versao = "\(.*\)"$/\1/p' servidor.go)"
if [ -z "$versao" ]; then
  echo "Não achei a versão (const Versao) em servidor.go."
  exit 1
fi

# Monta numa pasta à parte, com a mesma estrutura do repositório (o .iss
# lê ..\dist e grava em ..\..\..\public\downloads). Assim, no --check, os
# arquivos guardados não mudam.
obra="$(mktemp -d)"
trap 'rm -rf "$obra"' EXIT
mkdir -p "$obra/tools/assinador-local/dist" \
  "$obra/tools/assinador-local/instalador" "$obra/public/downloads"
novo_programa="$obra/tools/assinador-local/$programa"
novo_instalador="$obra/public/downloads/InstalarAssinadorVeridia.exe"
GOOS=windows GOARCH=amd64 go build -trimpath -buildvcs=false \
  -ldflags "-H windowsgui -s -w" -o "$novo_programa" .
cp instalador/AssinadorVeridia.iss "$obra/tools/assinador-local/instalador/"

iscc="${ISCC:-$("$raiz/scripts/inno-setup.sh")}"
(cd "$obra/tools/assinador-local/instalador" &&
  $iscc /Q "/DVersao=$versao" AssinadorVeridia.iss >/dev/null)

if [ "${1:-}" = "--check" ]; then
  falhou=0
  if ! cmp -s "$novo_programa" "$programa"; then
    echo "tools/assinador-local/$programa não é o deste código."
    falhou=1
  fi
  if ! cmp -s "$novo_instalador" "$instalador"; then
    echo "public/downloads/InstalarAssinadorVeridia.exe não é o deste código."
    falhou=1
  fi
  if [ "$falhou" = 1 ]; then
    echo "Rode scripts/build-assinador.sh com Go $(go env GOVERSION) e Inno Setup 6.5.4 e faça commit."
    exit 1
  fi
  echo "AssinadorVeridia.exe ($(sha256sum "$programa" | cut -c1-16)...) e"
  echo "InstalarAssinadorVeridia.exe ($(sha256sum "$instalador" | cut -c1-16)...) conferem com o código."
  exit 0
fi

mkdir -p dist "$(dirname "$instalador")"
cp "$novo_programa" "$programa"
cp "$novo_instalador" "$instalador"
echo "Assinador Veridia $versao: tools/assinador-local/$programa e public/downloads/InstalarAssinadorVeridia.exe."
