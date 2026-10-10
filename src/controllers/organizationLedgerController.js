import crypto from 'node:crypto';
import { OrganizationLedger } from '../models/OrganizationLedger.js';
import { ledgerError, ledgerView, mutateLedger, allocate, fields, textValue, amountValue, dateValue, today, validId } from '../services/organizationLedgerService.js';

function write(req, operation) {
  const key = req.get('Idempotency-Key');
  if (key !== undefined && (!key.trim() || key.length > 128)) throw ledgerError('Idempotency-Key must be 1 to 128 characters');
  const hash = key ? crypto.createHash('sha256').update(JSON.stringify({ path: req.originalUrl, body: req.body || {} })).digest('hex') : undefined;
  return mutateLedger(req.params.organizationId, req.profile.id, operation, { key, hash });
}

export async function getLedger(req, res, next) {
  try {
    const ledger = await OrganizationLedger.findOne({ organization_id: req.params.organizationId });
    return res.json({ organization_id: req.params.organizationId, currency: 'INR', ...ledgerView(ledger).summary });
  } catch (error) { return next(error); }
}

export function listLedgerRecords(kind) {
  return async (req, res, next) => {
    try {
      fields(req.query, ['page', 'limit', 'from', 'to', 'service_from', 'service_to']);
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 50);
      if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw ledgerError('page must be positive and limit must be between 1 and 100');
      const dates = {};
      for (const key of ['from', 'to', 'service_from', 'service_to']) {
        if (req.query[key] !== undefined) dates[key] = dateValue(req.query[key], key);
      }
      if ((dates.from && dates.to && dates.from > dates.to) || (dates.service_from && dates.service_to && dates.service_from > dates.service_to)) throw ledgerError('Date range start must not exceed end');
      const ledger = await OrganizationLedger.findOne({ organization_id: req.params.organizationId });
      let records = ledgerView(ledger)[kind];
      records = records.filter(e => (!dates.from || e.date >= dates.from) && (!dates.to || e.date <= dates.to)
        && (!dates.service_from || (e.service_to && e.service_to >= dates.service_from))
        && (!dates.service_to || (e.service_from && e.service_from <= dates.service_to)));
      records.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
      return res.json({ organization_id: req.params.organizationId, currency: 'INR', page, limit, total: records.length, data: records.slice((page - 1) * limit, page * limit) });
    } catch (error) { return next(error); }
  };
}

export async function createLedgerCharge(req, res, next) {
  try {
    const body = req.body || {};
    fields(body, ['amount_paise', 'date', 'description', 'service_from', 'service_to', 'due_date']);
    const charge = { type: 'charge', amount_paise: amountValue(body.amount_paise),
      description: textValue(body.description, 'description', true),
      date: dateValue(body.date ?? today(), 'date'), service_from: dateValue(body.service_from, 'service_from'),
      service_to: dateValue(body.service_to, 'service_to'),
      due_date: body.due_date === undefined ? undefined : dateValue(body.due_date, 'due_date') };
    if (charge.service_from > charge.service_to) throw ledgerError('service_from must not exceed service_to');
    const result = await write(req, (_ledger, append) => append(charge));
    return res.status(201).json(result);
  } catch (error) { return next(error); }
}

export async function createLedgerPayment(req, res, next) {
  try {
    const body = req.body || {};
    fields(body, ['amount_paise', 'date', 'payment_method', 'reference', 'description', 'allocations']);
    const payment = { type: 'payment', amount_paise: amountValue(body.amount_paise), date: dateValue(body.date, 'date'),
      payment_method: textValue(body.payment_method, 'payment_method', true), reference: textValue(body.reference, 'reference'),
      description: textValue(body.description, 'description') };
    const result = await write(req, (ledger, append) => {
      const entry = append(payment);
      if (body.allocations !== undefined) allocate(ledger, append, entry.id, body.allocations, payment.date);
    });
    return res.status(201).json(result);
  } catch (error) { return next(error); }
}

export async function allocateLedgerPayment(req, res, next) {
  try {
    fields(req.body || {}, ['allocations', 'date']);
    const date = dateValue(req.body?.date ?? today(), 'date');
    const result = await write(req,
      (ledger, append) => allocate(ledger, append, req.params.paymentId, req.body?.allocations, date));
    return res.status(201).json(result);
  } catch (error) { return next(error); }
}

export async function reverseLedgerEntry(req, res, next) {
  try {
    fields(req.body || {}, ['reason', 'date']);
    const reason = textValue(req.body?.reason, 'reason', true);
    const date = dateValue(req.body?.date ?? today(), 'date');
    if (!validId(req.params.entryId)) throw ledgerError('Invalid entry ID');
    const result = await write(req, (ledger, append) => {
      const view = ledgerView(ledger);
      const entry = view.entries.find(e => e.id === req.params.entryId.toLowerCase());
      if (!entry) throw ledgerError('Entry not found in organization', 404);
      if (entry.reversed || entry.type === 'reversal') throw ledgerError('Entry is already reversed or is a reversal', 409);
      if (view.entries.some(e => e.type === 'allocation' && !e.reversed && (e.charge_id.toString() === entry.id || e.payment_id.toString() === entry.id))) {
        throw ledgerError('Reverse linked allocations before reversing this charge or payment', 409);
      }
      append({ type: 'reversal', date, reverses_id: entry.id, reason });
    });
    return res.status(201).json(result);
  } catch (error) { return next(error); }
}
