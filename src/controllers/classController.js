import mongoose from 'mongoose';
import { orgFilter, profileHasRole } from '../middleware/auth.js';
import { ClassModel, Student, Teacher, Parent, StudentParent } from '../models/index.js';
import { resolveOrgId } from '../utils/users.js';

async function classFilterForProfile(profile) {
  const base = orgFilter(profile);

  if (profile.role === 'admin' || profile.role === 'super_admin') {
    return base;
  }

  if (profile.role === 'student') {
    const student = await Student.findOne({
      profile_id: new mongoose.Types.ObjectId(profile.id),
      ...orgFilter(profile),
    });
    if (!student?.class_grade || !student?.section) return { ...base, _id: { $in: [] } };
    return { ...base, grade: student.class_grade, section: student.section };
  }

  if (profile.role === 'teacher') {
    const teacher = await Teacher.findOne({
      profile_id: new mongoose.Types.ObjectId(profile.id),
      ...orgFilter(profile),
    });
    if (!teacher) return { ...base, _id: { $in: [] } };
    return { ...base, teacher_id: teacher._id };
  }

  if (profile.role === 'parent') {
    const parent = await Parent.findOne({
      profile_id: new mongoose.Types.ObjectId(profile.id),
    });
    if (!parent) return { ...base, _id: { $in: [] } };
    const links = await StudentParent.find({ parent_id: parent._id }).select('student_id');
    const ids = links.map((l) => l.student_id);
    if (!ids.length) return { ...base, _id: { $in: [] } };
    const children = await Student.find({ _id: { $in: ids } }).select('class_grade section');
    const pairs = [
      ...new Map(
        children
          .filter((s) => s.class_grade && s.section)
          .map((s) => [`${s.class_grade}-${s.section}`, { grade: s.class_grade, section: s.section }])
      ).values(),
    ];
    if (!pairs.length) return { ...base, _id: { $in: [] } };
    return { ...base, $or: pairs };
  }

  return { ...base, _id: { $in: [] } };
}

export async function getClasses(req, res, next) {
  try {
    const profile = req.profile;
    const filter = await classFilterForProfile(profile);
    const rows = await ClassModel.find(filter)
      .populate('teacher_id', 'full_name')
      .sort({ grade: 1, section: 1 });

    const studentFilter = orgFilter(profile);
    const students = await Student.find(studentFilter).select('class_grade section organization_id');

    const data = rows.map((c) => {
      const json = c.toJSON();
      const orgId = c.organization_id.toString();
      return {
        ...json,
        teacher_id: c.teacher_id?._id?.toString?.() || json.teacher_id,
        teacher_name: c.teacher_id?.full_name || null,
        student_count: students.filter(
          (s) =>
            s.class_grade === c.grade &&
            s.section === c.section &&
            (profile.role === 'super_admin' ? s.organization_id.toString() === orgId : true)
        ).length,
      };
    });

    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

export async function getClassById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid class ID' });
    }

    const classDoc = await ClassModel.findById(id).populate('teacher_id', 'full_name email');
    if (!classDoc) return res.status(404).json({ success: false, error: 'Class not found' });

    const profile = req.profile;
    if (
      profile.role !== 'super_admin' &&
      classDoc.organization_id.toString() !== profile.organization_id?.toString()
    ) {
      return res.status(403).json({ success: false, error: 'Forbidden: Access denied to other organization' });
    }

    const students = await Student.find({
      organization_id: classDoc.organization_id,
      class_grade: classDoc.grade,
      section: classDoc.section,
    }).select('full_name admission_no roll_no status phone');

    const json = classDoc.toJSON();
    return res.json({
      ...json,
      teacher_name: classDoc.teacher_id?.full_name || null,
      students: students.map((s) => s.toJSON()),
      student_count: students.length,
    });
  } catch (err) {
    return next(err);
  }
}

export async function createClass(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    const b = req.body || {};
    if (!b.grade || !b.section) {
      return res.status(400).json({ success: false, error: 'grade and section required' });
    }

    const organization_id = resolveOrgId(req.profile, b.organization_id);
    if (!organization_id) return res.status(400).json({ success: false, error: 'organization_id required' });

    const grade = String(b.grade).trim();
    const section = String(b.section).trim();

    const existing = await ClassModel.findOne({ organization_id, grade, section });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Class already exists in this organization' });
    }

    const newClass = await ClassModel.create({
      organization_id,
      grade,
      section,
      teacher_id: b.teacher_id || null,
    });

    return res.status(201).json(newClass.toJSON());
  } catch (err) {
    return next(err);
  }
}

export async function updateClass(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const id = req.params.id || req.body?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid class ID required' });
    }

    const filter = { _id: id, ...orgFilter(req.profile) };
    const { id: _ignored, ...updateData } = req.body || {};

    const updated = await ClassModel.findOneAndUpdate(filter, updateData, { new: true });
    if (!updated) return res.status(404).json({ success: false, error: 'Class not found' });

    return res.json(updated.toJSON());
  } catch (err) {
    return next(err);
  }
}

export async function deleteClass(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const id = req.params.id || req.body?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid class ID required' });
    }

    const deleted = await ClassModel.findOneAndDelete({ _id: id, ...orgFilter(req.profile) });
    if (!deleted) return res.status(404).json({ success: false, error: 'Class not found' });

    return res.json({ ok: true, success: true, message: 'Class deleted successfully' });
  } catch (err) {
    return next(err);
  }
}

export default {
  getClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
};
