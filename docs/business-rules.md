# Business rules

Rules in section 1 are fixed by the product definition. Rules in section 2 are the proposed defaults this design uses so the schema and API have a shape. Section 3 must be answered before any phase that would encode them. Phase 1 does not depend on section 3.

If a section 3 item is still open when its phase starts, that phase stops on the financial or policy behavior and implements only the surrounding structure that has already been approved.

## 1. Fixed rules

1. The customer owns the car. The platform sells driver service. The driver is not the vehicle owner and is not stored as one.
2. Roles are `ADMIN`, `DRIVER`, and `USER`.
3. Booking status changes only through the transition service in `booking-state-machine.md`.
4. A trip starts only after the driver submits the booking OTP and the server matches the stored hash.
5. Customer payment status and platform-fee status are different facts. `PAID` does not mean the driver was paid out and does not mean a direct-payment fee was collected.
6. Direct payment: the driver may receive cash, UPI, or bank transfer; the driver confirms the amount; the customer may store a reference; the platform fee is still calculated and becomes driver outstanding.
7. Financial history is append-only. Corrections are new entries. Amounts on posted transactions are not edited in place.
8. Personal payment details (UPI, bank, QR) are visible only on the owner's payment-method APIs and on admin KYC or settlement screens.
9. KYC documents are metadata plus a private file key. They are not public URLs.
10. Drivers are not tracked while offline. Location writes from an offline driver are rejected.
11. Metrics (direct-payment count, outstanding fees, cancellation count) are shown to admin for review. They do not by themselves mark a driver fraudulent or apply a suspension.
12. Configurable commercial values live in settings and rules, not in source code.
13. Historical bookings keep the fare, fee, and rule snapshot they were priced with.
14. Admin mutations that change account status, KYC, settings, fees, coupons, or booking state write an audit log.
15. Passwords, OTPs, tokens, and full financial identifiers are never written to logs.

## 2. Proposed defaults (approve or replace)

These are recommendations so Phase 1 and the data model can proceed. They are not yet business policy.

### Accounts

- One account has one role. A person who wants both apps uses two phone numbers.
- Phone number in E.164 is the login identifier. Email is optional.
- Registration creates `PENDING_VERIFICATION`. OTP verification sets `ACTIVE` for `USER`.
- A new `DRIVER` stays unable to go online until KYC is `APPROVED`, even if the phone is verified. Account status becomes `ACTIVE` after phone verification; online availability additionally requires KYC approval.
- `SUSPENDED` and `BLOCKED` cannot log in or refresh. Existing refresh tokens are revoked when an admin applies either status.
- `INACTIVE` is a self-serve or admin deactivation with the same login block.
- OTP length 6 digits, expiry 10 minutes, maximum 5 attempts, resend cooldown 60 seconds.
- Access token 15 minutes. Refresh token 30 days, rotated, stored hashed.
- Public registration cannot create `ADMIN`.

### Bookings

- `IMMEDIATE` bookings enter `SEARCHING_DRIVER` on create.
- `SCHEDULED` bookings enter `PENDING` and move to `SEARCHING_DRIVER` at the configured notice time before `scheduledAt`.
- A driver offer is a `BookingOffer`. The booking status `DRIVER_ASSIGNED` means one offer is outstanding. Reject or offer timeout returns the booking to `SEARCHING_DRIVER` until the search deadline, then `EXPIRED`.
- The customer may hold one in-progress booking at a time. History is unlimited.
- A driver may have one active accepted booking at a time. They may still be `ONLINE` only when they have no accepted booking, so they are not offered a second trip.
- Cancellation after `TRIP_STARTED` is not available to the user or the driver. Completion is the forward path. Admin may still cancel before completion with an audit entry (`CANCELLED_BY_ADMIN`) until trip completion; after `TRIP_COMPLETED` nobody cancels.
- Rebooking the same driver creates a new booking. It does not revive a completed one. Preference is recorded as `preferredDriverId` on create and is only an offer hint, not a guaranteed assignment.

### OTP and location

- Trip OTP is 4 digits, generated when status becomes `DRIVER_ARRIVED`, hashed at rest, readable by the booking's user, submittable by the assigned driver.
- Wrong OTP does not change status. Attempt limit is a setting (proposed 5), then the user must regenerate from the app, which invalidates the previous hash.
- Online idle location interval proposed 45 seconds. On-trip interval proposed 10 seconds. Both are settings.

### Money shape (mechanism only)

- Currency code is stored per money row. The example amounts in the requirements are rupees, so the proposed platform currency is `INR` and storage is paise.
- `fare = driverEarning + platformFee` at the moment of pricing, before any later tax decision.
- Platform mode: customer pays the platform the fare; fee status `COLLECTED_AT_SOURCE`; driver earning becomes `PAYABLE` by the platform.
- Direct mode: driver confirms receipt of the fare; fee status `OUTSTANDING`; driver earning is recognized as already in the driver's hands and is not added to platform payable cash.
- Ledger balances `payableMinor` and `outstandingFeeMinor` stay separate.

### KYC

- Required before approval: driving license, identity proof, profile photo, and at least one payout method (UPI or bank).
- Address proof and police verification are optional uploads until legal requirements say otherwise.
- Rejected KYC can be resubmitted. A new upload of the same type supersedes the previous file for review; the old metadata row is kept.

### Visibility

- Customer sees the assigned driver's name, photo, rating summary, and phone only while the booking is in an active pre-complete state. Phone is a masked relay if a relay is added later; until then the raw phone is not returned and in-app notification is the contact path. Calling the driver is an open product choice (section 3).

## 3. Open questions — answer before the phase that implements them

Do not implement these by assumption.

### Pricing (blocks the first real booking quote, Phase 3)

1. How is the driving-service fare calculated: flat quote, hourly, distance, time-and-distance, or a city rate card?
2. Who confirms the quote: system at booking time, customer-entered offer, or admin-set fare only?
3. What is the minimum booking amount, and is a quote below it rejected?

### Platform fee (blocks Phase 5)

4. Is the fee a percent, a flat amount, or percent plus flat? The sample (₹1,000 fare, ₹100 fee, ₹900 earning) fits 10% or a ₹100 flat. Which is the rule, and what are the initial numbers?
5. Is the fee calculated on the pre-coupon fare or the post-coupon fare?
6. Does any tax (GST or otherwise) exist on the fare or on the fee? If yes, who remits it, and is it inside or outside the ₹1,000 example?

### Direct and settlement (blocks Phase 5)

7. May every booking choose direct payment, or can admin disable direct payment globally or per city?
8. What happens when the driver confirms a different amount than the snapshotted fare? Proposed lean: reject the confirmation unless the amounts match. Disputes become a complaint. Confirm or replace.
9. When the driver's outstanding fees exceed the limit, what should happen: block going online, block new offers, or only warn admin? The limit number is also unset.
10. Are platform-to-driver payouts and driver-to-platform fee payments kept separate, or may a settlement net them?
11. What is the settlement cycle: on demand, daily, or weekly? Which payment rails can a driver use to pay fees?
12. Which payment gateway handles platform charges and refunds?

### Cancellation (blocks cancel fees, Phase 3 can still cancel without a fee until this is set)

13. For each status, may the user cancel, may the driver cancel, and what fee or penalty applies?
14. If a platform payment was captured and the booking is then cancelled, is the refund full, partial, or policy-driven? Refunds wait on this answer.

### Matching and schedule (blocks dispatch details, Phase 3)

15. Is driver selection nearest-available, broadcast to all in radius, or admin manual assign? Proposed lean: sequential nearest, one offer at a time.
16. Search radius, offer timeout, and overall search timeout?
17. How far ahead may a customer schedule, and how long before `scheduledAt` should search start?

### Other

18. Can the same phone hold both a USER and a DRIVER account? Default in section 2 is no.
19. Can a customer have more than one in-progress booking? Default in section 2 is no.
20. Do drivers rate customers?
21. Is in-trip voice contact required at launch, and if so is it a relay number or the driver's real number?
22. Which document types are legally mandatory in the operating city besides license and identity?

## 4. Fraud review

The admin driver detail and reports show, without an automatic guilty flag:

- Count and share of direct versus platform payments
- Outstanding fee total and age of the oldest outstanding fee
- Cancellation count by actor over a rolling 30 days
- Bookings where direct confirmation was disputed

An admin may suspend or block from that screen. The action stores a reason in the audit log. The system does not auto-apply it from a threshold unless a later approved setting says so.

## 5. Phase 1 scope check

Phase 1 needs approval of section 2 account rules (one role, phone login, token lifetimes, admin seed, status values). It does not need pricing, fees, cancellation fees, or the gateway.
