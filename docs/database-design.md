# Database design

MongoDB via Prisma. Identifiers are ObjectIds. Timestamps are UTC. This document is the logical model. Phase 1 creates only the auth tables in section 3. Remaining models are added in the phase that first uses them, matching the relationships below.

## 1. Design rules

- One role per `User`. Profiles, vehicles, and KYC are separate documents referenced by id.
- Booking status is never updated without a `BookingStatusHistory` row in the same transaction.
- Customer payment, platform fee, driver earning, and settlement are separate records. `paymentStatus = PAID` does not settle the driver or the fee.
- Amounts are integers in minor currency units (paise if INR). Currency is stored on the money record. No floating-point money.
- A financial amount that has been committed is not edited. A correction is a new ledger row.
- Fee and fare rules are snapshotted onto the booking when the price is fixed. Later setting changes do not rewrite history.
- Soft delete (`deletedAt`) for people, profiles, vehicles, coupons, and payment methods. Ledger, payment transactions, platform fees, settlements, status history, and audit logs are retained and are not deleted.
- `createdAt` and `updatedAt` on mutable models. Append-only models have `createdAt` only.
- Indexes listed on each model are required, not optional.

Prisma relation fields are references. Cascading deletes are not used for business data.

Geospatial match uses a MongoDB `2dsphere` index on `DriverLocation.position`. That query stays inside the driver-location repository because Prisma does not model the index directly. The field is still declared so the document shape is stable.

Production requires a MongoDB replica set so multi-document transactions work.

## 2. Enums

```
Role                    ADMIN | DRIVER | USER
AccountStatus           PENDING_VERIFICATION | ACTIVE | INACTIVE | SUSPENDED | BLOCKED
OtpPurpose              REGISTER | PASSWORD_RESET
KycStatus               PENDING | UNDER_REVIEW | APPROVED | REJECTED
DocumentType            DRIVING_LICENSE | IDENTITY_PROOF | ADDRESS_PROOF | POLICE_VERIFICATION | PROFILE_PHOTO
VehicleType             HATCHBACK | SEDAN | SUV | MUV | LUXURY | OTHER
Transmission            MANUAL | AUTOMATIC
FuelType                PETROL | DIESEL | CNG | ELECTRIC | HYBRID
BookingType             IMMEDIATE | SCHEDULED
PaymentMode             PLATFORM | DIRECT
BookingStatus           PENDING | SEARCHING_DRIVER | DRIVER_ASSIGNED | DRIVER_ACCEPTED
                        | DRIVER_ON_THE_WAY | DRIVER_ARRIVED | TRIP_STARTED | TRIP_COMPLETED
                        | CANCELLED_BY_USER | CANCELLED_BY_DRIVER | CANCELLED_BY_ADMIN | EXPIRED
CustomerPaymentStatus   UNPAID | PENDING | PAID | FAILED | REFUNDED
PlatformFeeStatus       NOT_APPLICABLE | ACCRUED | COLLECTED_AT_SOURCE | OUTSTANDING | SETTLED | WAIVED
DriverEarningStatus     PENDING | PAYABLE | PAID | REVERSED
LedgerDirection         DEBIT | CREDIT
LedgerAccount           DRIVER_EARNING | DRIVER_PAYABLE | PLATFORM_FEE_RECEIVABLE | PLATFORM_CASH | ADJUSTMENT
SettlementDirection     PLATFORM_TO_DRIVER | DRIVER_TO_PLATFORM
SettlementStatus        PENDING | PROCESSING | COMPLETED | FAILED
PaymentTxnType          CUSTOMER_PLATFORM_PAYMENT | CUSTOMER_DIRECT_PAYMENT | REFUND
                        | DRIVER_FEE_PAYMENT | DRIVER_PAYOUT
DirectConfirmStatus     AWAITING_DRIVER | DRIVER_CONFIRMED | DISPUTED
OnlineStatus            OFFLINE | ONLINE
NotificationChannel     PUSH | IN_APP
ComplaintStatus         OPEN | IN_REVIEW | RESOLVED | REJECTED
CouponType              FLAT | PERCENT
AuditActorType          ADMIN | SYSTEM
```

`CANCELLED_BY_ADMIN` is included so admin booking management has a legal terminal state. Confirm in approval.

## 3. Phase 1 models

### User

Account root for all roles.

| Field | Notes |
| --- | --- |
| id | ObjectId |
| role | Role |
| phone | E.164, unique |
| email | optional, unique when present |
| passwordHash | never returned by the API |
| status | AccountStatus |
| phoneVerifiedAt | null until OTP succeeds |
| lastLoginAt | optional |
| createdAt, updatedAt, deletedAt | soft delete hides the account; bookings keep the id |

Indexes: unique `phone`, unique `email`, `role + status`, `deletedAt`.

### RefreshToken

| Field | Notes |
| --- | --- |
| id | |
| userId | reference User |
| tokenHash | unique |
| expiresAt | |
| revokedAt | null while usable |
| replacedByTokenId | set on rotation |
| createdAt | |
| userAgent, ip | optional, for session list |

Indexes: unique `tokenHash`, `userId + revokedAt`.

### OtpChallenge

| Field | Notes |
| --- | --- |
| id | |
| userId | nullable for pre-registration; phone is always set |
| phone | |
| purpose | OtpPurpose |
| codeHash | |
| expiresAt | |
| attemptCount | |
| consumedAt | |
| createdAt | |

Indexes: `phone + purpose + consumedAt`, `expiresAt`.

Plaintext codes are not stored.

## 4. People and vehicles (Phase 2)

### UserProfile

`userId` unique. `fullName`, `avatarUrl`, `city`, `emergencyContactName`, `emergencyContactPhone`. One profile per USER account.

### DriverProfile

`userId` unique. `fullName`, `avatarUrl`, `dateOfBirth`, `city`, `kycStatus`, `kycReviewedAt`, `kycReviewedBy`, `kycRejectionReason`, `onlineStatus`, `approvedAt`.

A driver cannot go `ONLINE` unless `kycStatus = APPROVED` and `User.status = ACTIVE`.

Indexes: `kycStatus`, `onlineStatus`, `city`.

### DriverDocument

`driverProfileId`, `type`, `fileKey` (object storage key, not a public URL in the database), `mimeType`, `status` (uploaded / accepted / rejected), `reviewedBy`, `reviewNote`, `createdAt`.

Sensitive. List endpoints return metadata. File bytes are served through an authorized download route.

Index: `driverProfileId + type`.

### DriverPaymentMethod

`driverProfileId`, `methodType` (`UPI` | `BANK`), `upiId`, `accountHolderName`, `bankName`, `accountNumberLast4`, `ifsc`, encrypted full account number if a payout file needs it, `qrFileKey`, `isDefault`, `deletedAt`.

Returned only to the owning driver and to admin settlement/KYC. Not copied onto bookings.

### CustomerVehicle

`userId`, `registrationNumber` (unique per non-deleted row), `vehicleType`, `brand`, `model`, `transmission`, `fuelType`, `color`, `rcFileKey` optional, `deletedAt`.

The driver is never stored as owner. Bookings reference `vehicleId` and snapshot display fields so a later vehicle edit does not rewrite trip history.

Indexes: `userId + deletedAt`, unique `registrationNumber` with partial filter excluding deleted rows (enforced in the repository if Prisma partial indexes are awkward; duplicate check is mandatory).

## 5. Booking and trip (Phases 3–4)

### Booking

| Field | Notes |
| --- | --- |
| id | |
| referenceCode | unique human code |
| userId, vehicleId | |
| driverId | null until assigned |
| type | IMMEDIATE or SCHEDULED |
| status | BookingStatus |
| pickupAddress, pickupLat, pickupLng | |
| destinationAddress, destinationLat, destinationLng | |
| scheduledAt | required for SCHEDULED |
| requirementsNote | optional |
| fareAmountMinor, currency | snapshotted price of the driving service |
| pricingSnapshot | JSON: rule ids and inputs used; immutable after price is fixed |
| paymentMode | PLATFORM or DIRECT, chosen by the customer within admin-enabled modes |
| customerPaymentStatus | CustomerPaymentStatus |
| platformFeeStatus | PlatformFeeStatus |
| searchExpiresAt | |
| cancelledAt, cancellationReason, cancelledBy | |
| createdAt, updatedAt | |

Indexes: `userId + createdAt`, `driverId + status`, `status + scheduledAt`, `status + searchExpiresAt`, unique `referenceCode`, `createdAt`.

`fareAmountMinor` stays null until the pricing rule is approved and a quote exists. Phase 3 may create bookings only after that rule is confirmed. Do not invent a fare formula in code.

### BookingStatusHistory

Append-only. `bookingId`, `fromStatus`, `toStatus`, `actorUserId` nullable for system, `actorRole`, `reason`, `createdAt`.

Index: `bookingId + createdAt`.

### BookingOffer

One row per driver who was offered a booking while status is `DRIVER_ASSIGNED` or during search.

`bookingId`, `driverId`, `status` (`PENDING` | `ACCEPTED` | `REJECTED` | `EXPIRED`), `expiresAt`, `respondedAt`.

Index: unique `bookingId + driverId`, `driverId + status`.

This supports reject-and-search-again without overloading the booking status.

### Trip

Created when the booking first reaches `DRIVER_ACCEPTED`. One trip per booking.

`bookingId` unique, `userId`, `driverId`, `vehicleId`, pickup and destination copies, `startOtpHash`, `otpVerifiedAt`, `startedAt`, `endedAt`, `startLat`, `startLng`, `endLat`, `endLng`, `distanceMeters`, `durationSeconds`, `fareAmountMinor`, `currency`.

OTP plaintext is shown once to the user and stored only as a hash.

### DriverLocation

`driverId` unique, `position` GeoJSON Point, `accuracyMeters`, `recordedAt`, `bookingId` nullable.

Writes accepted only when the driver is online. Sharing with a customer is allowed only when `bookingId` is an active trip for that customer (`DRIVER_ON_THE_WAY`, `DRIVER_ARRIVED`, `TRIP_STARTED`).

Index: `2dsphere` on `position`, `recordedAt`.

## 6. Financial model (Phase 5)

All amounts are minor units. Records below are created by services, never by clients posting raw totals.

Identity, before tax and coupons (tax and coupons are open questions):

```
fareAmount = driverEarning + platformFee
```

Example: fare 100000 paise, platform fee 10000, driver earning 90000.

### Payment

One customer-payment record per booking.

`bookingId` unique, `payerUserId`, `payee` (`PLATFORM` or `DRIVER`), `mode`, `amountMinor`, `currency`, `status` (CustomerPaymentStatus), `directConfirmStatus`, `confirmedByDriverAt`, `customerReference` (UTR or note, optional), `createdAt`, `updatedAt`.

`PAID` here means the customer side is recorded. For `DIRECT`, that happens when the driver confirms receipt. For `PLATFORM`, it happens when the gateway capture is recorded.

### PaymentTransaction

Append-only money event.

`paymentId`, `bookingId`, `type` (PaymentTxnType), `amountMinor`, `currency`, `provider` nullable, `providerRef` nullable, `status`, `createdAt`.

No update of `amountMinor`. Status may move `PENDING → SUCCESS | FAILED` for gateway attempts. A later reversal is a new row of type `REFUND`.

Index: `bookingId + createdAt`, `providerRef`.

### PlatformFee

One per booking once the fee is known.

`bookingId` unique, `driverId`, `ruleId`, `amountMinor`, `currency`, `status` (PlatformFeeStatus), `createdAt`, `updatedAt`.

- `PLATFORM` payment captured: status `COLLECTED_AT_SOURCE` (platform already kept the fee).
- `DIRECT` payment confirmed: status `OUTSTANDING` (driver owes the platform).
- Driver pays that balance: status `SETTLED` via a settlement, not by editing the amount.

Index: `driverId + status`, `status`.

### DriverEarning

One per completed (or financially recognized) booking.

`bookingId` unique, `driverId`, `amountMinor`, `currency`, `status` (DriverEarningStatus).

- `DIRECT`: earning is recognized as already received by the driver (`PAID` to the driver outside the platform) and is not added to platform cash.
- `PLATFORM`: status `PAYABLE` until a payout settlement completes, then `PAID`.

### DriverLedger

Materialized balances per driver. Source of truth for history is `WalletTransaction`. Balances are updated only in the same transaction as the new ledger rows and must be rebuildable by summing those rows.

`driverId` unique.

| Balance | Meaning |
| --- | --- |
| payableMinor | Platform owes the driver (online trips not yet paid out) |
| outstandingFeeMinor | Driver owes the platform (direct-payment fees not yet settled) |
| lifetimeEarningMinor | Sum of recognized earnings |
| lifetimeDirectReceivedMinor | Cash/UPI the driver confirmed on direct trips |
| lifetimePlatformFeeMinor | Sum of fees |

These are not a single signed wallet. Mixing "cash the driver already holds" with "cash the platform holds" would hide outstanding fees.

### WalletTransaction

Append-only.

`driverId`, `bookingId` nullable, `settlementId` nullable, `account` (LedgerAccount), `direction`, `amountMinor`, `currency`, `balanceAfterMinor` for that account, `memo`, `createdAt`.

Index: `driverId + createdAt`, `bookingId`.

Allowed pairs are listed in `payment-flow.md`. Services reject any other combination.

### DriverSettlement

A payout or a fee collection. Not an edit of past fees.

`driverId`, `direction`, `amountMinor`, `currency`, `status`, `providerRef` or manual reference, `createdBy`, `createdAt`, `completedAt`.

Index: `driverId + createdAt`, `status`.

Settlement allocation rows (`settlementId`, `platformFeeId` or `driverEarningId`, `amountMinor`) record which fees or earnings the settlement closed. Partial settlement is allowed. Amounts on the original fee and earning rows do not change; their status changes only when the allocated sum covers them.

## 7. Trust, support, and admin (Phase 6)

### Rating

`bookingId`, `fromUserId`, `toUserId`, `score` 1–5, `createdAt`. Unique `bookingId + fromUserId`. One rating per completed booking per rater. Drivers rating customers is an open question; the table allows both directions.

### Review

`ratingId` unique, `body`, `createdAt`. Optional text attached to a rating.

### Complaint

`bookingId` optional, `raisedByUserId`, `againstUserId` optional, `subject`, `body`, `status`, `resolvedBy`, `resolutionNote`, `createdAt`, `updatedAt`.

Index: `status + createdAt`, `raisedByUserId`.

### Notification

`userId`, `channel`, `title`, `body`, `dataJson`, `readAt`, `sentAt`, `createdAt`.

Index: `userId + createdAt`, `userId + readAt`.

### Coupon

`code` unique, `type`, `value`, `maxDiscountMinor`, `minFareMinor`, `startsAt`, `endsAt`, `usageLimit`, `isActive`, `deletedAt`.

Redemption is a separate append-only `CouponRedemption` (`couponId`, `bookingId`, `userId`, `amountMinor`) so usage counts stay auditable. Effect on the platform fee is an open question; do not split the discount silently.

### CommissionRule

Configurable platform fee. `name`, `feeType` (`FLAT` | `PERCENT` | `PERCENT_PLUS_FLAT`), `flatMinor`, `percentBps` (basis points), `minFeeMinor`, `maxFeeMinor`, `isActive`, `effectiveFrom`, `effectiveTo`.

The active rule is copied into `Booking.pricingSnapshot` and `PlatformFee.ruleId` at calculation time.

### CancellationPolicy

`name`, `appliesToStatus` (the booking status at cancel time), `actorRole`, `feeType`, `flatMinor` or `percentBps`, `isActive`, `effectiveFrom`.

Which windows are free remains an open business question. The table is the configuration point so values are not hardcoded.

### SystemSetting

`key` unique, `valueJson`, `updatedBy`, `updatedAt`.

Keys reserved for admin settings: enabled payment modes, minimum fare, max schedule lead time, minimum schedule notice, driver search radius and timeout, offer timeout, outstanding fee limit, location update intervals, settlement netting flag. Reading a missing key is an error for the use case that depends on it.

### AuditLog

Append-only. `actorUserId`, `action`, `entityType`, `entityId`, `summary`, `beforeJson`, `afterJson`, `requestId`, `ip`, `createdAt`.

`beforeJson` / `afterJson` must omit secrets, document bytes, and full bank account numbers.

Index: `entityType + entityId`, `actorUserId + createdAt`, `createdAt`.

## 8. What is deliberately not stored

- Derived report totals as source data. Reports aggregate ledger, payments, and fees.
- A boolean `isSettled` on Booking. Settlement is the fee status plus the earning status.
- Driver ownership of a vehicle.
- Plaintext passwords, OTPs, refresh tokens, or trip-start OTPs.
- Public URLs of KYC files.

## 9. Phase mapping

| Phase | Models created or first used |
| --- | --- |
| 1 | User, RefreshToken, OtpChallenge |
| 2 | UserProfile, DriverProfile, DriverDocument, DriverPaymentMethod, CustomerVehicle |
| 3 | Booking, BookingStatusHistory, BookingOffer, SystemSetting keys for search |
| 4 | Trip, DriverLocation, Notification |
| 5 | Payment, PaymentTransaction, PlatformFee, DriverEarning, DriverLedger, WalletTransaction, DriverSettlement, CommissionRule |
| 6 | Rating, Review, Complaint, Coupon, CouponRedemption, CancellationPolicy, AuditLog, remaining settings |
