# Authentify

A hands-on tour of user authentication — built from scratch in TypeScript + Node.js to understand how each method actually works under the hood.

No NestJS. No magic. Just Express and the raw mechanics.

---

## Modules

| # | Method | Port | Status |
|---|--------|------|--------|
| 01 | Basic Authentication | 3001 | 🔨 In progress |
| 02 | Session-Based Authentication | 3002 | ⏳ Pending |
| 03 | Token-Based Authentication | 3003 | ⏳ Pending |
| 04 | JWT Authentication | 3004 | ⏳ Pending |
| 05 | OAuth — mock IdP + GitHub | 3050/3051 | ⏳ Pending |
| 06 | SSO — Single Sign-On | 3060/3061/3062 | ⏳ Pending |

---

## Protected Resource

Every module restricts access to the same **Books API**:

| Endpoint | Who can access |
|----------|---------------|
| `GET /books` | Any authenticated user |
| `GET /books/:id` | Any authenticated user |
| `POST /books` | Admin only |
| `DELETE /books/:id` | Admin only |

Test users (consistent across all modules):

| Username | Password | Role |
|----------|----------|------|
| alice | password123 | user |
| bob | letmein | user |
| admin | admin-secret | admin |

---

## Setup

```bash
npm install
```

Run a module:

```bash
npm run 01:basic-auth
npm run 02:session-auth
# etc.
```

Copy `.env.example` to `.env` before running modules 04+:

```bash
cp .env.example .env
```

---

## Structure

```text
authentify/
├── shared/
│   ├── types.ts          # shared interfaces
│   └── data/
│       ├── users.ts      # mock user store
│       └── books.ts      # mock protected resource
├── 01-basic-auth/
├── 02-session-auth/
├── 03-token-auth/
├── 04-jwt-auth/
├── 05-oauth/
└── 06-sso/
```

Each module is self-contained with its own `server.ts`, `middleware/`, and `README.md` explaining the theory, HTTP flow, weaknesses, and curl test commands.
