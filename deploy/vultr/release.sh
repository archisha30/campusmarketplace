#!/usr/bin/env bash
# Second half of a deploy, run by campusmarket-deploy (update.sh) after it pulls main.
# Same steps as Render's start command: install, migrate, then start the new code.
# THE REPO IS PUBLIC, and so is this output in the Actions log: never print settings or logs here.
set -euo pipefail

cd /srv/campusmarket/campusmarket-backend
echo "Deploying $(git rev-parse --short HEAD): $(git log -1 --format=%s)"

uv sync --frozen --no-dev --python 3.13 --quiet
# Migrations run before the restart, so the live database always matches the live code.
# If one fails, the old code keeps running.
uv run --no-dev alembic upgrade head
sudo /usr/bin/systemctl restart campusmarket

for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:8000/health; then
    echo "Live and healthy."
    exit 0
  fi
  sleep 2
done
echo "The API didn't pass /health within 60 seconds. On the server: journalctl -u campusmarket -n 100"
exit 1
