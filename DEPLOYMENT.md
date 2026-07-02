# Guild Boss Planner — Production Deployment Guide

**Target URLs**
- Frontend: `https://owlaaz.dev/7k-planner`
- Backend API: `https://api.owlaaz.dev/7k-planner`
- Reverse proxy: Kong Gateway (you manage the Kong config)

---

## Architecture Overview

```
Browser
  │
  ├─ https://owlaaz.dev/7k-planner/*        → Kong → static file server (nginx / CDN)
  │                                              serving frontend/dist/
  │
  └─ https://api.owlaaz.dev/7k-planner/*   → Kong → Node.js API  :3001
                                                (only Kong's IP is trusted)
```

The optimizer runs **client-side** (GLPK WASM in the browser). The backend only handles plan persistence.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20 LTS or newer |
| npm | 10+ |
| SQLite | bundled via libSQL — no separate install needed |

---

## 1. Clone & Install

```bash
git clone <repo-url> prj-7k
cd prj-7k

# Install backend dependencies
cd backend && npm ci

# Install frontend dependencies
cd ../frontend && npm ci
```

---

## 2. Backend

### 2.1 Environment variables

Copy the example and edit:

```bash
cd backend
cp .env.example .env
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | no | `3001` | TCP port the Express server listens on |
| `ALLOWED_ORIGINS` | **yes** | `http://localhost:5173` | Comma-separated list of browser origins allowed by CORS. Set to `https://owlaaz.dev` |
| `TRUSTED_PROXIES` | **yes** | *(empty — allow all)* | Comma-separated list of Kong data-plane IPs. Only these IPs can reach the API. |
| `API_PREFIX` | depends | *(empty)* | See §2.2 below |
| `DATABASE_URL` | **yes** | `file:./dev.db` | libSQL connection URL. Use a persisted path in production. |

**Minimal production `.env`:**

```dotenv
PORT=3001
ALLOWED_ORIGINS=https://owlaaz.dev
TRUSTED_PROXIES=<kong-internal-ip>
API_PREFIX=
DATABASE_URL=file:/data/guild-boss-planner.db
```

### 2.2 `API_PREFIX` vs Kong `strip_path`

Kong's Route setting `strip_path` controls whether the path prefix is removed before forwarding:

| Kong `strip_path` | Browser → Kong | Kong → backend | `API_PREFIX` to set |
|---|---|---|---|
| `true` *(default)* | `api.owlaaz.dev/7k-planner/api/plannings` | `localhost:3001/api/plannings` | *(leave empty)* |
| `false` | `api.owlaaz.dev/7k-planner/api/plannings` | `localhost:3001/7k-planner/api/plannings` | `/7k-planner` |

### 2.3 Database setup

The database is SQLite (via libSQL). Run migrations once before first start:

```bash
cd backend
npx prisma migrate deploy
```

This creates the `plannings` table in the file pointed to by `DATABASE_URL`.

> **Persistence:** Make sure the directory containing the `.db` file is on a persistent volume when running in a container.

### 2.4 Build & start

```bash
cd backend
npm run build       # compiles TypeScript → dist/
npm start           # runs node dist/index.js
```

### 2.5 Health check

```
GET https://api.owlaaz.dev/7k-planner/health
→ {"status":"ok"}
```

Use this as your Kong upstream health check endpoint.

### 2.6 Running with a process manager (recommended)

**PM2:**

```bash
npm install -g pm2
pm2 start dist/index.js --name guild-boss-api
pm2 save
pm2 startup
```

**systemd unit** (`/etc/systemd/system/guild-boss-api.service`):

```ini
[Unit]
Description=Guild Boss Planner API
After=network.target

[Service]
WorkingDirectory=/srv/prj-7k/backend
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
EnvironmentFile=/srv/prj-7k/backend/.env
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now guild-boss-api
```

---

## 3. Frontend

### 3.1 Environment variables

Copy the example and edit **before building**:

```bash
cd frontend
cp .env.example .env.production.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_BASE_PATH` | **yes** | Sub-path the app is served under. Set to `/7k-planner` |
| `VITE_API_BASE` | **yes** | Full base URL of the API as the **browser** sees it (through Kong). |

**Production values:**

```dotenv
VITE_BASE_PATH=/7k-planner
VITE_API_BASE=https://api.owlaaz.dev/7k-planner/api/plannings
```

> `VITE_API_TARGET` is only used by the Vite dev-server proxy and is ignored by production builds.

### 3.2 Build

```bash
cd frontend
npm run build
```

Output is in `frontend/dist/`. All asset paths are prefixed with `/7k-planner/` automatically.

### 3.3 Serve the static build

**nginx** — add inside your `server {}` block:

```nginx
location /7k-planner/ {
    alias /srv/prj-7k/frontend/dist/;
    try_files $uri $uri/ /7k-planner/index.html;
}
```

The `try_files` fallback to `index.html` is required for React Router's client-side navigation (deep links and page refreshes must return the app shell).

**Alternatively,** serve `dist/` via any static CDN (Cloudflare Pages, S3 + CloudFront, etc.) with the base path `/7k-planner`.

---

## 4. Kong Gateway Configuration

Below are representative Kong Admin API `deck` / `kic` settings. Adjust service host/port to your network.

### 4.1 Frontend service & route

```yaml
services:
  - name: guild-boss-frontend
    url: http://nginx-internal:80    # wherever nginx/CDN is
routes:
  - name: guild-boss-frontend-route
    service: guild-boss-frontend
    hosts: [owlaaz.dev]
    paths: [/7k-planner]
    strip_path: false                # nginx handles the full path
```

### 4.2 Backend API service & route

```yaml
services:
  - name: guild-boss-api
    url: http://<backend-internal-ip>:3001
routes:
  - name: guild-boss-api-route
    service: guild-boss-api
    hosts: [api.owlaaz.dev]
    paths: [/7k-planner]
    strip_path: true                 # Kong removes /7k-planner → backend sees /api/plannings
                                     # Set strip_path: false and API_PREFIX=/7k-planner if preferred
```

### 4.3 Recommended Kong plugins

```yaml
plugins:
  # HTTPS redirect — only needed if Kong handles TLS termination
  - name: request-termination
    # (configure via cert manager / ACME instead)

  # CORS is handled by the Express app itself — do not add Kong's cors plugin
  # (double-CORS headers break browsers)
```

---

## 5. Security checklist

| Item | Status |
|------|--------|
| TLS on both `owlaaz.dev` and `api.owlaaz.dev` | Kong / cert-manager |
| `TRUSTED_PROXIES` set to Kong's internal IP(s) | ✅ backend middleware |
| `ALLOWED_ORIGINS=https://owlaaz.dev` | ✅ env var |
| HTTP security headers (Helmet) | ✅ always on |
| Rate limiting: 200 req/min/IP | ✅ always on |
| Database file on persistent volume | manual |
| Backend port **not** exposed publicly (only through Kong) | networking / firewall |

---

## 6. Local development

No `.env` files needed — all defaults work out of the box.

```bash
# Terminal 1 — backend
cd backend
npm run dev        # ts-node hot-reload on :3001

# Terminal 2 — frontend
cd frontend
npm run dev        # Vite dev server on :5173, proxies /api → :3001
```

App: `http://localhost:5173`  
API: `http://localhost:3001/api/plannings`

### Run tests

```bash
# Backend integration tests (uses the same SQLite dev.db)
cd backend && npm test

# Frontend unit tests
cd frontend && npm test
```

---

## 7. Upgrading

```bash
cd backend
npx prisma migrate deploy   # apply any new migrations
npm run build
pm2 restart guild-boss-api  # or systemctl restart guild-boss-api
```

No frontend state is stored server-side beyond the `plannings` table — no cache invalidation needed.
