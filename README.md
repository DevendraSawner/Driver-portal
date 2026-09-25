# Driver Platform

Driver-on-Demand monorepo. Customers book a professional driver for their own car. Phase 1 contains the three app shells, environment setup, Prisma, health check, and authentication.

## Layout

```
api/     Express + TypeScript + Prisma + MongoDB
ui/      React admin portal
app/     React Native customer and driver app
docs/    Architecture and contracts
```

Each app has its own `package.json` and runs on its own. The root `package.json` only forwards commands.

## Requirements

- Node.js 22+
- pnpm 10+
- MongoDB for the API

## Setup

```bash
pnpm install
cp api/.env.example api/.env
cp ui/.env.example ui/.env
```

Fill `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `OTP_HASH_SECRET` in `api/.env` with values of at least 32 characters. Point `DATABASE_URL` at MongoDB.

```bash
pnpm --filter @driver-platform/api prisma:generate
pnpm --filter @driver-platform/api prisma:push
```

Create the first admin. Public registration cannot create an admin.

```bash
ADMIN_PHONE=+919800000000 ADMIN_PASSWORD='ChangeMe123' ADMIN_FULL_NAME='Platform Admin' \
  pnpm --filter @driver-platform/api seed:admin
```

## Run

```bash
pnpm dev:api    # http://localhost:4000
pnpm dev:ui     # http://localhost:5173
pnpm start:app  # Metro bundler
```

Health: `GET http://localhost:4000/api/v1/health`

The admin portal signs in with the seeded admin phone and password. Customers and drivers register in the mobile app. A new account stays `PENDING_VERIFICATION` until `POST /api/v1/auth/otp/verify`.

`OTP_DELIVERY=console` prints the one-time code in the API process output so local registration can be completed. That mode is refused when `NODE_ENV=production`. Do not use it as a production SMS provider.

The mobile API base URL is `app/src/config.ts`. Android emulators often need `http://10.0.2.2:4000` instead of localhost.

Native `android/` and `ios/` projects are not committed. Generate them from `app/` with the React Native CLI when you are ready to run on a device or emulator. Metro and TypeScript do not need those folders.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## Phase 1 API

- `POST /api/v1/auth/register` for `USER` and `DRIVER`
- `POST /api/v1/auth/otp/verify`
- `POST /api/v1/auth/otp/resend`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `GET /api/v1/users/me`
- `GET /api/v1/admin/me` (admin role)
- `GET /api/v1/health`

The web client keeps the refresh token in an httpOnly cookie. The mobile client sends `X-Client-Type: mobile` and receives the refresh token in the JSON body.

Bookings, payments, and driver matching are not in this phase.
