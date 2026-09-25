# API design

Base path: `/api/v1`. JSON only. Timestamps are ISO-8601 UTC. Money fields are integers in minor units plus a `currency` code. Ids are strings.

Phase 1 implements section 3 and `GET /api/v1/health`. Later sections ship with their phase. Paths are reserved now so `/api`, `/ui`, and `/app` share one contract.

## 1. Conventions

Success:

```json
{ "success": true, "message": "OK", "data": {} }
```

Error:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "phone", "message": "Invalid phone number" }]
}
```

HTTP status matches the failure: 400 validation, 401 unauthenticated, 403 role or account status, 404 hidden or missing, 409 illegal transition or duplicate, 422 domain rule, 429 rate limit, 500 unexpected.

List `data`:

```json
{
  "items": [],
  "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
}
```

Query: `page` (default 1), `limit` (default 20, max 100), `sortBy`, `sortOrder` (`asc` | `desc`), `search`, plus resource filters. Unknown sort fields are rejected. Admin lists always paginate.

Auth header: `Authorization: Bearer <accessToken>`.

Refresh uses an httpOnly cookie `refreshToken` for the admin web app, and a body field `refreshToken` for the mobile app. The refresh token is never put in the JSON `data` of login for the web client. Mobile login returns both tokens because a React Native client does not share the web cookie jar. Both presentations refer to the same rotating server-side token.

Idempotency: `POST` payment and settlement calls accept `Idempotency-Key`. Reuse of the same key by the same user returns the original result.

## 2. Auth and account status

Public:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/register` | Create account. Body: `role` (`USER` or `DRIVER`), `phone`, `email?`, `password`, `fullName` |
| POST | `/auth/otp/verify` | Body: `phone`, `purpose`, `code` |
| POST | `/auth/otp/resend` | Body: `phone`, `purpose` |
| POST | `/auth/login` | Body: `phone`, `password` |
| POST | `/auth/refresh` | Rotate refresh token, issue access token |
| POST | `/auth/forgot-password` | Send reset OTP |
| POST | `/auth/reset-password` | Body: `phone`, `code`, `newPassword` |

Authenticated:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/logout` | Revoke the presented refresh token |
| POST | `/auth/logout-all` | Revoke all refresh tokens for the user |

`ADMIN` self-registration is not public. The first admin is created by a seed script that reads credentials from the environment once. Further admins are created by an existing admin (`POST /admin/admins`) in the admin phase.

Login and refresh reject `PENDING_VERIFICATION`, `INACTIVE`, `SUSPENDED`, and `BLOCKED` with 403 and a stable `errors[].code` (`ACCOUNT_NOT_VERIFIED`, `ACCOUNT_INACTIVE`, `ACCOUNT_SUSPENDED`, `ACCOUNT_BLOCKED`).

Access token claims: `sub`, `role`, `sid` (refresh session id). Expiry is short. Every authenticated request loads the user status. A status change applies without waiting for access-token expiry.

## 3. Phase 1 profile stub

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/users/me` | any authenticated | Account id, role, phone, email, status. No password hash |

Profile edits arrive in Phase 2.

## 4. Phase 2 — profiles, KYC, vehicles

USER:

| Method | Path |
| --- | --- |
| GET, PATCH | `/users/me/profile` |
| POST | `/vehicles` |
| GET | `/vehicles` |
| GET, PATCH, DELETE | `/vehicles/:id` |

`DELETE` is a soft delete. A vehicle referenced by an active booking cannot be deleted.

DRIVER:

| Method | Path |
| --- | --- |
| GET, PATCH | `/driver/profile` |
| POST | `/driver/documents` |
| GET | `/driver/documents` |
| GET | `/driver/documents/:id` |
| POST | `/driver/payment-methods` |
| GET | `/driver/payment-methods` |
| PATCH, DELETE | `/driver/payment-methods/:id` |

Document upload uses multipart. The response stores metadata only. Download `GET /driver/documents/:id/file` checks the owner or an admin.

ADMIN (also Phase 6 screens; API can land with Phase 2 so KYC is reviewable):

| Method | Path |
| --- | --- |
| GET | `/admin/drivers` |
| GET | `/admin/drivers/:id` |
| POST | `/admin/drivers/:id/kyc/review` |
| POST | `/admin/drivers/:id/approve` |
| POST | `/admin/drivers/:id/reject` |

KYC file access for admin is audited.

## 5. Phase 3 — bookings and availability

USER:

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/bookings` | Creates a booking and the first legal status. Client does not send `status` |
| GET | `/bookings` | Own bookings. Filters: `status`, date range |
| GET | `/bookings/:id` | Owner only |
| POST | `/bookings/:id/cancel` | Body: `reason`. Allowed only from states listed in the state machine |

DRIVER:

| Method | Path |
| --- | --- |
| POST | `/driver/availability` |
| GET | `/driver/requests` |
| POST | `/driver/bookings/:id/accept` |
| POST | `/driver/bookings/:id/reject` |
| GET | `/driver/bookings` |
| GET | `/driver/bookings/:id` |

`POST /driver/availability` body: `{ "online": true }`. Rejected when KYC is not approved, the account is not active, or an outstanding-fee block is in force once that setting exists.

Accept and reject operate only on an offer addressed to that driver.

## 6. Phase 4 — trip, OTP, location

| Method | Path | Role |
| --- | --- | --- |
| POST | `/driver/bookings/:id/en-route` | DRIVER |
| POST | `/driver/bookings/:id/arrived` | DRIVER |
| POST | `/driver/bookings/:id/start` | DRIVER, body `{ "otp": "1234" }` |
| POST | `/driver/bookings/:id/complete` | DRIVER |
| POST | `/driver/location` | DRIVER |
| GET | `/bookings/:id/location` | USER, only while tracking is allowed |
| GET | `/bookings/:id/trip` | USER or assigned DRIVER |
| GET | `/notifications` | authenticated |
| POST | `/notifications/:id/read` | owner |

The start endpoint never returns the OTP. The user reads the OTP from `GET /bookings/:id` while status is `DRIVER_ARRIVED`.

Location post body: `lat`, `lng`, `accuracyMeters`, `recordedAt`. The server drops updates when the driver is offline.

## 7. Phase 5 — payments and ledger

Customer and driver cannot post arbitrary amounts. Amounts are computed from the booking snapshot.

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/payments` | USER | Start a platform-gateway payment for a booking |
| POST | `/payments/direct` | USER | Declare direct payment and optional UTR. Does not mark the fee settled |
| POST | `/payments/:id/confirm` | DRIVER | Confirm direct amount received |
| GET | `/payments` | USER | Own payment history |
| GET | `/driver/wallet` | DRIVER | Materialized balances |
| GET | `/driver/ledger` | DRIVER | Paginated ledger |
| GET | `/driver/settlements` | DRIVER | Own settlements |
| POST | `/driver/settlements/pay` | DRIVER | Start a payment of outstanding platform fees |

Gateway webhooks are `POST /payments/webhooks/:provider`, authenticated by the provider signature, not by a user JWT. The provider name is added when one is chosen.

Admin:

| Method | Path |
| --- | --- |
| GET | `/admin/payments` |
| GET | `/admin/platform-fees` |
| GET | `/admin/settlements` |
| POST | `/admin/settlements` |
| GET | `/admin/reports/revenue` |
| GET | `/admin/reports/driver-earnings` |
| GET | `/admin/reports/outstanding-fees` |
| GET | `/admin/reports/direct-payments` |

`POST /admin/settlements` creates a settlement document from selected fee or earning ids. It does not accept a replacement fare or a rewritten historical transaction.

## 8. Phase 6 — admin, trust, settings

| Method | Path |
| --- | --- |
| GET | `/admin/dashboard` |
| GET, PATCH | `/admin/users`, `/admin/users/:id` |
| POST | `/admin/users/:id/suspend` |
| POST | `/admin/users/:id/block` |
| POST | `/admin/users/:id/activate` |
| GET | `/admin/bookings`, `/admin/bookings/:id` |
| POST | `/admin/bookings/:id/cancel` |
| GET | `/admin/trips` |
| GET | `/admin/drivers/live` |
| GET | `/admin/complaints`, PATCH `/admin/complaints/:id` |
| GET | `/admin/ratings` |
| GET, POST, PATCH | `/admin/coupons` |
| GET, PUT | `/admin/settings` |
| GET, PUT | `/admin/commission-rules` |
| GET, PUT | `/admin/cancellation-policies` |
| GET | `/admin/audit-logs` |

USER and DRIVER:

| Method | Path |
| --- | --- |
| POST | `/bookings/:id/rating` |
| POST | `/complaints` |
| GET | `/complaints` |

Suspend, block, activate, KYC decisions, setting changes, coupon changes, and admin cancellation write an `AuditLog`.

## 9. Ownership

| Resource | USER | DRIVER | ADMIN |
| --- | --- | --- | --- |
| Own account | read | read | read any |
| Vehicle | owner CRUD | none | read |
| Booking | creator | assigned driver, or an open offer | read, cancel |
| Trip OTP | read own booking | submit, never read | never read plaintext |
| Payment method | none | owner | KYC and settlement views |
| Wallet | none | owner | read via reports and driver detail |
| Audit log | none | none | read |

A mismatched owner gets 404 for single-resource reads so ids are not enumerable, and 403 for actions where the user knows the resource is not theirs (accepting another driver's offer).

## 10. Health

`GET /api/v1/health` returns `{ "success": true, "message": "OK", "data": { "database": "up" } }`. No auth. No dependency details beyond up or down. A database failure returns 503.
