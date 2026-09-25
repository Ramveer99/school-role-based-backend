import mongoose from 'mongoose';
import { orgFilter, profileHasRole } from '../middleware/auth.js';
import { Fee, Student, Parent, StudentParent } from '../models/index.js';

export async function getFees(req, res, next) {
  try {
    const profile = req.profile;
    let filter = orgFilter(profile);

    const { student_id, status } = req.query;

    if (profile.role === 'student') {
      const student = await Student.findOne({ profile_id: new mongoose.Types.ObjectId(profile.id) });
      if (!student) return res.json([]);
      filter = { ...filter, student_id: student._id };
    } else if (profile.role === 'parent') {
      const parent = await Parent.findOne({ profile_id: new mongoose.Types.ObjectId(profile.id) });
      if (!parent) return res.json([]);
      const links = await StudentParent.find({ parent_id: parent._id }).select('student_id');
      const studentIds = links.map((l) => l.student_id);

      if (student_id) {
        if (!studentIds.some((id) => id.toString() === student_id)) {
          return res.status(403).json({ success: false, error: 'Forbidden: Cannot access fees for this student' });
        }
        filter = { ...filter, student_id: new mongoose.Types.ObjectId(student_id) };
      } else {
        filter = { ...filter, student_id: { $in: studentIds } };
      }
    } else {
      if (student_id && mongoose.Types.ObjectId.isValid(student_id)) {
        filter = { ...filter, student_id: new mongoose.Types.ObjectId(student_id) };
      }
    }

    if (status) filter = { ...filter, status };

    const rows = await Fee.find(filter)
      .populate('student_id', 'full_name admission_no class_grade section')
      .sort({ due_date: 1 });

    const data = rows.map((f) => feeToResponse(f));

    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

export async function createFee(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    const profile = req.profile;
    const b = req.body || {};
    const orgId = profile.role === 'super_admin' ? b.organization_id || profile.organization_id : profile.organization_id;

    if (!orgId) return res.status(400).json({ success: false, error: 'organization_id required' });
    if (!b.student_id || !b.title || !b.total_amount || !b.due_date) {
      return res.status(400).json({ success: false, error: 'student_id, title, total_amount, and due_date required' });
    }

    const fee = await Fee.create({
      organization_id: new mongoose.Types.ObjectId(orgId),
      student_id: new mongoose.Types.ObjectId(b.student_id),
      title: b.title,
      fee_type: b.fee_type || 'Tuition',
      academic_year: b.academic_year || '2025-2026',
      total_amount: Number(b.total_amount),
      paid_amount: Number(b.paid_amount || 0),
      due_date: new Date(b.due_date),
      status: Number(b.paid_amount || 0) >= Number(b.total_amount) ? 'Paid' : Number(b.paid_amount || 0) > 0 ? 'Partial' : 'Pending',
    });

    return res.status(201).json(fee.toJSON());
  } catch (err) {
    return next(err);
  }
}

function deriveFeeStatus(fee) {
  if (fee.paid_amount >= fee.total_amount) return 'Paid';
  if (fee.paid_amount > 0) return 'Partial';
  return fee.due_date < new Date() ? 'Overdue' : 'Pending';
}

function feeToResponse(fee) {
  const json = fee.toJSON();
  return {
    ...json,
    student_name: fee.student_id?.full_name || null,
    admission_no: fee.student_id?.admission_no || null,
    class_grade: fee.student_id?.class_grade || null,
    section: fee.student_id?.section || null,
  };
}

export async function updateFee(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid fee ID' });
    }

    const fee = await Fee.findOne({ _id: id, ...orgFilter(req.profile) });
    if (!fee) return res.status(404).json({ success: false, error: 'Fee record not found' });

    const b = req.body || {};
    if (b.title !== undefined) fee.title = b.title;
    if (b.fee_type !== undefined) fee.fee_type = b.fee_type;
    if (b.academic_year !== undefined) fee.academic_year = b.academic_year;
    if (b.total_amount !== undefined) fee.total_amount = Number(b.total_amount);
    if (b.paid_amount !== undefined) fee.paid_amount = Number(b.paid_amount);
    if (b.due_date !== undefined) fee.due_date = new Date(b.due_date);

    fee.status = b.status !== undefined ? b.status : deriveFeeStatus(fee);

    await fee.save();
    await fee.populate('student_id', 'full_name admission_no class_grade section');
    return res.json(feeToResponse(fee));
  } catch (err) {
    return next(err);
  }
}

export async function payFee(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid fee ID' });
    }

    const fee = await Fee.findOne({ _id: id, ...orgFilter(req.profile) });
    if (!fee) return res.status(404).json({ success: false, error: 'Fee record not found' });

    // Resource check: Student or Parent can only pay for their own student
    const profile = req.profile;
    if (profile.role === 'student') {
      const student = await Student.findOne({ profile_id: new mongoose.Types.ObjectId(profile.id) });
      if (fee.student_id.toString() !== student?._id?.toString()) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
    } else if (profile.role === 'parent') {
      const parent = await Parent.findOne({ profile_id: new mongoose.Types.ObjectId(profile.id) });
      const linked = await StudentParent.findOne({ parent_id: parent?._id, student_id: fee.student_id });
      if (!linked) return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const { amount, payment_method, transaction_id } = req.body || {};
    const paymentAmount = Number(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid positive payment amount required' });
    }

    fee.paid_amount += paymentAmount;
    fee.payments.push({
      amount: paymentAmount,
      date: new Date(),
      payment_method: payment_method || 'Online',
      transaction_id: transaction_id || `TXN-${Date.now()}`,
      receipt_no: `REC-${Date.now().toString().slice(-6)}`,
    });

    if (fee.paid_amount >= fee.total_amount) {
      fee.status = 'Paid';
    } else {
      fee.status = 'Partial';
    }

    await fee.save();
    return res.json({ success: true, message: 'Payment recorded successfully', fee: fee.toJSON() });
  } catch (err) {
    return next(err);
  }
}

export async function getFeeStats(req, res, next) {
  try {
    const profile = req.profile;
    let filter = orgFilter(profile);

    if (profile.role === 'student') {
      const student = await Student.findOne({ profile_id: new mongoose.Types.ObjectId(profile.id) });
      if (!student) return res.json({ total: 0, paid: 0, pending: 0 });
      filter = { ...filter, student_id: student._id };
    } else if (profile.role === 'parent') {
      const parent = await Parent.findOne({ profile_id: new mongoose.Types.ObjectId(profile.id) });
      if (!parent) return res.json({ total: 0, paid: 0, pending: 0 });
      const links = await StudentParent.find({ parent_id: parent._id }).select('student_id');
      filter = { ...filter, student_id: { $in: links.map((l) => l.student_id) } };
    }

    const fees = await Fee.find(filter);
    let total = 0;
    let paid = 0;

    fees.forEach((f) => {
      total += f.total_amount;
      paid += f.paid_amount;
    });

    return res.json({
      total_fees: total,
      total_paid: paid,
      total_pending: Math.max(0, total - paid),
      paid_percentage: total > 0 ? Math.round((paid / total) * 100) : 0,
    });
  } catch (err) {
    return next(err);
  }
}

export default {
  getFees,
  createFee,
  updateFee,
  payFee,
  getFeeStats,
};
