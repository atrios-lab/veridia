#!/usr/bin/env bash
# Prepara o Inno Setup no Wine (Linux), para o scripts/build-assinador.sh
# montar o instalador do Assinador Veridia. Imprime o comando do compilador
# (ISCC). Rodar de novo não baixa nem instala outra vez.
#
#   ISCC="$(scripts/inno-setup.sh)" scripts/build-assinador.sh
#
# Precisa de: wine (Ubuntu: wine wine64 wine32:i386, com a arquitetura i386
# ligada), xvfb e curl. A versão é fixa: outra versão do Inno Setup gera
# outro instalador, e o CI deixa de conferir com o guardado.
set -euo pipefail

VERSAO=6.5.4
SHA256=fa73bf47a4da250d185d07561c2bfda387e5e20db77e4570004cf6a133cc10b1
URL="https://github.com/jrsoftware/issrc/releases/download/is-${VERSAO//./_}/innosetup-$VERSAO.exe"

export WINEPREFIX="${INNO_PREFIX:-$HOME/.cache/veridia-inno}" WINEDEBUG=-all
# Sem uma pasta de execução própria, o wineserver do Ubuntu pode cair.
export XDG_RUNTIME_DIR="$WINEPREFIX.run"
mkdir -p "$XDG_RUNTIME_DIR" && chmod 700 "$XDG_RUNTIME_DIR"

iscc="$WINEPREFIX/drive_c/inno-$VERSAO/ISCC.exe"
if [ ! -f "$iscc" ]; then
  baixado="$(mktemp -d)/innosetup-$VERSAO.exe"
  curl -fsSL -o "$baixado" "$URL"
  echo "$SHA256  $baixado" | sha256sum -c --quiet - >&2
  wine wineboot -i >/dev/null 2>&1
  wineserver -w
  # Para todos os usuários: no Wine, a pasta de programas do usuário
  # ({autopf} com /CURRENTUSER) não existe e o instalador para.
  xvfb-run -a wine "$baixado" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART \
    /ALLUSERS "/DIR=C:\\inno-$VERSAO" >/dev/null 2>&1 || true
  wineserver -w
  rm -rf "$(dirname "$baixado")"
  if [ ! -f "$iscc" ]; then
    echo "O Inno Setup $VERSAO não instalou no Wine ($WINEPREFIX)." >&2
    exit 1
  fi
fi

echo "env WINEPREFIX=$WINEPREFIX WINEDEBUG=-all XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR wine C:\\inno-$VERSAO\\ISCC.exe"
