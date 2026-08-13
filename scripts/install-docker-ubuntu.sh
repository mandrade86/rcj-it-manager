#!/usr/bin/env bash
# Instala Docker Engine + Compose plugin en Ubuntu Server 22.04/24.04
# Uso: sudo bash scripts/install-docker-ubuntu.sh
set -euo pipefail

if [[ "${EUID:-}" -ne 0 ]]; then
  echo "Ejecuta con sudo: sudo bash scripts/install-docker-ubuntu.sh"
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl gnupg

install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
  curl -fsSL --proto '=https' --tlsv1.2 https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
fi

ARCH="$(dpkg --print-architecture)"
CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME:-$UBUNTU_CODENAME}")"
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker

echo ""
echo "Docker instalado:"
docker --version
docker compose version
echo ""
echo "Opcional: agregar tu usuario al grupo docker:"
echo "  sudo usermod -aG docker \$USER && newgrp docker"
