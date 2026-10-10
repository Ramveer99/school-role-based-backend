import mongoose from 'mongoose';
import { OrganizationLedger } from '../models/OrganizationLedger.js';

export function ledgerError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
export const today = () => new Date().toISOString().slice(0, 10);
export const validId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
export function dateValue(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
      || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw ledgerError(`${field} must be a valid YYYY-MM-DD date`);
  }
  return value;
}
export function amountValue(value) {
  if (!Number.isSafeInteger(value) || value <= 0) throw ledgerError('amount_paise must be a positive safe integer');
  return value;
}
export function textValue(value, field, required = false) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || value.length > 500 || (required && !value.trim())) {
    throw ledgerError(`${field} must be ${required ? 'nonblank text' : 'text'} of at most 500 characters`);
  }
  return value.trim();
}
export function fields(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) {
    throw ledgerError('Unsupported request fields');
  }
}
function sum(values) {
  const result = values.reduce((total, value) => total + value, 0);
  if (!Number.isSafeInteger(result)) throw ledgerError('Ledger exceeds supported monetary range');
  return result;
}
export function ledgerView(ledger) {
  const entries = (ledger?.entries || []).map(entry => {
    const raw = entry.toObject ? entry.toObject() : entry;
    const { _id, request_key, request_hash, ...rest } = raw;
    return { ...rest, id: _id.toString() };
  });
  const reversed = new Set(entries.filter(e => e.type === 'reversal').map(e => e.reverses_id.toString()));
  const allocations = entries.filter(e => e.type === 'allocation' && !reversed.has(e.id));
  const charges = entries.filter(e => e.type === 'charge').map(e => {
    const allocated = sum(allocations.filter(a => a.charge_id.toString() === e.id).map(a => a.amount_paise));
    const isReversed = reversed.has(e.id);
    const remaining = isReversed ? 0 : e.amount_paise - allocated;
    return { ...e, allocated_paise: allocated, remaining_paise: remaining,
      status: isReversed ? 'reversed' : remaining === 0 ? 'paid' : allocated ? 'partial' : 'unpaid',
      overdue: !isReversed && remaining > 0 && !!e.due_date && e.due_date < today() };
  });
  const payments = entries.filter(e => e.type === 'payment').map(e => {
    const allocated = sum(allocations.filter(a => a.payment_id.toString() === e.id).map(a => a.amount_paise));
    const isReversed = reversed.has(e.id);
    return { ...e, status: isReversed ? 'reversed' : 'recorded', allocated_paise: allocated,
      available_paise: isReversed ? 0 : e.amount_paise - allocated };
  });
  const charged = sum(charges.filter(e => e.status !== 'reversed').map(e => e.amount_paise));
  const received = sum(payments.filter(e => e.status !== 'reversed').map(e => e.amount_paise));
  return { entries: entries.map(e => ({ ...e, reversed: reversed.has(e.id) })), charges, payments,
    summary: { total_charged_paise: charged, total_received_paise: received,
      outstanding_paise: sum(charges.map(e => e.remaining_paise)),
      available_credit_paise: sum(payments.map(e => e.available_paise)), net_balance_paise: charged - received } };
}

export async function mutateLedger(organizationId, actorId, operation, request = {}) {
  // Ensure a unique account before loading its revision for the write.
  try {
    await OrganizationLedger.updateOne({ organization_id: organizationId },
      { $setOnInsert: { organization_id: organizationId, entries: [], currency: 'INR' } }, { upsert: true });
  } catch (error) { if (error.code !== 11000) throw error; }
  const ledger = await OrganizationLedger.findOne({ organization_id: organizationId });
  if (request.key) {
    const previous = ledger.entries.filter(e => e.request_key === request.key);
    if (previous.length) {
      if (previous[0].request_hash !== request.hash) throw ledgerError('Idempotency-Key already used for a different request', 409);
      const view = ledgerView(ledger);
      const ids = new Set(previous.map(e => e.id));
      return { entries: view.entries.filter(e => ids.has(e.id)), summary: view.summary, replayed: true };
    }
  }
  const firstNew = ledger.entries.length;
  const append = data => {
    ledger.entries.push({ ...data, created_by: actorId, request_key: request.key, request_hash: request.hash });
    return ledger.entries[ledger.entries.length - 1];
  };
  operation(ledger, append);
  // Bound document growth below MongoDB's document limit; never silently truncate history.
  if (ledger.entries.length > 5000) throw ledgerError('Ledger capacity reached; archival support is required before further entries', 409);
  const view = ledgerView(ledger);
  try { await ledger.save(); }
  catch (error) {
    if (error instanceof mongoose.Error.VersionError) throw ledgerError('Ledger changed concurrently; reload and retry', 409);
    throw error;
  }
  return { entries: view.entries.slice(firstNew), summary: view.summary };
}

export function allocate(ledger, append, paymentId, allocations, date) {
  if (!validId(paymentId)) throw ledgerError('Invalid payment ID');
  if (!Array.isArray(allocations) || !allocations.length || allocations.length > 100) throw ledgerError('allocations must contain 1 to 100 items');
  for (const item of allocations) {
    fields(item, ['charge_id', 'amount_paise']);
    if (!validId(item.charge_id)) throw ledgerError('Invalid charge ID');
    const amount = amountValue(item.amount_paise);
    const view = ledgerView(ledger);
    const payment = view.payments.find(p => p.id === paymentId.toLowerCase() && p.status !== 'reversed');
    const charge = view.charges.find(c => c.id === item.charge_id.toLowerCase() && c.status !== 'reversed');
    if (!payment || !charge) throw ledgerError('Active payment or charge not found in this organization', 404);
    if (amount > payment.available_paise || amount > charge.remaining_paise) throw ledgerError('Allocation exceeds payment credit or charge balance');
    append({ type: 'allocation', date, payment_id: payment.id, charge_id: charge.id, amount_paise: amount });
  }
}
