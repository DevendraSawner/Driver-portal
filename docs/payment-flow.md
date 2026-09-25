# Payment flow

This document fixes the accounting shape. It does not choose the fee percentage, tax, gateway, netting, or refund math. Those are open in `business-rules.md`. Phase 5 does not start until those answers exist.

`customerPaymentStatus = PAID` means the customer side of that booking is recorded. It does not mean platform fees are collected and it does not mean the driver has been settled.

Amounts are integers in minor units. The requirements example in rupees:

| Item | Rupees | Minor units (INR paise) |
| --- | --- | --- |
| Fare | 1,000 | 100000 |
| Platform fee | 100 | 10000 |
| Driver earning | 900 | 90000 |

Invariant once a booking is priced:

```
fareAmountMinor = driverEarningMinor + platformFeeMinor
```

Tax or coupons, if later approved, are extra lines with their own ledger accounts. They are not folded into this identity until that approval changes the formula.

The priced numbers and the `CommissionRule` id are copied onto the booking. Changing the rule later does not change this booking.

## 1. Two rails

```
PLATFORM
  Customer → payment gateway → platform
  Platform keeps the fee
  Platform later pays the driver the earning

DIRECT
  Customer → driver (cash, UPI, or bank)
  Driver confirms the fare was received
  Driver owes the platform fee
  Platform does not hold the fare
```

The payee is stored on `Payment`. For platform mode the payee is `PLATFORM`. For direct mode the payee is `DRIVER`.

## 2. When money is recognized

Proposed sequence, pending approval of gateway and of "confirm must match fare":

1. Booking stores `paymentMode` and the fare snapshot. Customer payment status is `UNPAID`. No ledger rows yet.
2. Trip reaches `TRIP_COMPLETED`.
3. The payment service posts the recognition rows for that mode. It is the only writer.

If a gateway must authorize before the trip, that authorization is a `PaymentTransaction` in `PENDING` and does not accrue the fee or the earning. Capture at completion is a new success state on that attempt, or a follow-up transaction, and only then do ledger rows post. The provider is unnamed until one is chosen.

## 3. Platform payment

On successful capture of the fare:

| Record | Result |
| --- | --- |
| Payment.status | PAID |
| Payment.payee | PLATFORM |
| PaymentTransaction | CUSTOMER_PLATFORM_PAYMENT, amount = fare, provider ref stored |
| PlatformFee | amount = fee, status COLLECTED_AT_SOURCE |
| DriverEarning | amount = earning, status PAYABLE |
| DriverLedger.payableMinor | increases by the earning |
| DriverLedger.lifetimeEarningMinor | increases by the earning |
| DriverLedger.lifetimePlatformFeeMinor | increases by the fee |
| DriverLedger.outstandingFeeMinor | unchanged |

Ledger rows in the same transaction:

| Account | Direction | Amount | Why |
| --- | --- | --- | --- |
| PLATFORM_CASH | CREDIT | fare | Platform received the fare |
| PLATFORM_FEE_RECEIVABLE | CREDIT | fee | Fee retained at source. Balance for this fee is already satisfied |
| DRIVER_PAYABLE | CREDIT | earning | Platform owes the driver |
| DRIVER_EARNING | CREDIT | earning | Earning recognized |

`PLATFORM_FEE_RECEIVABLE` credited at source is marked settled by the fee status `COLLECTED_AT_SOURCE`, so it does not increase `outstandingFeeMinor`. The ledger still shows the fee existed.

Driver payout later:

| Record | Result |
| --- | --- |
| DriverSettlement | direction PLATFORM_TO_DRIVER, amount = earning (or a partial) |
| PaymentTransaction | DRIVER_PAYOUT |
| DriverEarning.status | PAID when allocations cover it |
| DriverLedger.payableMinor | decreases by the payout |

| Account | Direction | Amount |
| --- | --- | --- |
| DRIVER_PAYABLE | DEBIT | payout |
| PLATFORM_CASH | DEBIT | payout |

## 4. Direct payment

1. Customer may call `POST /payments/direct` with an optional reference (UTR or note). This sets `Payment.mode = DIRECT`, payee `DRIVER`, status still not `PAID`, `directConfirmStatus = AWAITING_DRIVER`. It does not create the fee as collected.
2. Driver calls `POST /payments/:id/confirm` only for a booking assigned to them in `TRIP_COMPLETED`.
3. The service checks the confirmed amount against `fareAmountMinor`. The proposed rule is equality. A mismatch returns 422 and opens no ledger rows. A dispute is a complaint, not a handwritten balance.

On match:

| Record | Result |
| --- | --- |
| Payment.status | PAID |
| Payment.payee | DRIVER |
| Payment.directConfirmStatus | DRIVER_CONFIRMED |
| Payment.customerReference | stored if the customer sent one |
| PaymentTransaction | CUSTOMER_DIRECT_PAYMENT, amount = fare, no gateway provider |
| PlatformFee | amount = fee, status OUTSTANDING |
| DriverEarning | amount = earning, status PAID (already in the driver's hands) |
| DriverLedger.outstandingFeeMinor | increases by the fee |
| DriverLedger.payableMinor | unchanged |
| DriverLedger.lifetimeEarningMinor | increases by the earning |
| DriverLedger.lifetimeDirectReceivedMinor | increases by the fare |
| DriverLedger.lifetimePlatformFeeMinor | increases by the fee |

Ledger rows:

| Account | Direction | Amount | Why |
| --- | --- | --- | --- |
| DRIVER_EARNING | CREDIT | earning | Earning recognized |
| PLATFORM_FEE_RECEIVABLE | DEBIT | fee | Driver owes this fee. Outstanding increases |

No `PLATFORM_CASH` row. The platform did not receive the fare.

The driver received the full fare outside the platform. That fact is `lifetimeDirectReceivedMinor` and the direct payment transaction. It is not a platform wallet credit of ₹1,000.

Driver pays the outstanding fee later:

| Record | Result |
| --- | --- |
| DriverSettlement | direction DRIVER_TO_PLATFORM |
| PaymentTransaction | DRIVER_FEE_PAYMENT, reference stored |
| PlatformFee.status | SETTLED when allocations cover the fee |
| DriverLedger.outstandingFeeMinor | decreases by the amount allocated |

| Account | Direction | Amount |
| --- | --- | --- |
| PLATFORM_FEE_RECEIVABLE | CREDIT | amount paid |
| PLATFORM_CASH | CREDIT | amount paid |

Partial payment is allowed. Status stays `OUTSTANDING` until the allocated sum equals the fee. Over-payment is rejected.

## 5. Worked example

Fare ₹1,000, fee ₹100, earning ₹900.

**Platform.** Customer pays ₹1,000 to the platform. Fee is collected at source. Driver payable balance increases ₹900. Outstanding fees do not change. After payout, payable decreases ₹900 and platform cash decreases ₹900. Platform has kept ₹100.

**Direct.** Driver confirms ₹1,000 received. Outstanding fees increase ₹100. Driver payable does not increase. Earning ₹900 is recognized as already received. When the driver pays ₹100, outstanding returns to its previous level and platform cash increases ₹100.

Reports can then show booking value, platform fees, collected fees (`COLLECTED_AT_SOURCE` + `SETTLED`), outstanding fees, driver earnings, direct payment totals, and online payment totals by summing these rows. Reports do not use a single `PAID` flag.

## 6. Prohibited writes

- Editing `amountMinor` on `Payment`, `PaymentTransaction`, `PlatformFee`, `DriverEarning`, or `WalletTransaction`
- Deleting ledger rows
- Setting a wallet balance without a new `WalletTransaction`
- Marking a direct fee `COLLECTED_AT_SOURCE`
- Marking a booking financially complete because `Payment.status = PAID`
- Admin forms that type a replacement fare onto a completed booking
- Exposing UPI, bank account, or QR on booking reads for the customer. Direct payment confirmation records who was paid (`payee = DRIVER`) and the reference, not the driver's saved payout instrument

An admin mistake is corrected with an `ADJUSTMENT` ledger row, a reason, and an audit log. The original row stays.

## 7. Outstanding limit

`outstandingFeeMinor` is compared with system setting `driverOutstandingLimitMinor` when the driver tries to go online or when search builds an offer.

The action taken at the limit is not decided (block offers, block online, or report only). Until it is decided, the balance is still calculated and shown, and no automatic suspension runs.

## 8. Refunds

Not specified. No refund ledger path will be coded until the cancellation refund rule is approved. The reserved transaction type `REFUND` is a reversal row, not an edit. A refund of a platform capture would debit `PLATFORM_CASH` and reverse the earning and fee postings with new rows. Direct payments are not gateway-refunded by the platform; a direct dispute is operational.

## 9. Phase gate

Phase 5 implementation needs answers to business-rule questions 4 through 12. Before those answers, code may add the collections and the transition guards that refuse payment recognition, and must not invent a percentage, a gateway, or a netting rule.
