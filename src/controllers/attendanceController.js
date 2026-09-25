import mongoose from 'mongoose';
import { orgFilter, profileHasRole } from '../middleware/auth.js';
import { Attendance, Student, Parent, StudentParent } from '../models/index.js';

export async function getAttendance(req, res, next) {
  try {
    const profile = req.profile;
    let filter = orgFilter(profile);

    const { class_grade, section, date, student_id } = req.query;

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
          return res.status(403).json({ success: false, error: 'Forbidden: Cannot access attendance of other students' });
        }
        filter = { ...filter, student_id: new mongoose.Types.ObjectId(student_id) };
      } else {
        filter = { ...filter, student_id: { $in: studentIds } };
      }
    } else {
      // Admin / Teacher / Super Admin
      if (student_id && mongoose.Types.ObjectId.isValid(student_id)) {
        filter = { ...filter, student_id: new mongoose.Types.ObjectId(student_id) };
      }
      if (class_grade) filter = { ...filter, class_grade: String(class_grade) };
      if (section) filter = { ...filter, section: String(section) };
    }

    if (date) {
      const d = new Date(date);
      const startOfDay = new Date(d.setHours(0, 0, 0, 0));
      const endOfDay = new Date(d.setHours(23, 59, 59, 999));
      filter = { ...filter, date: { $gte: startOfDay, $lte: endOfDay } };
    }

    const records = await Attendance.find(filter)
      .populate('student_id', 'full_name admission_no roll_no')
      .sort({ date: -1 });

    const data = records.map((r) => {
      const json = r.toJSON();
      return {
        ...json,
        student_name: r.student_id?.full_name || null,
        admission_no: r.student_id?.admission_no || null,
        roll_no: r.student_id?.roll_no || null,
      };
    });

    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

export async function markAttendance(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin', 'teacher'])) {
      return res.status(403).json({ success: false, error: 'Forbidden: Teacher or Admin access required' });
    }

    const profile = req.profile;
    const body = req.body || {};
    const orgId = profile.role === 'super_admin' ? body.organization_id || profile.organization_id : profile.organization_id;

    if (!orgId) {
      return res.status(400).json({ success: false, error: 'organization_id required' });
    }

    // Support Batch marking
    if (Array.isArray(body.records)) {
      const { class_grade, section, date } = body;
      if (!class_grade || !section || !date) {
        return res.status(400).json({ success: false, error: 'class_grade, section, and date required for batch attendance' });
      }

      const attendanceDate = new Date(new Date(date).setHours(0, 0, 0, 0));
      const operations = body.records.map((r) => {
        return {
          updateOne: {
            filter: {
              organization_id: new mongoose.Types.ObjectId(orgId),
              student_id: new mongoose.Types.ObjectId(r.student_id),
              date: attendanceDate,
            },
            update: {
              $set: {
                organization_id: new mongoose.Types.ObjectId(orgId),
                student_id: new mongoose.Types.ObjectId(r.student_id),
                class_grade: String(class_grade),
                section: String(section),
                date: attendanceDate,
                status: r.status || 'present',
                remarks: r.remarks || '',
                recorded_by: new mongoose.Types.ObjectId(profile.id),
              },
            },
            upsert: true,
          },
        };
      });

      if (operations.length > 0) {
        await Attendance.bulkWrite(operations);
      }

      return res.json({ success: true, message: `Marked attendance for ${operations.length} students` });
    }

    // Single Record marking
    const { student_id, class_grade, section, date, status, remarks } = body;
    if (!student_id || !class_grade || !section || !date) {
      return res.status(400).json({ success: false, error: 'student_id, class_grade, section, and date required' });
    }

    const attendanceDate = new Date(new Date(date).setHours(0, 0, 0, 0));
    const record = await Attendance.findOneAndUpdate(
      {
        organization_id: new mongoose.Types.ObjectId(orgId),
        student_id: new mongoose.Types.ObjectId(student_id),
        date: attendanceDate,
      },
      {
        organization_id: new mongoose.Types.ObjectId(orgId),
        student_id: new mongoose.Types.ObjectId(student_id),
        class_grade: String(class_grade),
        section: String(section),
        date: attendanceDate,
        status: status || 'present',
        remarks: remarks || '',
        recorded_by: new mongoose.Types.ObjectId(profile.id),
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({ success: true, record: record.toJSON() });
  } catch (err) {
    return next(err);
  }
}

export async function updateAttendance(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin', 'teacher'])) {
      return res.status(403).json({ success: false, error: 'Forbidden: Teacher or Admin access required' });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid attendance ID' });
    }

    const record = await Attendance.findOne({ _id: id, ...orgFilter(req.profile) });
    if (!record) return res.status(404).json({ success: false, error: 'Attendance record not found' });

    const b = req.body || {};
    if (b.status !== undefined) record.status = b.status;
    if (b.remarks !== undefined) record.remarks = b.remarks;
    if (b.class_grade !== undefined) record.class_grade = String(b.class_grade);
    if (b.section !== undefined) record.section = String(b.section);
    if (b.date !== undefined) record.date = new Date(new Date(b.date).setHours(0, 0, 0, 0));
    record.recorded_by = new mongoose.Types.ObjectId(req.profile.id);

    await record.save();
    await record.populate('student_id', 'full_name admission_no roll_no');

    const json = record.toJSON();
    return res.json({
      ...json,
      student_name: record.student_id?.full_name || null,
      admission_no: record.student_id?.admission_no || null,
      roll_no: record.student_id?.roll_no || null,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getAttendanceStats(req, res, next) {
  try {
    const profile = req.profile;
    let filter = orgFilter(profile);

    const { class_grade, section, student_id } = req.query;

    if (profile.role === 'student') {
      const student = await Student.findOne({ profile_id: new mongoose.Types.ObjectId(profile.id) });
      if (!student) return res.json({ total: 0, present: 0, absent: 0, late: 0, rate: 0 });
      filter = { ...filter, student_id: student._id };
    } else if (profile.role === 'parent') {
      const parent = await Parent.findOne({ profile_id: new mongoose.Types.ObjectId(profile.id) });
      if (!parent) return res.json({ total: 0, present: 0, absent: 0, late: 0, rate: 0 });
      const links = await StudentParent.find({ parent_id: parent._id }).select('student_id');
      const studentIds = links.map((l) => l.student_id);

      if (student_id) {
        if (!studentIds.some((id) => id.toString() === student_id)) {
          return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        filter = { ...filter, student_id: new mongoose.Types.ObjectId(student_id) };
      } else {
        filter = { ...filter, student_id: { $in: studentIds } };
      }
    } else {
      if (student_id && mongoose.Types.ObjectId.isValid(student_id)) {
        filter = { ...filter, student_id: new mongoose.Types.ObjectId(student_id) };
      }
      if (class_grade) filter = { ...filter, class_grade: String(class_grade) };
      if (section) filter = { ...filter, section: String(section) };
    }

    const [total, present, absent, late] = await Promise.all([
      Attendance.countDocuments(filter),
      Attendance.countDocuments({ ...filter, status: 'present' }),
      Attendance.countDocuments({ ...filter, status: 'absent' }),
      Attendance.countDocuments({ ...filter, status: 'late' }),
    ]);

    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    return res.json({
      total,
      present,
      absent,
      late,
      percentage: rate,
    });
  } catch (err) {
    return next(err);
  }
}

export default {
  getAttendance,
  markAttendance,
  updateAttendance,
  getAttendanceStats,
};
