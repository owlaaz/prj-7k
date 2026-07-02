# Guild Boss Planner

Guild Boss Planner is a full-stack web app for planning and sharing guild boss attack allocations.

- Frontend: React + Vite + TypeScript
- Backend: Express + TypeScript
- Database: Prisma + libSQL/SQLite

## Repository layout

- `frontend/`: UI, planner logic, and browser-side optimizer integration
- `backend/`: API for saving and loading plans
- `DEPLOYMENT.md`: production deployment guide (Kong + static hosting + backend API)

## Requirements

- Node.js 20+
- npm 10+

## Quick start (local development)

### 1. Install dependencies

```bash
cd backend
npm ci

cd ../frontend
npm ci
```

### 2. Configure environment variables

Backend:

```bash
cd backend
cp .env.example .env
```

Frontend:

```bash
cd frontend
cp .env.example .env.local
```

Important:

- Do not commit real `.env` files.
- Keep secrets only in local env files or your deployment platform's secret manager.
- Commit only sanitized examples like `.env.example`.

### 3. Run backend

```bash
cd backend
npm run dev
```

Default API URL: `http://localhost:3001`

### 4. Run frontend

```bash
cd frontend
npm run dev
```

Default app URL: `http://localhost:5173`

## Build and run production

### Backend

```bash
cd backend
npm run build
npm start
```

### Frontend

```bash
cd frontend
npm run build
npm run preview
```

## Test

### Backend tests

```bash
cd backend
npm test
```

### Frontend tests

```bash
cd frontend
npm test
```

## Database notes

The backend uses Prisma and a libSQL-compatible database URL.

Typical local setup uses SQLite:

```dotenv
DATABASE_URL=file:./dev.db
```

If you update the schema, run migrations from `backend/`:

```bash
npx prisma migrate dev
```

For production migration runs:

```bash
npx prisma migrate deploy
```

## Deployment

See `DEPLOYMENT.md` for full production instructions, including:

- API prefix and reverse proxy path handling
- CORS and trusted proxy IP allowlist setup
- static frontend hosting under a base path
- backend service health checks
