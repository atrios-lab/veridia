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

# Espera o Wine terminar (o que faria "wineserver -w"). Não chama o
# wineserver pelo nome: no runner do GitHub (Ubuntu 26.04, Wine 10) ele não
# está no PATH nem na pasta do Ubuntu 24.04, e cada versão o guarda num lugar.
esperar_wine() {
  for _ in $(seq 1 120); do
    pgrep -u "$(id -u)" wineserver >/dev/null || return 0
    sleep 1
  done
  echo "O Wine não terminou em 2 minutos." >&2
  return 1
}

iscc="$WINEPREFIX/drive_c/inno-$VERSAO/ISCC.exe"
if [ ! -f "$iscc" ]; then
  baixado="$(mktemp -d)/innosetup-$VERSAO.exe"
  curl -fsSL -o "$baixado" "$URL"
  echo "$SHA256  $baixado" | sha256sum -c --quiet - >&2
  wine wineboot -i >/dev/null 2>&1
  esperar_wine
  # Para todos os usuários: no Wine, a pasta de programas do usuário
  # ({autopf} com /CURRENTUSER) não existe e o instalador para.
  xvfb-run -a wine "$baixado" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART \
    /ALLUSERS "/DIR=C:\\inno-$VERSAO" >/dev/null 2>&1 || true
  esperar_wine
  rm -rf "$(dirname "$baixado")"
  if [ ! -f "$iscc" ]; then
    echo "O Inno Setup $VERSAO não instalou no Wine ($WINEPREFIX)." >&2
    exit 1
  fi
fi

echo "env WINEPREFIX=$WINEPREFIX WINEDEBUG=-all XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR wine C:\\inno-$VERSAO\\ISCC.exe"
