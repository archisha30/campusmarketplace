#!/usr/bin/env bash
# Installed as /usr/local/bin/campusmarket-deploy by setup.sh. GitHub Actions' deploy key can run
# only this. It pulls main, then hands over to release.sh from the freshly pulled code, so deploy
# changes in release.sh take effect without re-running setup.sh.
set -euo pipefail

exec 9>/run/lock/campusmarket-deploy.lock
flock -n 9 || { echo "Another deploy is already running."; exit 1; }

cd /srv/campusmarket
git fetch --quiet origin main
git reset --hard --quiet origin/main  # leaves the untracked .env alone
exec bash deploy/vultr/release.sh
