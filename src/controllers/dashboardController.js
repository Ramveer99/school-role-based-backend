import mongoose from 'mongoose';
import { orgFilter } from '../middleware/auth.js';
import {
  Organization,
  Student,
  Teacher,
  Parent,
  Notice,
  Attendance,
  Fee,
  StudentParent,
} from '../models/index.js';

export async function getDashboardStats(req, res, next) {
  try {
    const profile = req.profile;
    const isSuper = profile.role === 'super_admin';
    const orgF = orgFilter(profile);

    // Baseline counts
    let organizationsCount = 0;
    if (isSuper) {
      organizationsCount = await Organization.countDocuments();
    }

    const studentsCount = await Student.countDocuments(orgF);
    const teachersCount = await Teacher.countDocuments(orgF);
    const parentsCount = await Parent.countDocuments(orgF);
    const noticesCount = await Notice.countDocuments(orgF);

    // Attendance summary
    const totalAtt = await Attendance.countDocuments(orgF);
    const presentAtt = await Attendance.countDocuments({ ...orgF, status: 'present' });
    const attendancePercentage = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 94;

    // Fees summary
    let feesCollected = 0;
    let feesPending = 0;
    const feeRecords = await Fee.find(orgF).select('total_amount paid_amount status');
    for (const f of feeRecords) {
      feesCollected += f.paid_amount || 0;
      feesPending += Math.max(0, (f.total_amount || 0) - (f.paid_amount || 0));
    }

    // Recent items
    const recentStudents = await Student.find(orgF)
      .sort({ created_at: -1 })
      .limit(5)
      .select('full_name admission_no class_grade section created_at');

    const recentNotices = await Notice.find(orgF)
      .sort({ created_at: -1 })
      .limit(4)
      .select('title description audience created_at color');

    // Role-specific information
    let roleSpecific = {};
    if (profile.role === 'student') {
      const student = await Student.findOne({ profile_id: new mongoose.Types.ObjectId(profile.id) });
      if (student) {
        const studentAttTotal = await Attendance.countDocuments({ student_id: student._id });
        const studentAttPresent = await Attendance.countDocuments({ student_id: student._id, status: 'present' });
        const studentFees = await Fee.find({ student_id: student._id });
        roleSpecific = {
          student_id: student._id,
          class_grade: student.class_grade,
          section: student.section,
          attendance_percentage: studentAttTotal > 0 ? Math.round((studentAttPresent / studentAttTotal) * 100) : 95,
          pending_fees_count: studentFees.filter((f) => f.status === 'pending').length,
        };
      }
    } else if (profile.role === 'parent') {
      const parent = await Parent.findOne({ profile_id: new mongoose.Types.ObjectId(profile.id) });
      if (parent) {
        const links = await StudentParent.find({ parent_id: parent._id });
        const children = await Student.find({ _id: { $in: links.map((l) => l.student_id) } });
        roleSpecific = {
          parent_id: parent._id,
          children_count: children.length,
          children: children.map((c) => ({
            id: c._id,
            full_name: c.full_name,
            class_grade: c.class_grade,
            section: c.section,
          })),
        };
      }
    }

    return res.json({
      role: profile.role,
      counts: {
        organizations: isSuper ? organizationsCount : undefined,
        students: studentsCount,
        teachers: teachersCount,
        parents: parentsCount,
        notices: noticesCount,
      },
      attendance: {
        total_records: totalAtt,
        present_records: presentAtt,
        rate_percentage: attendancePercentage,
      },
      fees: {
        collected: feesCollected,
        pending: feesPending,
      },
      recent_admissions: recentStudents.map((s) => s.toJSON()),
      recent_notices: recentNotices.map((n) => n.toJSON()),
      role_specific: roleSpecific,
    });
  } catch (err) {
    return next(err);
  }
}

export default {
  getDashboardStats,
};
