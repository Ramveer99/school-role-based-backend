const id = { type: 'string', pattern: '^[a-fA-F0-9]{24}$' };
const date = { type: 'string', format: 'date', example: '2026-04-01' };
const amount = { type: 'integer', minimum: 1, maximum: 9007199254740991, description: 'INR paise: 100 = ₹1. Supply a positive integer, not a decimal or string.', example: 1500000 };
const text = { type: 'string', maxLength: 500 };
const allocation = { type: 'object', additionalProperties: false, required: ['charge_id', 'amount_paise'], properties: { charge_id: id, amount_paise: amount } };
const allocations = { type: 'array', minItems: 1, maxItems: 100, items: allocation };
const ref = name => ({ $ref: `#/components/schemas/${name}` });
const json = schema => ({ 'application/json': { schema } });

export const ledgerSchemas = {
  LedgerSummary: {
    type: 'object', properties: Object.fromEntries([
      ['total_charged_paise', 'Sum of unreversed charges'],
      ['total_received_paise', 'Sum of unreversed payments'],
      ['outstanding_paise', 'Unallocated charge balances; may coexist with available credit'],
      ['available_credit_paise', 'Payments not yet allocated to charges'],
      ['net_balance_paise', 'Total charged minus total received; negative means net credit'],
    ].map(([key, description]) => [key, { type: 'integer', description }])),
  },
  LedgerEntry: {
    type: 'object', properties: {
      id, type: { type: 'string', enum: ['charge', 'payment', 'allocation', 'reversal'] },
      amount_paise: amount, date, description: text, service_from: date, service_to: date, due_date: date,
      payment_method: text, reference: text, charge_id: id, payment_id: id, reverses_id: id, reason: text,
      created_by: id, created_at: { type: 'string', format: 'date-time' }, reversed: { type: 'boolean' },
    },
  },
  LedgerCharge: { allOf: [ref('LedgerEntry'), { type: 'object', properties: {
    allocated_paise: { type: 'integer' }, remaining_paise: { type: 'integer' }, overdue: { type: 'boolean' },
    status: { type: 'string', enum: ['unpaid', 'partial', 'paid', 'reversed'] },
  } }] },
  LedgerPayment: { allOf: [ref('LedgerEntry'), { type: 'object', properties: {
    allocated_paise: { type: 'integer' }, available_paise: { type: 'integer' },
    status: { type: 'string', enum: ['recorded', 'reversed'] },
  } }] },
  LedgerChargeRequest: { type: 'object', additionalProperties: false, required: ['amount_paise', 'description', 'service_from', 'service_to'], properties: {
    amount_paise: amount, description: { ...text, minLength: 1, example: 'ERP access April–June' },
    date: { ...date, description: 'Charge date; defaults to today in UTC' }, service_from: date,
    service_to: { ...date, example: '2026-06-30', description: 'Inclusive service end, on or after service_from' }, due_date: date,
  } },
  LedgerPaymentRequest: { type: 'object', additionalProperties: false, required: ['amount_paise', 'date', 'payment_method'], properties: {
    amount_paise: amount, date, payment_method: { ...text, minLength: 1, example: 'Bank transfer' },
    reference: { ...text, example: 'BANK-123' }, description: text, allocations,
  } },
  LedgerAllocationRequest: { type: 'object', additionalProperties: false, required: ['allocations'], properties: { allocations, date } },
  LedgerReversalRequest: { type: 'object', additionalProperties: false, required: ['reason'], properties: { reason: { ...text, minLength: 1, example: 'Incorrect amount; replacing with corrected entry' }, date } },
  LedgerMutation: { type: 'object', properties: {
    entries: { type: 'array', items: ref('LedgerEntry') }, summary: ref('LedgerSummary'), replayed: { type: 'boolean' },
  } },
};
const schoolParameter = { name: 'organizationId', in: 'path', required: true, schema: id };
const errors = {
  400: { description: 'Invalid fields, dates, amounts, filters, or over-allocation' },
  401: { description: 'Authentication required' }, 403: { description: 'Role or school access denied' },
  404: { description: 'School or referenced active ledger entry not found' },
};
function operation(summary, schema, write = false, extraParameters = []) {
  return {
    tags: ['Organization Ledger'], summary,
    security: [{ bearerAuth: [] }],
    description: write
      ? 'Super Admin only. This records an ERP billing event; it does not process a bank payment, change student fees, or enable/disable school access. Posted entries are corrected by reversal. A concurrent edit returns 409: reload and retry. Reuse the same Idempotency-Key and identical URL/JSON body for safe retries; reuse with different content returns 409.'
      : 'Super Admin can view any school; Admin can only view their own school. Other roles have no access. All amounts are INR paise.',
    parameters: [schoolParameter, ...extraParameters, ...(write ? [{ name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string', minLength: 1, maxLength: 128 }, description: 'Unique per logical write within this school. Identical retries return the original entries and current summary.' }] : [])],
    responses: { [write ? 201 : 200]: { description: write ? 'Event recorded (or idempotent replay)' : 'Ledger data', content: json(schema) }, ...errors,
      ...(write ? { 409: { description: 'Concurrent update, already reversed entry, linked allocations, idempotency conflict, or ledger capacity reached' } } : {}) },
  };
}
const base = '/organizations/{organizationId}/ledger';
export const ledgerPaths = {
  [base]: { get: operation('Get organization ERP ledger totals', { allOf: [ref('LedgerSummary'), { type: 'object', properties: { organization_id: id, currency: { type: 'string', enum: ['INR'] } } }] }) },
};
for (const [resource, schema] of [['charges', 'LedgerCharge'], ['payments', 'LedgerPayment'], ['entries', 'LedgerEntry']]) {
  ledgerPaths[`${base}/${resource}`] = { get: operation(`List organization ledger ${resource}`, {
    type: 'object', properties: { organization_id: id, currency: { type: 'string', enum: ['INR'] }, page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, data: { type: 'array', items: ref(schema) } },
  }, false, [
    { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
    { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
    ...['from', 'to', 'service_from', 'service_to'].map(name => ({ name, in: 'query', schema: date, description: name.startsWith('service_') ? 'Inclusive service-period overlap filter; only charge entries have service dates' : 'Inclusive entry date filter; does not recalculate an historical balance' })),
  ]) };
}
for (const [path, summary, schema, parameter] of [
  [`${base}/charges`, 'Record a service charge', 'LedgerChargeRequest'],
  [`${base}/payments`, 'Record a payment with optional allocations', 'LedgerPaymentRequest'],
  [`${base}/payments/{paymentId}/allocations`, 'Allocate payment credit to service charges', 'LedgerAllocationRequest', 'paymentId'],
  [`${base}/entries/{entryId}/reverse`, 'Reverse an entry with a reason', 'LedgerReversalRequest', 'entryId'],
]) {
  const post = operation(summary, ref('LedgerMutation'), true, parameter ? [{ name: parameter, in: 'path', required: true, schema: id }] : []);
  post.requestBody = { required: true, content: json(ref(schema)) };
  if (parameter === 'entryId') post.description += ' Reverse active allocations first before reversing their payment or charge. Reversals cannot themselves be reversed.';
  ledgerPaths[path] = { ...ledgerPaths[path], post };
}
