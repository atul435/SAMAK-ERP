# EnvironIQ — deploying to Hostinger

This app is a full-stack web app: the pages (frontend) and the server logic (backend)
run together in one Node.js process. The database, logins and file storage stay on the
managed cloud backend already connected to the app.

**Important:** Hostinger *shared* / *web* hosting only serves static files and PHP, so it
cannot run this app. Use **Hostinger VPS** (or Hostinger Cloud with Node.js support),
Ubuntu image, Node.js 20 or newer.

---

## 1. Build the deployment package

On your computer (Node 20+ and `npm`/`bun` installed), from the project folder:

```bash
bash scripts/build-hostinger.sh
```

This creates `dist-hostinger.zip`. It contains:

```
.output/          the built app (server + all pages and assets)
.env.example      the settings file template
ecosystem.config.cjs  process manager config
start.sh          simple start script
```

## 2. Upload to the VPS

```bash
scp dist-hostinger.zip root@YOUR_SERVER_IP:/var/www/
ssh root@YOUR_SERVER_IP
cd /var/www && mkdir -p environiq && unzip -o dist-hostinger.zip -d environiq && cd environiq
```

## 3. Add your settings

```bash
cp .env.example .env
nano .env      # fill in the values, then Ctrl+O, Enter, Ctrl+X
```

Values needed:

| Name | Value |
| --- | --- |
| `PORT` | `3000` |
| `SUPABASE_URL` | your backend URL (same as in the project `.env`) |
| `SUPABASE_PUBLISHABLE_KEY` | your backend public key |
| `TENDER_INGEST_TOKEN` | the token the tender scraper uses |

Any other private keys you added in the app must be copied here too.

## 4. Run it

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
```

Check: `curl http://localhost:3000/auth` should return a page.

## 5. Point your domain at it

Install Nginx and put this in `/etc/nginx/sites-available/environiq`:

```nginx
server {
    listen 80;
    server_name erp.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/environiq /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
apt install -y certbot python3-certbot-nginx
certbot --nginx -d erp.yourdomain.com     # free HTTPS certificate
```

In Hostinger's DNS panel add an `A` record for `erp` pointing to the VPS IP address.

## 6. Updating later

Rebuild, upload the new zip, then:

```bash
cd /var/www/environiq && unzip -o ~/dist-hostinger.zip && pm2 restart environiq
```

## Notes

- The database, user logins and stored files remain on the managed cloud backend —
  nothing to install on the VPS for those.
- The tender scraper (`scripts/tender_scraper.py`) can run on the same VPS with a cron
  entry; point `TENDER_INGEST_URL` at `https://erp.yourdomain.com/api/public/tenders-ingest`.
- Public keys in the build are safe to expose; never put private keys in the frontend.
