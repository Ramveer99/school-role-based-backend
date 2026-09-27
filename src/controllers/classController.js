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
    return {
      ...base,
      $or: [
        { teacher_id: teacher._id },
        { teachers: teacher._id },
      ],
    };
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
      .populate('teacher_id', 'full_name email phone')
      .populate('teachers', 'full_name email phone department subjects')
      .sort({ grade: 1, section: 1 });

    const studentFilter = orgFilter(profile);
    const students = await Student.find(studentFilter).select('class_grade section organization_id');

    const data = rows.map((c) => {
      const json = c.toJSON();
      const orgId = c.organization_id.toString();
      const classTeacher = c.teacher_id;
      return {
        ...json,
        teacher_id: classTeacher?._id?.toString?.() || json.teacher_id || null,
        class_teacher_id: classTeacher?._id?.toString?.() || json.teacher_id || null,
        teacher_name: classTeacher?.full_name || null,
        class_teacher_name: classTeacher?.full_name || null,
        class_teacher: classTeacher
          ? {
              id: classTeacher._id?.toString(),
              full_name: classTeacher.full_name,
              email: classTeacher.email,
              phone: classTeacher.phone,
            }
          : null,
        teachers: (c.teachers || []).map((t) => ({
          id: t._id?.toString?.() || t.toString(),
          full_name: t.full_name || null,
          email: t.email || null,
          phone: t.phone || null,
          department: t.department || null,
          subjects: t.subjects || null,
        })),
        teachers_count: (c.teachers || []).length,
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

    const classDoc = await ClassModel.findById(id)
      .populate('teacher_id', 'full_name email phone department')
      .populate('teachers', 'full_name email phone department subjects');
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
    }).select('full_name admission_no roll_no status phone email gender dob');

    const json = classDoc.toJSON();
    const classTeacher = classDoc.teacher_id;

    return res.json({
      ...json,
      teacher_id: classTeacher?._id?.toString?.() || json.teacher_id || null,
      class_teacher_id: classTeacher?._id?.toString?.() || json.teacher_id || null,
      teacher_name: classTeacher?.full_name || null,
      class_teacher_name: classTeacher?.full_name || null,
      class_teacher: classTeacher
        ? {
            id: classTeacher._id?.toString(),
            full_name: classTeacher.full_name,
            email: classTeacher.email,
            phone: classTeacher.phone,
            department: classTeacher.department,
          }
        : null,
      teachers: (classDoc.teachers || []).map((t) => ({
        id: t._id?.toString?.() || t.toString(),
        full_name: t.full_name || null,
        email: t.email || null,
        phone: t.phone || null,
        department: t.department || null,
        subjects: t.subjects || null,
      })),
      teachers_count: (classDoc.teachers || []).length,
      students: students.map((s) => ({
        ...s.toJSON(),
        id: s._id.toString(),
        name: s.full_name,
        class: `${classDoc.grade}-${classDoc.section}`,
      })),
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

    // Class teacher can only be one
    let classTeacherId = b.teacher_id || b.class_teacher_id || null;
    if (Array.isArray(classTeacherId)) {
      if (classTeacherId.length > 1) {
        return res.status(400).json({ success: false, error: 'A class can only have one class teacher' });
      }
      classTeacherId = classTeacherId[0] || null;
    }

    if (classTeacherId) {
      const teacherExists = await Teacher.findOne({ _id: classTeacherId, organization_id });
      if (!teacherExists) {
        return res.status(400).json({ success: false, error: 'Class teacher not found in this school' });
      }
    }

    // Multiple teachers can be assigned
    let teachersList = [];
    if (b.teachers && Array.isArray(b.teachers)) {
      teachersList = b.teachers;
    } else if (b.teacher_ids && Array.isArray(b.teacher_ids)) {
      teachersList = b.teacher_ids;
    }

    if (classTeacherId && !teachersList.some((t) => t.toString() === classTeacherId.toString())) {
      teachersList.push(classTeacherId);
    }

    const newClass = await ClassModel.create({
      organization_id,
      grade,
      section,
      teacher_id: classTeacherId,
      teachers: teachersList,
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

    // Validate single class teacher if supplied
    if (updateData.class_teacher_id !== undefined || updateData.teacher_id !== undefined) {
      let ctId = updateData.class_teacher_id !== undefined ? updateData.class_teacher_id : updateData.teacher_id;
      if (Array.isArray(ctId)) {
        if (ctId.length > 1) {
          return res.status(400).json({ success: false, error: 'A class can only have one class teacher' });
        }
        ctId = ctId[0] || null;
      }
      updateData.teacher_id = ctId;
      delete updateData.class_teacher_id;
    }

    if (updateData.teacher_ids && Array.isArray(updateData.teacher_ids)) {
      updateData.teachers = updateData.teacher_ids;
      delete updateData.teacher_ids;
    }

    const updated = await ClassModel.findOneAndUpdate(filter, updateData, { new: true });
    if (!updated) return res.status(404).json({ success: false, error: 'Class not found' });

    return res.json(updated.toJSON());
  } catch (err) {
    return next(err);
  }
}

export async function setClassTeacher(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid class ID required' });
    }

    const { teacher_id } = req.body || {};
    const filter = { _id: id, ...orgFilter(req.profile) };
    const classDoc = await ClassModel.findOne(filter);
    if (!classDoc) return res.status(404).json({ success: false, error: 'Class not found' });

    if (Array.isArray(teacher_id) && teacher_id.length > 1) {
      return res.status(400).json({ success: false, error: 'A class can only have one class teacher' });
    }

    const targetTeacherId = Array.isArray(teacher_id) ? teacher_id[0] : teacher_id;
    if (targetTeacherId) {
      const teacher = await Teacher.findOne({ _id: targetTeacherId, organization_id: classDoc.organization_id });
      if (!teacher) {
        return res.status(400).json({ success: false, error: 'Teacher not found in this school' });
      }
    }

    classDoc.teacher_id = targetTeacherId || null;
    if (targetTeacherId && !classDoc.teachers.some((t) => t.toString() === targetTeacherId.toString())) {
      classDoc.teachers.push(targetTeacherId);
    }
    await classDoc.save();

    const populated = await ClassModel.findById(id)
      .populate('teacher_id', 'full_name email')
      .populate('teachers', 'full_name email');

    return res.json({
      success: true,
      message: 'Class teacher updated successfully',
      class: populated.toJSON(),
    });
  } catch (err) {
    return next(err);
  }
}

export async function assignTeachersToClass(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid class ID required' });
    }

    const filter = { _id: id, ...orgFilter(req.profile) };
    const classDoc = await ClassModel.findOne(filter);
    if (!classDoc) return res.status(404).json({ success: false, error: 'Class not found' });

    const b = req.body || {};
    let incomingTeachers = [];
    if (b.teacher_id) incomingTeachers.push(b.teacher_id);
    if (Array.isArray(b.teacher_ids)) incomingTeachers.push(...b.teacher_ids);
    if (Array.isArray(b.teachers)) incomingTeachers.push(...b.teachers);

    // Validate teachers exist
    const validTeachers = await Teacher.find({
      _id: { $in: incomingTeachers },
      organization_id: classDoc.organization_id,
    }).select('_id');

    const validIds = validTeachers.map((t) => t._id);
    const updated = await ClassModel.findByIdAndUpdate(
      id,
      { $addToSet: { teachers: { $each: validIds } } },
      { new: true }
    )
      .populate('teacher_id', 'full_name email')
      .populate('teachers', 'full_name email department subjects');

    return res.json({
      success: true,
      message: `${validIds.length} teacher(s) assigned to class`,
      class: updated.toJSON(),
    });
  } catch (err) {
    return next(err);
  }
}

export async function removeTeacherFromClass(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    const { id, teacherId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(teacherId)) {
      return res.status(400).json({ success: false, error: 'Valid class ID and teacher ID required' });
    }

    const filter = { _id: id, ...orgFilter(req.profile) };
    const classDoc = await ClassModel.findOne(filter);
    if (!classDoc) return res.status(404).json({ success: false, error: 'Class not found' });

    const updateOps = { $pull: { teachers: teacherId } };
    if (classDoc.teacher_id?.toString() === teacherId.toString()) {
      updateOps.$set = { teacher_id: null };
    }

    const updated = await ClassModel.findByIdAndUpdate(id, updateOps, { new: true })
      .populate('teacher_id', 'full_name email')
      .populate('teachers', 'full_name email');

    return res.json({
      success: true,
      message: 'Teacher removed from class',
      class: updated.toJSON(),
    });
  } catch (err) {
    return next(err);
  }
}

export async function getClassStudents(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid class ID required' });
    }

    const classDoc = await ClassModel.findById(id);
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
    }).sort({ roll_no: 1, full_name: 1 });

    return res.json({
      grade: classDoc.grade,
      section: classDoc.section,
      total_students: students.length,
      students: students.map((s) => ({
        ...s.toJSON(),
        name: s.full_name,
        class: `${classDoc.grade}-${classDoc.section}`,
      })),
    });
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
  getClassStudents,
  createClass,
  updateClass,
  setClassTeacher,
  assignTeachersToClass,
  removeTeacherFromClass,
  deleteClass,
};
