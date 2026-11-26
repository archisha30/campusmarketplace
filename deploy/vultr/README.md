# Backend on Vultr

Runs the API on a Vultr server instead of Render. The frontend stays on Vercel, and the database
and files stay on Supabase, so the server holds no data: it can always be rebuilt from this repo.

```
student -> Vercel (/api/* rewrite in vercel.json) -> Caddy on Vultr (HTTPS) -> uvicorn on 127.0.0.1:8000
```

Pushing to `main` deploys automatically through `.github/workflows/deploy-vultr.yml`: GitHub
connects over SSH, and the server pulls `main`, installs, runs migrations, restarts and checks
`/health`. Watch it in the repo's **Actions** tab.

| File | What it is |
|---|---|
| `setup.sh` | One-time server setup (packages, firewall, Caddy, uv, the app user, deploy key) |
| `update.sh` | Installed as `campusmarket-deploy`: pulls `main`, then runs `release.sh` |
| `release.sh` | Install, migrate, restart, health check |
| `campusmarket.service` | Keeps the API running (systemd) |
| `Caddyfile` | HTTPS and the forwarded-address setting the rate limits depend on |
| `echo_headers.py` | Setup check for that setting |

## Step 1: Create the server

Vultr -> Deploy -> Cloud Compute (Shared CPU):

- **Location:** Mumbai (the Supabase database is in `ap-south-1`, Mumbai)
- **Image:** Ubuntu 24.04 LTS x64
- **Plan:** 2 GB RAM (about $12/month)
- **SSH Keys:** add your Mac's key. No key yet? On the Mac: `ssh-keygen -t ed25519`, then paste
  the contents of `~/.ssh/id_ed25519.pub`
- Leave the rest as is and deploy. Note the server's IP address.

## Step 2: Point the API domain at it

At your domain provider's DNS settings, add an **A record**: name `api`, value the server's IP.
Check from the Mac until it shows the IP (a few minutes, sometimes longer):

```bash
dig +short api.yourdomain.com
```

No domain yet? `<ip-with-dashes>.sslip.io` (e.g. `203-0-113-7.sslip.io`) points at the IP with no
setup, and works for testing. Switch to the real domain before the mobile app (it's baked into it).

## Step 3: Run the setup

The setup files must be on GitHub first (commit and push this folder). Then, from the Mac:

```bash
ssh root@<server-ip>
curl -fsSLO https://raw.githubusercontent.com/archisha30/campusmarketplace/main/deploy/vultr/setup.sh
bash setup.sh api.yourdomain.com
```

It takes a few minutes and ends by printing three GitHub secrets. Leave that window open.

**Check the forwarded address** (the login and code limits depend on it). Still on the server:

```bash
python3 /srv/campusmarket/deploy/vultr/echo_headers.py &
sleep 1
curl -s -H "X-Forwarded-For: 203.0.113.7" https://api.yourdomain.com/
```

It must print `X-Forwarded-For: 203.0.113.7, <the server's view of your address>`: two entries, the
fake one first. Just one entry means Caddy is replacing the header. Stop there: with
`PROXY_HOPS=1`, every student would share one login/code limit and lock each other out.
(A certificate error instead means DNS isn't pointing at the server yet; wait and retry.)

## Step 4: Production settings

Render -> the service -> **Environment**: copy every variable into the server's `.env`:

```bash
nano /srv/campusmarket/campusmarket-backend/.env
```

```ini
ENVIRONMENT=production
STORAGE_BACKEND=supabase
# Vultr: only Caddy's entry in X-Forwarded-For can be trusted (Render's default is 3)
PROXY_HOPS=1

# Copied from Render, values exactly as they are there:
DATABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET_KEY=...
OTP_PEPPER=...
CORS_ORIGINS=["https://campusmarketplace-nine.vercel.app"]
ALLOWED_EMAIL_DOMAINS=[...]
OWNER_EMAILS=[...]
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_FROM=...
BREVO_API_KEY=...
GOOGLE_CLIENT_ID=...
# ...and anything else Render has, e.g. SENTRY_DSN
```

- **`DATABASE_URL` must be the production project (`kqtetojwpbbbiznlvpck`)**, as on Render.
- **`JWT_SECRET_KEY` and `OTP_PEPPER` must match Render exactly.** A different JWT key logs
  everyone out; a different pepper breaks every code already sent.
- Lists stay JSON, as on Render: `["a", "b"]`.

Then lock the file down and do the first deploy:

```bash
chown campusmarket:campusmarket /srv/campusmarket/campusmarket-backend/.env
chmod 600 /srv/campusmarket/campusmarket-backend/.env
sudo -u campusmarket campusmarket-deploy
```

It ends with `Live and healthy.` If not: `journalctl -u campusmarket -n 100`.

## Step 5: Automatic deploys

GitHub -> repo **Settings -> Secrets and variables -> Actions**:

1. **Secrets** tab: add `VULTR_HOST`, `VULTR_HOST_KEY` and `VULTR_SSH_KEY`, values as printed by
   `setup.sh` (the private key is the whole block, `-----BEGIN` to `END ...-----` lines included).
2. **Variables** tab: add `VULTR_DEPLOY` = `on`.
3. Delete the key from the server: `rm /root/campusmarket-deploy-key*`
4. **Actions** tab -> "Deploy API to Vultr" -> **Run workflow**. It should go green with `Live and healthy.`

## Step 6: Test before switching

```bash
curl https://api.yourdomain.com/health        # {"status":"ok"}
```

The site still uses Render at this point. Both servers share the same database, so anything you do
through Vultr is real: test with your own account only.

## Step 7: Switch over

In the repo, two edits, then commit and push:

1. `vercel.json`: change the `/api/:path*` rewrite's destination from
   `https://campusmarket-api-c9we.onrender.com/api/:path*` to `https://api.yourdomain.com/api/:path*`
2. `render.yaml`: `autoDeploy: true` -> `autoDeploy: false`

Also turn off auto-deploy in Render's dashboard (service -> Settings -> Auto-Deploy -> No), so a
push doesn't run migrations on both servers at once.

When Vercel finishes deploying, the site is on Vultr. Log in, open a listing, post one with a
photo, upload a PDF, log out. Nobody gets logged out by the switch (same JWT key, same domain).

**Going back:** revert the `vercel.json` change and push. Render is still there.

## Step 8: Afterwards

- **Uptime alert:** a free UptimeRobot monitor on `https://api.yourdomain.com/health`. Render
  restarted a dead service for you; here systemd restarts crashes, but a stuck server needs you.
- **After a week on Vultr:** Render -> Settings -> **Suspend** (keeps it for a quick return).
  Keep `render.yaml` in the repo for that.
- **Keep a copy of `.env`** in a password manager: it now only exists on this server.
- **Before the credits run out:** keep paying Vultr, or go back to Render.

## Everyday commands (on the server)

```bash
journalctl -u campusmarket -f              # live API logs
systemctl status campusmarket              # running? since when?
sudo -u campusmarket campusmarket-deploy   # redeploy main by hand
tail -f /var/log/caddy/campusmarket.log    # requests as Caddy sees them
df -h; free -h                             # disk and memory
```

Security updates install by themselves. Now and then: `apt update && apt upgrade -y`, and
`reboot` if it says one is required (the API comes back by itself).

## Troubleshooting

- **Deploy job can't connect:** check the three secrets; `VULTR_HOST_KEY` must be the full line
  `setup.sh` printed. Lost the private key? On the server, remove the `github-actions-deploy` line
  from `/home/campusmarket/.ssh/authorized_keys` and run `setup.sh` again for a new one.
- **Changed `setup.sh`, the Caddyfile, `update.sh` or the service file:** run
  `bash /srv/campusmarket/deploy/vultr/setup.sh api.yourdomain.com` again (only `release.sh`
  changes take effect on the next deploy by themselves).
- **Out of memory** (`journalctl` shows the API killed): resize the server in Vultr to 4 GB.
