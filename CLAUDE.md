# CLAUDE.md — Authentify

## Project Purpose

A hands-on, self-taught deep dive into user authentication methods. Built in TypeScript + Node.js (Express). No NestJS — everything is explicit so the mechanics are visible.

## Coaching Style

- This is a **learning project**. Do NOT write implementation code unless explicitly asked.
- Scaffold new modules with TODO comments. Let the user implement.
- When the user writes code, review it and point out bugs/improvements — don't silently fix.
- Complete non-auth boilerplate (CRUD helpers, route wiring) when asked — the auth logic is the learning focus.
- Use the `PROGRESS.md` file to track where we are and what's next.

## Stack

- **Runtime:** Node.js + TypeScript
- **HTTP:** Express (no NestJS, no Fastify)
- **Auth libs:** `bcryptjs`, `jsonwebtoken`, `express-session`, `uuid`
- **No database** — mock in-memory data in `shared/data/`
- **Package manager:** npm

## Project Structure

```
shared/               <- mock data + shared types (not auth-specific)
01-basic-auth/        <- port 3001
02-session-auth/      <- port 3002
03-token-auth/        <- port 3003
04-jwt-auth/          <- port 3004
05-oauth/             <- port 3050 (IdP), 3051 (client)
06-sso/               <- port 3060 (IdP), 3061, 3062 (apps)
```

Each module has: `server.ts`, `middleware/`, `requests.http`, `README.md`

## Run Commands

```bash
npm run 01:basic-auth
npm run 02:session-auth
npm run 03:token-auth
npm run 04:jwt-auth
npm run 05:oauth-idp
npm run 05:oauth-client
```

## Test Users

| Username | Password       | Role  |
|----------|---------------|-------|
| alice    | password123   | user  |
| bob      | letmein       | user  |
| admin    | admin-secret  | admin |

## Key Decisions

- Each module is **self-contained** — same Books API endpoints across all, different auth middleware
- `shared/types.ts` augments `Express.Request` with `req.user` — all middleware sets this
- `requests.http` files use the REST Client VS Code extension (by Humao)
- Base64 credentials in `.http` files are **hardcoded** — `{{$base64}}` is not a valid REST Client variable
- OAuth module 05: build mock IdP first, then wire up real GitHub OAuth
