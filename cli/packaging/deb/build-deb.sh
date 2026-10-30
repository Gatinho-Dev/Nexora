#!/usr/bin/env bash
# Gera o pacote Debian oficial do Nexora CLI a partir de um binário já compilado.
# Uso: ./build-deb.sh [caminho-do-binário] [versão]
# Binário padrão: target/release/nexora · versão padrão: a do Cargo.toml.
set -euo pipefail

cd "$(dirname "$0")/../../.."   # cli/packaging/deb → raiz do repo

BIN="${1:-cli/target/release/nexora}"
VERSION="${2:-$(grep -m1 '^version' cli/Cargo.toml | sed 's/.*"\(.*\)"/\1/')}"

test -x "$BIN" || { echo "Binário não encontrado: $BIN — rode 'cargo build --release' em cli/ primeiro." >&2; exit 1; }

PKG="nexora-cli_${VERSION}_amd64"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# Árvore do pacote
mkdir -p "$STAGE/$PKG/usr/bin"
mkdir -p "$STAGE/$PKG/usr/share/doc/nexora-cli"
mkdir -p "$STAGE/$PKG/DEBIAN"

install -m 0755 "$BIN" "$STAGE/$PKG/usr/bin/nexora"
install -m 0644 cli/README.md "$STAGE/$PKG/usr/share/doc/nexora-cli/README.md"

cat > "$STAGE/$PKG/DEBIAN/control" <<EOF
Package: nexora-cli
Version: $VERSION
Architecture: amd64
Maintainer: Nexora <contact@nexorachat.cloud>
Depends: libc6 (>= 2.31)
Section: net
Priority: optional
Homepage: https://nexorachat.cloud
Description: Nexora CLI — cliente oficial de texto do Nexora para o terminal
 TUI moderna (Ratatui) conectada à mesma conta e API do Nexora Web.
 Login pelo navegador via device flow, realtime por WebSocket e
 atualização automática via GitHub Releases. Somente texto.
License: MIT
EOF

dpkg-deb --root-owner-group --build "$STAGE/$PKG" "$PKG.deb"
echo "★ Pacote gerado: $PKG.deb"
echo "  Instalar:  sudo apt install ./$PKG.deb"
echo "  Testar:    nexora --version"
