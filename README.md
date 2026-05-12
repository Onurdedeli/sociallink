# Sociallink

Open-source influencer collaboration & attribution platform.
Brands publish campaigns with CPC / CPM / commission rates; creators claim
unique tracking codes and share them on Instagram, TikTok, YouTube, Twitter,
Telegram, WhatsApp or Facebook. Sociallink measures clicks and sales and
attributes commissions automatically.

## Quick start

```bash
npm install
npm run db:push     # build SQLite schema
npm run db:seed     # CPM rates + demo accounts
npm run dev         # http://localhost:3000
```

Demo accounts (password `demo1234`):

- `brand@demo.io` — brand
- `creator@demo.io` — influencer

## How tracking works

1. **Brand** creates a campaign with a target URL, CPC/CPM/commission rates.
2. **Creator** joins the campaign and gets a short code (e.g. `Q8Bf2BEB`).
3. Creator shares `https://<host>/r/Q8Bf2BEB?p=tiktok` on their channel.
4. Every hit on `/r/[code]` logs the click (hashed IP, UA, referrer, platform,
   country) and 302-redirects to the target URL with `?sl=<code>` appended.
5. Brand's store calls `POST /api/track/conversion` after a successful order:

   ```bash
   curl -X POST https://<host>/api/track/conversion \
     -H 'content-type: application/json' \
     -d '{"code":"Q8Bf2BEB","orderId":"ORDER_123","amountCents":12900}'
   ```

   Commission is computed automatically from the campaign's `commissionBps`.

## CPM reference API (open data)

```
GET /api/cpm
GET /api/cpm?platform=tiktok
GET /api/cpm?platform=youtube&tier=mid
```

Returns CPM and CPC reference rates per platform and audience tier (nano,
micro, mid, macro, mega). Free, CORS-enabled JSON. See `src/db/seed.ts` for
the dataset.

## Stack

- Next.js 15 (App Router) + React 19, TypeScript, Tailwind
- Drizzle ORM + SQLite (swap to Neon Postgres via Vercel Marketplace for prod)
- Cookie-based auth (jose JWT, bcryptjs)

## Deploy

Drop in to Vercel; replace the SQLite driver with Neon Postgres + Drizzle for
serverless. Set `AUTH_SECRET` and `APP_URL` env vars.
