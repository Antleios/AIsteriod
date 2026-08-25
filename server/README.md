# AIsteriod Backend

## Local Setup

```bash
npm ci
cp .env.example .env
npx prisma migrate deploy
npm run db:seed
npm run dev
```

The API listens on `http://127.0.0.1:3001` by default. SQLite stores game
data, users, and revocable login sessions. Do not commit `.env` or database
files.

## Create an Account

Public registration is intentionally disabled. Create accounts from the
backend command line:

```bash
NEW_USER_PASSWORD='replace-with-a-long-password' \
  npm run user:create -- \
  --username patient.one \
  --display-name '患者一' \
  --role PATIENT
```

Allowed roles are `PATIENT`, `DOCTOR`, and `ADMIN`. Usernames are normalized to
lowercase and may contain letters, numbers, `.`, `_`, and `-`.

## Authentication API

- `POST /api/auth/login` accepts `{ "username": "...", "password": "..." }`.
- `GET /api/auth/me` returns the authenticated user.
- `POST /api/auth/logout` revokes the current session.
- `POST /api/auth/logout-all` revokes every session for the current user.

Login sets an opaque `HttpOnly` cookie. The database stores only its SHA-256
hash, while passwords use Argon2id. Production cookies require HTTPS. Browser
clients must send credentials with API requests, and their exact origin must
appear in `ALLOWED_ORIGINS`.

## Training Sessions

Training data, attempts, interaction events, and doctor summaries use a
separate durable session model. See [SESSION_README.md](SESSION_README.md) for
the lifecycle, authenticated API flow, question snapshots, provider settings,
and privacy boundaries.

## Validation

```bash
npm test
```

The test command creates a temporary SQLite database, applies every migration,
seeds the game banks, verifies authentication behavior and existing public game
endpoints, then removes the temporary database.
