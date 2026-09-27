import mongoose from 'mongoose';
import { orgFilter, profileHasRole } from '../middleware/auth.js';
import { Student, Parent, StudentParent, Teacher, ClassModel } from '../models/index.js';
import { attachAvatarUrls } from '../utils/avatarMap.js';

export async function getStudents(req, res, next) {
  try {
    const profile = req.profile;
    let filter = orgFilter(profile);

    if (profile.role === 'parent') {
      const parent = await Parent.findOne({
        $or: [
          { profile_id: new mongoose.Types.ObjectId(profile.id) },
          { email: profile.email?.toLowerCase().trim() },
        ],
      });
      if (!parent) return res.json([]);
      const links = await StudentParent.find({ parent_id: parent._id }).select('student_id');
      const ids = links.map((l) => l.student_id);
      filter = { ...filter, _id: { $in: ids } };
    } else if (profile.role === 'student') {
      filter = { ...filter, profile_id: new mongoose.Types.ObjectId(profile.id) };
    } else if (profile.role === 'teacher') {
      const teacher = await Teacher.findOne({ profile_id: new mongoose.Types.ObjectId(profile.id) });
      if (teacher) {
        // Teacher can see their assigned students or classes
        const classes = await ClassModel.find({
          $or: [{ teacher_id: teacher._id }, { teachers: teacher._id }],
        }).select('grade section');
        if (classes.length) {
          const classConditions = classes.map((c) => ({ class_grade: c.grade, section: c.section }));
          filter = { ...filter, $or: [{ teacher_id: teacher._id }, ...classConditions] };
        }
      }
    }

    const rows = await Student.find(filter)
      .populate('teacher_id', 'full_name')
      .sort({ created_at: -1 });

    const ids = rows.map((s) => s._id);
    const parentMap = {};

    if (ids.length) {
      const links = await StudentParent.find({ student_id: { $in: ids } }).populate('parent_id', 'full_name');
      links.forEach((l) => {
        if (l.parent_id) parentMap[l.student_id.toString()] = l.parent_id.full_name;
      });
    }

    const data = rows.map((s) => {
      const json = s.toJSON();
      return {
        ...json,
        name: s.full_name,
        class: s.class_grade ? (s.section ? `${s.class_grade}-${s.section}` : s.class_grade) : '',
        teacher_id: s.teacher_id?._id?.toString?.() || json.teacher_id,
        teacher_name: s.teacher_id?.full_name || null,
        parent_name: parentMap[s._id.toString()] || null,
      };
    });

    return res.json(await attachAvatarUrls(data));
  } catch (err) {
    return next(err);
  }
}

export async function getStudentById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid student ID' });
    }

    const student = await Student.findById(id).populate('teacher_id', 'full_name');
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    const profile = req.profile;

    // Check organization isolation
    if (
      profile.role !== 'super_admin' &&
      student.organization_id.toString() !== profile.organization_id?.toString()
    ) {
      return res.status(403).json({ success: false, error: 'Forbidden: Access denied to other organization data' });
    }

    // Resource-level security: Student can only access self
    if (profile.role === 'student') {
      if (student.profile_id?.toString() !== profile.id?.toString()) {
        return res.status(403).json({ success: false, error: 'Forbidden: Cannot access other student profiles' });
      }
    }

    // Resource-level security: Parent can only access linked children
    if (profile.role === 'parent') {
      const parent = await Parent.findOne({
        $or: [
          { profile_id: new mongoose.Types.ObjectId(profile.id) },
          { email: profile.email?.toLowerCase().trim() },
        ],
      });
      if (!parent) {
        return res.status(403).json({ success: false, error: 'Forbidden: Parent profile not found' });
      }
      const linked = await StudentParent.findOne({ student_id: student._id, parent_id: parent._id });
      if (!linked) {
        return res.status(403).json({ success: false, error: 'Forbidden: You can only access your own children' });
      }
    }

    const parentLink = await StudentParent.findOne({ student_id: student._id }).populate('parent_id', 'full_name email phone');
    const json = student.toJSON();

    const [enriched] = await attachAvatarUrls([
      {
        ...json,
        name: student.full_name,
        class: student.class_grade ? (student.section ? `${student.class_grade}-${student.section}` : student.class_grade) : '',
        teacher_id: student.teacher_id?._id?.toString?.() || json.teacher_id,
        teacher_name: student.teacher_id?.full_name || null,
        parent: parentLink?.parent_id ? parentLink.parent_id.toJSON() : null,
        parent_name: parentLink?.parent_id?.full_name || null,
      },
    ]);

    return res.json(enriched);
  } catch (err) {
    return next(err);
  }
}

export async function createStudent(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    const b = req.body || {};
    if (!b.full_name || !b.admission_no) {
      return res.status(400).json({ success: false, error: 'full_name and admission_no required' });
    }

    const orgId = req.profile.role === 'super_admin' ? b.organization_id || req.profile.organization_id : req.profile.organization_id;
    if (!orgId) return res.status(400).json({ success: false, error: 'organization_id required' });

    const existing = await Student.findOne({ organization_id: orgId, admission_no: b.admission_no });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Admission number already exists in this organization' });
    }

    const student = await Student.create({
      organization_id: orgId,
      full_name: b.full_name,
      admission_no: b.admission_no,
      email: b.email ? b.email.toLowerCase().trim() : null,
      roll_no: b.roll_no || null,
      class_grade: b.class_grade ? String(b.class_grade) : '',
      section: b.section || null,
      gender: b.gender || null,
      dob: b.dob ? new Date(b.dob) : null,
      phone: b.phone || null,
      address: b.address || null,
      teacher_id: b.teacher_id || null,
      status: b.status || 'Active',
    });

    return res.status(201).json(student.toJSON());
  } catch (err) {
    return next(err);
  }
}

export async function updateStudent(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const id = req.params.id || req.body?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid student ID required' });
    }

    const filter = { _id: id, ...orgFilter(req.profile) };
    const { id: _ignored, ...updateData } = req.body || {};
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase().trim();
    }

    const student = await Student.findOneAndUpdate(filter, updateData, { new: true });
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

    return res.json(student.toJSON());
  } catch (err) {
    return next(err);
  }
}

export async function deleteStudent(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const id = req.params.id || req.body?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid student ID required' });
    }

    const deleted = await Student.findOneAndDelete({ _id: id, ...orgFilter(req.profile) });
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    await StudentParent.deleteMany({ student_id: id });
    return res.json({ ok: true, success: true, message: 'Student deleted successfully' });
  } catch (err) {
    return next(err);
  }
}

export default {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
};
