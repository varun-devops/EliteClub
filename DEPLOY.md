# Deploying Elite Club — Hostinger VPS + GoDaddy domain

Your setup: **code on GitHub**, **hosting on Hostinger VPS**, **domain from GoDaddy**.

This app needs a real Node.js process (it has API routes, middleware, and server-side
database calls), which is why it runs on a **VPS** and not Hostinger's shared web hosting.

Do this once. After that, **every `git push` to `main` deploys automatically.**

---

## 1. Create the VPS

Hostinger **hPanel** → **VPS** → choose a plan → **Ubuntu 24.04** (plain, no panel).

- **Minimum: 2 GB RAM.** The Next.js build needs it. On a 1 GB plan the build gets killed
  halfway — if you are stuck on 1 GB, add swap (step 2b).
- Choose the datacenter closest to your users (India).
- Save the **root password** and the **IP address** it gives you.

---

## 2. Prepare the server

SSH in from your Windows machine (PowerShell):

```powershell
ssh root@YOUR_VPS_IP
```

### 2a. Install what's needed

```bash
apt update && apt upgrade -y
apt install -y curl git nginx ufw

# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# PM2 — keeps the app running and restarts it after a reboot
npm install -g pm2

node -v && npm -v    # confirm
```

### 2b. Add swap (skip if you have 4 GB+ RAM)

Insurance against the build being killed for running out of memory:

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -h    # should now show 2Gi swap
```

### 2c. Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

---

## 3. Get the code onto the server

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/varun-devops/EliteClub.git elite-club
cd elite-club
```

> Private repo? Create a deploy key first:
> `ssh-keygen -t ed25519 -C "vps" -f ~/.ssh/id_ed25519 -N ""` then `cat ~/.ssh/id_ed25519.pub`
> and add it under **GitHub → repo → Settings → Deploy keys** (read access is enough).
> Then clone with the SSH URL: `git@github.com:varun-devops/EliteClub.git`

---

## 4. Create `.env.local` on the server

**This file is not in GitHub** — it holds your secrets, so you create it once by hand.

```bash
nano /var/www/elite-club/.env.local
```

Paste this, with your real values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset

NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_TJ3QvQ4tL6nJBm
RAZORPAY_KEY_SECRET=81kXJ3YViuDtq0tF6dWuyWdI
RAZORPAY_WEBHOOK_SECRET=make-up-a-long-random-string-here

ADMIN_PASSWORD=your-strong-admin-password
ADMIN_SESSION_SECRET=a-long-random-string
```

Save with `Ctrl+O`, `Enter`, `Ctrl+X`. Then lock it down:

```bash
chmod 600 /var/www/elite-club/.env.local
```

> Generate the random strings with:
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## 5. First deploy

```bash
cd /var/www/elite-club
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

It installs, builds, and starts the app under PM2. It should end with
`✓ Deployed — app is responding`.

Make PM2 survive reboots:

```bash
pm2 startup systemd     # prints a command — copy and run it
pm2 save
```

Check it's alive: `curl -I http://127.0.0.1:3000` → `HTTP/1.1 200 OK`

---

## 6. Point your GoDaddy domain at the VPS

GoDaddy → **My Products** → your domain → **DNS** → **Manage Zones**.

Delete any existing `A` record for `@` and `www`, then add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `YOUR_VPS_IP` | 600 |
| A | `www` | `YOUR_VPS_IP` | 600 |

Do **not** use GoDaddy's "Forwarding" — it breaks HTTPS and the payment callbacks.

DNS takes 15 minutes to a few hours. Check progress:

```bash
nslookup YOUR-DOMAIN.com
```

Wait until it returns your VPS IP before doing step 7 — Certbot will fail otherwise.

---

## 7. Nginx + free SSL

```bash
cd /var/www/elite-club
cp deploy/nginx.conf.example /etc/nginx/sites-available/elite-club
nano /etc/nginx/sites-available/elite-club     # replace YOUR-DOMAIN.com (2 places)

ln -sf /etc/nginx/sites-available/elite-club /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Now the free SSL certificate:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d YOUR-DOMAIN.com -d www.YOUR-DOMAIN.com
```

Choose **redirect HTTP to HTTPS** when asked. Renewal is automatic.

Open `https://YOUR-DOMAIN.com` — the site should be live with a padlock.

---

## 8. Auto-deploy from GitHub

So that pushing to `main` updates the live site by itself.

### 8a. Make a key for GitHub to use

On the **VPS**:

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
cat ~/.ssh/github_deploy          # ← copy ALL of this, including BEGIN/END lines
```

### 8b. Add the secrets to GitHub

GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret name | Value |
|-------------|-------|
| `VPS_HOST` | your VPS IP |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | the whole private key you just copied |
| `VPS_PORT` | `22` (optional) |

### 8c. Test it

```powershell
git commit --allow-empty -m "test auto-deploy"
git push
```

Watch it run under the repo's **Actions** tab. Green tick = the live site is updated.

---

## 9. Point Razorpay at your live domain

Now that you have a real HTTPS URL, webhooks can reach you.

Razorpay Dashboard → **Settings** → **Webhooks** → **Add New Webhook**:

| Field | Value |
|-------|-------|
| Webhook URL | `https://YOUR-DOMAIN.com/api/payment/webhook` |
| Secret | the exact `RAZORPAY_WEBHOOK_SECRET` from your `.env.local` |
| Active Events | `payment.captured`, `payment.failed` |

Then do a full test payment on the live site with UPI `success@razorpay`, and confirm the
record flips to **Paid** in `/admin`.

> Test and Live mode have **separate** webhooks. When you switch to `rzp_live_` keys,
> add the webhook again in Live mode.

---

## Everyday commands

| What | Command (on the VPS) |
|------|----------------------|
| Deploy manually | `cd /var/www/elite-club && ./scripts/deploy.sh` |
| See logs | `pm2 logs elite-club` |
| Restart | `pm2 reload elite-club` |
| Status | `pm2 status` |
| Change a secret | `nano .env.local` then `pm2 reload elite-club --update-env` |
| Nginx logs | `tail -f /var/log/nginx/error.log` |

**After editing `.env.local` you must reload PM2** — the app only reads it at startup.

---

## When something breaks

**502 Bad Gateway** — the Node app is down. `pm2 status`, then `pm2 logs elite-club`.

**Build killed / "JavaScript heap out of memory"** — not enough RAM. Add swap (step 2b) or
move to a bigger plan.

**Site loads but forms fail** — `.env.local` is missing or wrong on the server. Check
`cat /var/www/elite-club/.env.local`, then `pm2 reload elite-club --update-env`.

**Payments say "not enabled"** — the Razorpay keys aren't reaching the app. Same fix as above.

**Webhook shows failed in the Razorpay dashboard** — the secret in `.env.local` must match
the one typed into Razorpay *character for character*.

**Certbot fails** — DNS hasn't propagated. `nslookup YOUR-DOMAIN.com` must return your VPS IP
first.

**Admin login won't stick** — the `X-Forwarded-Proto` header is missing, so the Secure cookie
is dropped. Make sure you're using the provided Nginx config and are on `https://`.
