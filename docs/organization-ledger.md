# Organization ERP billing ledger

This ledger records amounts schools owe and pay for ERP services. It does not process payments. It has a separate MongoDB collection, `organizationledgers`, and does not read/write student Fee records or change school activation, login, or default passwords.

## Access and endpoints

All paths below start with `/api/organizations/:organizationId/ledger` and require a Bearer token.

| Method | Suffix | Access | Purpose |
| --- | --- | --- | --- |
| GET | (none) | Super admin or own-school admin | School totals |
| GET | `/charges` | Same | Service periods, charge balances and statuses |
| GET | `/payments` | Same | Recorded payments and available credit |
| GET | `/entries` | Same | Full history, including allocations/reversals |
| POST | `/charges` | Super admin | Record an agreed service charge |
| POST | `/payments` | Super admin | Record payment; optionally allocate it immediately |
| POST | `/payments/:paymentId/allocations` | Super admin | Assign available credit to charges |
| POST | `/entries/:entryId/reverse` | Super admin | Correct an entry through a recorded reversal |

School admins cannot create, allocate, reverse, edit, or delete ledger records. Teachers, parents, and students cannot read or manage them. Every referenced payment/charge must belong to the URL's organization.

## Amounts, dates, and balances

Currency is INR in this version. All `amount_paise` values are positive JSON integers: ₹15,000 = `1500000`. Money is not stored in floating-point rupees. Dates are calendar dates in `YYYY-MM-DD` format. Service period endpoints are inclusive, with no fixed length or price. Overlapping service periods are allowed for separately agreed services. A due date is optional.

Summary fields:

- `total_charged_paise`: sum of unreversed charges.
- `total_received_paise`: sum of unreversed payments.
- `outstanding_paise`: charge balances after allocations.
- `available_credit_paise`: payments not yet allocated.
- `net_balance_paise`: total charged minus total received (negative = net credit).

Outstanding charges and available credit can coexist until the super admin allocates the credit. Payments are not silently allocated by date. A payment can cover multiple charges, and a charge can be paid in installments.

Charge responses include `allocated_paise`, `remaining_paise`, `status` (`unpaid`, `partial`, `paid`, `reversed`) and an independent `overdue` flag. Partially paid charges can be overdue. Payment responses include `allocated_paise`, `available_paise`, and `status` (`recorded` or `reversed`). Overdue uses today's UTC calendar date.

## Example flow

POST `/charges`:

```json
{
  "amount_paise": 1500000,
  "date": "2026-04-01",
  "description": "ERP access April–June",
  "service_from": "2026-04-01",
  "service_to": "2026-06-30",
  "due_date": "2026-04-10"
}
```

POST `/payments` to record ₹6,000 against the returned charge ID:

```json
{
  "amount_paise": 600000,
  "date": "2026-04-05",
  "payment_method": "Bank transfer",
  "reference": "BANK-123",
  "description": "First installment",
  "allocations": [{ "charge_id": "<charge-id>", "amount_paise": 600000 }]
}
```

The remaining charge balance is `900000` paise (₹9,000). Omit `allocations` entirely to record advance credit. Allocate it later with POST `/payments/:paymentId/allocations`:

```json
{ "allocations": [{ "charge_id": "<charge-id>", "amount_paise": 400000 }] }
```

Writes return HTTP 201 with `{ entries: [...newEntries], summary: {...} }`. Every entry has `id`, `type`, `date`, `created_by`, and server-generated `created_at`. For a payment created with allocations, the first returned entry is the payment and the following entries are allocations. No payment gateway is invoked.

## Corrections and retries

Posted entries are not edited/deleted. POST `/entries/:entryId/reverse` with a nonblank `reason` and optional `date`. For a wrong charge/payment with allocations, reverse those allocations first, then reverse the charge/payment, then record its replacement. Reversing an allocation restores both payment credit and the charge balance. Reversal is an accounting correction, not execution or tracking of a bank refund. Reversals cannot be reversed again. Original entries remain in history.

Use a unique `Idempotency-Key` header (1–128 characters) for each logical POST. Retrying with the same key, identical URL, and identical JSON body returns the original entries plus the current summary, with `replayed: true`. Reusing the key for different content returns 409. Without this header, repeated submissions create separate records. Keys are scoped to a school. Avoid relying on bank reference uniqueness: references are descriptive and may be reused.

The ledger uses one MongoDB document per school with optimistic concurrency. Balance checks and all entries for one operation are committed atomically without requiring a replica set. Concurrent conflicting writes return 409; reload and retry using the same idempotency key. Invalid allocations never partially record the accompanying payment.

This initial implementation supports up to 5,000 entries per school (including allocations and reversals). It rejects further writes with 409 rather than truncating history. Archival/migration to a transactional multi-document model will be needed before a school reaches this limit.

## Listing and errors

Lists return `{ organization_id, currency, page, limit, total, data }`, ordered by entry date descending, then ID descending. `page` defaults to 1 and `limit` to 50 (maximum 100). Optional `from`/`to` filter entry dates inclusively; `service_from`/`service_to` filter service-period overlap and therefore select only charge records. Filtering lists does not change all-time totals or compute a historical balance as of that date.

Errors: 400 invalid data/over-allocation, 401 missing authentication, 403 forbidden role or school, 404 missing school or referenced entry, 409 concurrency/reversal/idempotency/capacity conflict. Descriptive text is limited to 500 characters. At most 100 allocations are accepted per request.

Swagger includes all eight operations under **Organization Ledger** at `/api/docs`. Frontend files are unchanged.
