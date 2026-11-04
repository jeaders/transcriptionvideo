#!/usr/bin/env bash
# Costruisce il pacchetto .deb di Trascrivo per Linux (amd64).
# Richiede: npm, node, dpkg-deb. Esegui dalla root del progetto.
set -euo pipefail

VERSION="1.0.0"
ARCH="amd64"
PKG="trascrivo"
STAGE="$(mktemp -d)/${PKG}"
OUT="$(pwd)/${PKG}_${VERSION}_${ARCH}.deb"

echo "==> build Next.js"
npm run build

echo "==> stage files"
mkdir -p "${STAGE}/opt/trascrivo" "${STAGE}/usr/bin" "${STAGE}/usr/share/applications" "${STAGE}/DEBIAN"
# copia tutto il necessario per next start + migrate (escludi dev artefatti)
rsync -a --delete \
  --exclude='.git' --exclude='.next/cache' --exclude='node_modules/.cache' \
  .next package.json node_modules drizzle scripts \
  "${STAGE}/opt/trascrivo/"

# launcher
install -m 0755 scripts/trascrivo-launcher.sh "${STAGE}/usr/bin/trascrivo"

# desktop entry
cat > "${STAGE}/usr/share/applications/trascrivo.desktop" <<'EOF'
[Desktop Entry]
Name=Trascrivo
Comment=Trascrizione video AI in italiano e inglese
Exec=/usr/bin/trascrivo
Type=Application
Terminal=false
Categories=AudioVideo;Audio;Utility;
EOF

# control
cat > "${STAGE}/DEBIAN/control" <<EOF
Package: ${PKG}
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: ${ARCH}
Depends: nodejs (>= 18), ffmpeg
Recommends: yt-dlp
Maintainer: Trascrivo <noreply@trascrivo.local>
Description: Piattaforma di trascrizione video AI (italiano/inglese)
 Incolla link o carica file audio/video e ottieni trascrizioni con
 timestamp, traduzione ed export SRT/VTT/TXT/Word. Privacy by design:
 l'audio resta sul tuo dispositivo.
EOF

# postinst
cat > "${STAGE}/DEBIAN/postinst" <<'EOF'
#!/bin/sh
set -e
chmod +x /usr/bin/trascrivo
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
fi
EOF
chmod 0755 "${STAGE}/DEBIAN/postinst"

echo "==> dpkg-deb"
dpkg-deb --build "${STAGE}" "$OUT"
echo "==> creato: $OUT"
ls -lh "$OUT"
