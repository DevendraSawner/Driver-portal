# Architecture

Driver-on-Demand platform. A customer owns the vehicle. The platform supplies a professional driver who travels to the customer and drives the customer's car.

This is not a taxi, cab, or vehicle-rental marketplace. The driver never becomes the vehicle owner. Fare is the price of the driving service.

Status: design for approval. No application code until this document set is approved.

## 1. System shape

Three independently runnable applications in one repository. They share API contracts documented in `api-design.md`. They do not share a runtime, database connection, or deployed process.

```
/
├── api/                 Node.js + Express + TypeScript + Prisma
├── ui/                  React + Vite + TypeScript admin portal
├── app/                 React Native + TypeScript (USER and DRIVER)
└── docs/                Architecture and contracts
```

Each app has its own `package.json`, TypeScript config, environment file, and start command. A root `package.json` may only hold convenience scripts. It must not be required to build or run any single app.

No shared package in Phase 1. Contracts live in these docs. A shared types package is allowed later only if duplication across the three apps becomes a real defect.

## 2. Applications

### 2.1 `/api` — Backend

Responsibilities:

- Authentication and role-based authorization
- Booking state machine
- Trip lifecycle, OTP, and location ingestion
- Payments, platform fees, ledger, and settlements
- Admin operations, reports, and audit logs
- Notification dispatch (FCM added in the phase that introduces notifications)

Layering inside each module:

```
routes → controllers → services → repositories
```

| Layer | Does | Does not |
| --- | --- | --- |
| Route | Mount path, attach middleware | Business decisions |
| Controller | Read request, call service, shape HTTP response | Business rules, Prisma calls |
| Validation | Zod schema, run before the controller | Business rules |
| Service | Use cases, state transitions, financial invariants, authorization of the action | HTTP, raw query construction scattered across callers |
| Repository | Prisma and MongoDB access for one aggregate | Cross-aggregate business rules |

Cross-cutting code lives in `src/middleware`, `src/lib`, and `src/utils`. A util is added only when two modules need the same function.

Proposed layout:

```
api/
├── prisma/schema.prisma
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── routes/
│   ├── middlewares/
│   ├── validators/
│   ├── utils/
│   ├── constants/
│   ├── types/
│   ├── lib/
│   └── modules/          route mounting
├── .env.example
└── package.json
```

Request flow stays routes → controllers → services → repositories. Validators stay out of services. Admin routes mount under `/api/v1/admin` from `routes/` and `modules/`. Later features add files in these folders instead of a second business layer.

### 2.2 `/ui` — Admin web portal

React, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router, Axios.

Responsibilities: operational screens for ADMIN only. No customer or driver self-service in this app.

```
ui/src/
├── app/                   router, providers, query client
├── components/            tables, badges, modals, forms, layout
├── features/              one folder per nav area (users, drivers, bookings, ...)
├── lib/                   axios instance, auth storage
└── styles/
```

The UI calls only the documented admin and auth endpoints. Server state lives in TanStack Query. Tokens live in memory plus a refresh flow; access tokens are not written into localStorage if a safer cookie approach is chosen at implementation time. Phase 1 will pick one approach and document it in the API doc before coding auth.

### 2.3 `/app` — Mobile

React Native, TypeScript, React Navigation, TanStack Query, Axios.

One binary, two roles. After login the navigator switches on `role`:

- `USER` → customer stack
- `DRIVER` → driver stack
- `ADMIN` → rejected with a message to use the web portal

Location and FCM are integrated in the phases that need them. The app does not send location when the driver is offline.

## 3. Request lifecycle

```
Client
  → CORS + security headers + rate limit
  → request logger (redacted)
  → auth middleware (JWT) when the route requires it
  → role middleware
  → Zod validation
  → controller
  → service
  → repository
  → consistent JSON response
```

Errors thrown as `AppError` (status, code, message, optional field errors) are rendered by one error middleware. Unexpected errors become a generic 500. Stack traces are logged on the server and never returned in production.

### Response contract

Success:

```json
{
  "success": true,
  "message": "Booking created",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "phone", "message": "Invalid phone" }]
}
```

`errors` is an empty array when there is no field detail. List endpoints put items and pagination inside `data` (see `api-design.md`).

## 4. Authentication and sessions

JWT access token plus rotating refresh token.

- Access token: short-lived (proposed 15 minutes), claims `sub`, `role`, `status`.
- Refresh token: longer-lived (proposed 30 days), stored only as a hash, rotated on every refresh, revoked on logout.
- Password hashing: bcrypt or argon2. Plaintext passwords are never stored or logged.
- OTP: stored only as a hash, with purpose, expiry, and attempt counter. Plaintext OTP is never logged.
- Account status `BLOCKED`, `SUSPENDED`, and `INACTIVE` fail authentication and reject refresh.
- Role is taken from the token and re-checked against the database on privileged writes if the account status or role may have changed. Phase 1 implements a status check on each authenticated request so a suspended account cannot keep using an unexpired access token.

Roles: `ADMIN`, `DRIVER`, `USER`. One account has one role. A person who both hires drivers and works as a driver needs two accounts. This is a proposal; see open questions in `business-rules.md`.

Authorization is resource-scoped. A user can read and mutate only their vehicles, bookings, and payments. A driver can act only on bookings assigned to them. Admin routes require `ADMIN`. Services enforce ownership even when the route already checked the role, to prevent IDOR.

## 5. Booking and money boundaries

Booking status changes go through one transition service. Controllers never assign `status` from client input. Allowed edges are defined in `booking-state-machine.md`.

Money changes go through the payment and ledger services. No endpoint accepts a new fare, fee, or wallet balance as a free-form admin edit. Corrections are new ledger entries with an audit record. Details are in `payment-flow.md`.

`paymentStatus = PAID` means the customer payment for that booking was recorded. It does not mean the driver was settled or that the platform fee was collected.

## 6. Data and time

- MongoDB via Prisma.
- Identifiers are MongoDB ObjectIds, serialized as strings in JSON.
- Timestamps are UTC in the database. Day.js is the only date library. API inputs that represent a local booking time include an IANA timezone; storage is UTC.
- Soft delete (`deletedAt`) for users, driver profiles, vehicles, and other records that must remain for bookings and finance. Financial ledger rows are not soft-deleted.
- `createdAt` and `updatedAt` on every persistent model that is updated. Append-only financial documents still have `createdAt`.

Prisma on MongoDB does not express `2dsphere` queries cleanly. Driver coordinates are stored in a dedicated location document, and nearby search uses a MongoDB command through a single repository method. That method is the only place geospatial query syntax lives.

Multi-document updates that must succeed or fail together (status change + history row, payment + ledger lines) use a Prisma interactive transaction. Production MongoDB must be a replica set so transactions work.

## 7. Async and realtime (later phases)

Not part of Phase 1.

| Concern | Choice |
| --- | --- |
| Push notifications | Firebase Cloud Messaging, server send only |
| Live driver location and booking status | Socket.IO introduced when trip tracking is built |
| Cache / presence | Redis introduced when location fan-out or rate-limit storage needs it |

Until those phases, booking status is read with normal REST polling from the clients. The API surface should not depend on a socket being connected for correctness. Sockets are a delivery optimization.

Location policy:

- Driver offline: server rejects location updates.
- Driver online and waiting: coarse updates for matching only.
- Driver on the way, arrived, or in an active trip: finer updates, visible to that booking's customer.
- Intervals are system settings, not constants in the client.

## 8. Configuration and secrets

Environment variables only. `.env.example` lists keys with empty values. `.env` is gitignored.

Required from the first running API:

- `NODE_ENV`, `PORT`, `DATABASE_URL`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `CORS_ORIGINS`

Payment gateway keys, FCM credentials, and Redis URL are added in the phase that uses them. Missing required variables abort process startup.

Business numbers (platform fee, cancellation fee, outstanding limit, search timeout, minimum fare) live in `SystemSetting` and `CommissionRule`, not in code. Phase 1 only needs the auth secrets. Settings management arrives with the admin phase. Until a setting exists, the service that needs it refuses to run that use case rather than substituting a hardcoded price.

## 9. Security baseline

- Helmet-style secure headers, CORS allowlist, body size limit
- Rate limits on register, login, OTP, and password reset
- Validation on every write body and on query params used for filters
- Authz on every non-public route
- Ownership checks in services
- Audit log for admin mutations (who, action, entity, entity id, before/after summary, timestamp, request id)
- Request logs omit passwords, OTPs, tokens, document file contents, and full bank/UPI values
- Driver bank, UPI, and QR are returned only on the driver's own payment-method endpoints and on admin KYC/settlement screens. They are not embedded in public driver profiles or unrelated booking payloads.

## 10. Observability

Structured JSON logs with a request id. Health endpoint `GET /api/v1/health` checks database connectivity. It does not require auth and returns no secrets.

## 11. Delivery phases

Each phase inspects the repo, implements only its scope, typechecks, lints, tests what exists, and updates these docs if a contract changes.

| Phase | Scope |
| --- | --- |
| 1 | Monorepo shells, env, Prisma, health, auth, roles, account status |
| 2 | User profile, driver profile, KYC documents, customer vehicles |
| 3 | Bookings, state machine, driver online/offline, accept/reject |
| 4 | Trip OTP, completion, location, FCM notifications |
| 5 | Payments, direct payment, platform fee, ledger, settlement |
| 6 | Admin portal screens, reports, complaints, ratings, coupons |
| 7 | Hardening, tests, performance, production config |

Phase 1 schema is only the accounts and sessions needed for auth. Later models are specified in `database-design.md` so the relationships stay stable, and they are migrated in the phase that first uses them.

## 12. Out of scope until explicitly requested

- Taxi dispatch, vehicle rental, or driver-owned cars
- In-app chat beyond a controlled contact channel defined later
- Automatic fraud labels or automatic suspension from a metric alone
- A specific payment gateway implementation before the provider is chosen
- Rewriting historical financial rows when settings change
