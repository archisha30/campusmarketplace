#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 Vultr server for the CampusMarket API.
# Run as root:  bash setup.sh api.yourdomain.com
# Safe to run again, e.g. after changing the Caddyfile or the service file here.
# Full walkthrough: deploy/vultr/README.md
set -euo pipefail

API_DOMAIN="${1:?Usage: bash setup.sh <api domain>, e.g. api.campusmarket.me}"
REPO_URL="https://github.com/archisha30/campusmarketplace.git"
APP_USER=campusmarket
APP_DIR=/srv/campusmarket
DEPLOY_SRC="$APP_DIR/deploy/vultr"

[ "$(id -u)" -eq 0 ] || { echo "Run this as root."; exit 1; }

echo "==> System updates and packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
apt-get install -yq git curl gnupg ufw unattended-upgrades debian-keyring debian-archive-keyring apt-transport-https

echo "==> Automatic security updates"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

echo "==> Swap (headroom for photo and PDF processing)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Firewall: SSH, HTTP and HTTPS only"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> SSH: keys only"
if [ -s /root/.ssh/authorized_keys ]; then
  cat > /etc/ssh/sshd_config.d/10-campusmarket.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
  systemctl reload ssh
else
  echo "    No SSH key on root, so password login stays on (turning it off now would lock you out)."
fi

echo "==> Caddy (HTTPS in front of the API)"
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -yq caddy
fi

echo "==> uv"
command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh

echo "==> App user and code"
id "$APP_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$APP_USER"
install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR"
[ -d "$APP_DIR/.git" ] || sudo -u "$APP_USER" git clone --quiet --branch main "$REPO_URL" "$APP_DIR"

echo "==> Service, Caddy config and deploy command"
install -m 644 "$DEPLOY_SRC/campusmarket.service" /etc/systemd/system/campusmarket.service
sed "s/api\.example\.com/$API_DOMAIN/" "$DEPLOY_SRC/Caddyfile" > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
install -m 755 "$DEPLOY_SRC/update.sh" /usr/local/bin/campusmarket-deploy
# The deploy runs as the app user and may restart the API, nothing else.
echo "$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart campusmarket" > /etc/sudoers.d/campusmarket
chmod 440 /etc/sudoers.d/campusmarket
visudo -cf /etc/sudoers.d/campusmarket >/dev/null
systemctl daemon-reload
systemctl enable campusmarket  # starts on boot; the first deploy starts it now
systemctl reload-or-restart caddy

echo "==> Deploy key for GitHub Actions"
SSH_DIR="/home/$APP_USER/.ssh"
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "$SSH_DIR"
if ! grep -qs github-actions-deploy "$SSH_DIR/authorized_keys"; then
  ssh-keygen -t ed25519 -N "" -C github-actions-deploy -f /root/campusmarket-deploy-key -q
  # The key can only run the deploy command: no shell, no port forwarding.
  echo "command=\"/usr/local/bin/campusmarket-deploy\",restrict $(cat /root/campusmarket-deploy-key.pub)" >> "$SSH_DIR/authorized_keys"
  chown "$APP_USER:$APP_USER" "$SSH_DIR/authorized_keys"
  chmod 600 "$SSH_DIR/authorized_keys"
fi

HOST_IP="$(hostname -I | awk '{print $1}')"
cat <<EOF

==========================================================================
Server ready. Next steps (deploy/vultr/README.md, from Step 4):

1. Put the production settings in $APP_DIR/campusmarket-backend/.env

2. GitHub -> repo Settings -> Secrets and variables -> Actions:
   Secret VULTR_HOST      = $HOST_IP
   Secret VULTR_HOST_KEY  = $API_DOMAIN,$HOST_IP $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)
   Secret VULTR_SSH_KEY   = the private key below
EOF
if [ -f /root/campusmarket-deploy-key ]; then
  echo
  cat /root/campusmarket-deploy-key
  echo
  echo "   Once it's saved in GitHub, delete it here:  rm /root/campusmarket-deploy-key*"
else
  echo "   (Already created on an earlier run. If you lost it, see README.md -> Troubleshooting.)"
fi
echo "=========================================================================="
