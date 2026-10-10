import { Router } from 'express';
import { Organization } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { validId } from '../services/organizationLedgerService.js';
import { getLedger, listLedgerRecords, createLedgerCharge, createLedgerPayment, allocateLedgerPayment, reverseLedgerEntry } from '../controllers/organizationLedgerController.js';

const router = Router({ mergeParams: true });
router.use(requireRole('admin', 'super_admin'));
router.use(async (req, res, next) => {
  try {
    const id = req.params.organizationId;
    if (!validId(id)) return res.status(400).json({ error: 'Invalid organization ID' });
    if (req.profile.role !== 'super_admin' && req.profile.organization_id?.toString() !== id.toLowerCase()) return res.status(403).json({ error: 'Forbidden: organization access denied' });
    if (!await Organization.exists({ _id: id })) return res.status(404).json({ error: 'Organization not found' });
    return next();
  } catch (error) { return next(error); }
});
router.get('/', getLedger);
router.get('/charges', listLedgerRecords('charges'));
router.get('/payments', listLedgerRecords('payments'));
router.get('/entries', listLedgerRecords('entries'));
router.use(requireRole('super_admin'));
router.post('/charges', createLedgerCharge);
router.post('/payments', createLedgerPayment);
router.post('/payments/:paymentId/allocations', allocateLedgerPayment);
router.post('/entries/:entryId/reverse', reverseLedgerEntry);
export default router;
