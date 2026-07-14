#!/usr/bin/env bash
# 在全新 Ubuntu/Debian 服务器上安装 Docker / Compose / Git
# 用法: bash scripts/setup-server.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用 root 或: sudo bash scripts/setup-server.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git gnupg openssl

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

# compose plugin
apt-get install -y docker-compose-plugin || true

usermod -aG docker "${SUDO_USER:-$USER}" 2>/dev/null || true

docker --version
docker compose version
git --version

echo "Docker 已就绪。重新登录后 docker 组生效。"
echo "然后执行:"
echo "  git clone https://github.com/441732218-art/AgentFlow-Eval.git /opt/agentflow-eval"
echo "  cd /opt/agentflow-eval"
echo "  OPENAI_API_KEY=sk-xxx PUBLIC_HOST=你的IP bash scripts/deploy-server.sh"
