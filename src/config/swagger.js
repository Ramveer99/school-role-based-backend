import swaggerUi from 'swagger-ui-express';

export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'EduCore — School Management System API',
    version: '1.0.0',
    description: `
Production-grade RESTful API for EduCore multi-school ERP management system.
Built with Node.js, Express, MongoDB, Mongoose, and JWT authentication.

### Multi-Tenant Organization Scoping
Every school is represented as an **Organization**. All user interactions are scoped strictly to the user's assigned organization context (derived from their authenticated JWT Profile).

### Core Roles
- **super_admin**: Platform-wide oversight and organization creation.
- **admin**: School-level administrator. Manages students, admissions, teachers, parents, and classes.
- **teacher**: Academic staff. Accesses assigned classes and student records.
- **student**: Enrolled student. Can only access their own profile, class, notices, and attendance.
- **parent**: Parent/Guardian. Can only access records of their linked children.
    `,
  },
  servers: [
    {
      url: '/api',
      description: 'Default API Base Path',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your Bearer JWT token received from /auth/login',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'Descriptive error message' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@greenwood.edu' },
          password: { type: 'string', example: 'password123' },
        },
      },
      ChangePasswordRequest: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', example: 'temporaryPassword123!' },
          newPassword: { type: 'string', minLength: 6, example: 'NewSecretPass@2026' },
        },
      },
      ForgotPasswordRequest: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@greenwood.edu' },
        },
      },
      ResetPasswordRequest: {
        type: 'object',
        required: ['token', 'password'],
        properties: {
          token: { type: 'string', example: '7a8f9c0e...' },
          password: { type: 'string', minLength: 8, example: 'brandNewSecurePass123' },
        },
      },
      AdmissionRequest: {
        type: 'object',
        required: ['student'],
        properties: {
          organization_id: {
            type: 'string',
            description: 'Optional for Admin (defaults to current school). Required for Super Admin.',
          },
          student: {
            type: 'object',
            required: ['full_name', 'admission_no', 'email'],
            properties: {
              full_name: { type: 'string', example: 'Aarav Patel' },
              admission_no: { type: 'string', example: 'ADM-2026-009' },
              email: { type: 'string', format: 'email', example: 'aarav.p@greenwood.edu' },
              roll_no: { type: 'string', example: '15' },
              class_grade: { type: 'string', example: '10' },
              section: { type: 'string', example: 'A' },
              gender: { type: 'string', enum: ['Male', 'Female', 'Other'], example: 'Male' },
              dob: { type: 'string', format: 'date', example: '2010-06-15' },
              phone: { type: 'string', example: '+91 98765 43210' },
              address: { type: 'string', example: '12 Sector 4, New Delhi' },
              teacher_id: { type: 'string', example: '60d0fe4f5311236168a109ca' },
            },
          },
          parent: {
            type: 'object',
            description: 'Used when creating a new parent account',
            properties: {
              full_name: { type: 'string', example: 'Sunil Patel' },
              email: { type: 'string', format: 'email', example: 'sunil.p@example.com' },
              phone: { type: 'string', example: '+91 98765 00000' },
              occupation: { type: 'string', example: 'Architect' },
              address: { type: 'string', example: '12 Sector 4, New Delhi' },
            },
          },
          parent_id: {
            type: 'string',
            description: 'Used when linking a sibling to an existing registered parent',
            example: '60d0fe4f5311236168a109cb',
          },
        },
      },
      MarkAttendanceRequest: {
        type: 'object',
        properties: {
          class_grade: { type: 'string', example: '10' },
          section: { type: 'string', example: 'A' },
          date: { type: 'string', format: 'date', example: '2026-09-24' },
          records: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                student_id: { type: 'string', example: '60d0fe4f5311236168a109cc' },
                status: { type: 'string', enum: ['present', 'absent', 'late', 'excused'], example: 'present' },
                remarks: { type: 'string', example: 'On time' },
              },
            },
          },
          student_id: { type: 'string', description: 'Used for single student marking' },
          status: { type: 'string', enum: ['present', 'absent', 'late', 'excused'] },
        },
      },
      UpdateAttendanceRequest: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['present', 'absent', 'late', 'excused'], example: 'absent' },
          remarks: { type: 'string', example: 'Sick leave' },
          class_grade: { type: 'string', example: '10' },
          section: { type: 'string', example: 'A' },
          date: { type: 'string', format: 'date', example: '2026-09-24' },
        },
      },
      CreateFeeRequest: {
        type: 'object',
        required: ['student_id', 'title', 'total_amount', 'due_date'],
        properties: {
          student_id: { type: 'string', example: '60d0fe4f5311236168a109cc' },
          title: { type: 'string', example: 'Term 1 Tuition Fee' },
          fee_type: { type: 'string', example: 'Tuition' },
          academic_year: { type: 'string', example: '2025-2026' },
          total_amount: { type: 'number', example: 45000 },
          due_date: { type: 'string', format: 'date', example: '2026-10-15' },
        },
      },
      UpdateFeeRequest: {
        type: 'object',
        properties: {
          title: { type: 'string', example: 'Term 1 Tuition Fee' },
          fee_type: { type: 'string', example: 'Tuition' },
          academic_year: { type: 'string', example: '2025-2026' },
          total_amount: { type: 'number', example: 45000 },
          paid_amount: { type: 'number', example: 15000 },
          due_date: { type: 'string', format: 'date', example: '2026-10-15' },
          status: { type: 'string', enum: ['Paid', 'Pending', 'Overdue', 'Partial'] },
        },
      },
      PayFeeRequest: {
        type: 'object',
        required: ['amount'],
        properties: {
          amount: { type: 'number', example: 15000 },
          payment_method: { type: 'string', example: 'Online' },
          transaction_id: { type: 'string', example: 'TXN-984321798' },
        },
      },
      CreateExamRequest: {
        type: 'object',
        required: ['title', 'class_grade', 'subject', 'date'],
        properties: {
          title: { type: 'string', example: 'Mid-Term Mathematics' },
          term: { type: 'string', example: 'Term 1' },
          class_grade: { type: 'string', example: '10' },
          subject: { type: 'string', example: 'Mathematics' },
          date: { type: 'string', format: 'date', example: '2026-10-20' },
          start_time: { type: 'string', example: '09:00 AM' },
          duration: { type: 'string', example: '2.5 Hours' },
          total_marks: { type: 'number', example: 100 },
          passing_marks: { type: 'number', example: 35 },
        },
      },
      RecordResultRequest: {
        type: 'object',
        required: ['exam_id', 'student_id', 'marks_obtained'],
        properties: {
          exam_id: { type: 'string', example: '60d0fe4f5311236168a109cd' },
          student_id: { type: 'string', example: '60d0fe4f5311236168a109cc' },
          marks_obtained: { type: 'number', example: 88 },
          grade: { type: 'string', example: 'A' },
          remarks: { type: 'string', example: 'Excellent conceptual clarity' },
        },
      },
      SaveTimetableRequest: {
        type: 'object',
        required: ['class_grade', 'section', 'schedule'],
        properties: {
          class_grade: { type: 'string', example: '10' },
          section: { type: 'string', example: 'A' },
          schedule: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                time: { type: 'string', example: '09:00 - 09:45' },
                mon: { type: 'string', example: 'Math' },
                tue: { type: 'string', example: 'Science' },
                wed: { type: 'string', example: 'English' },
                thu: { type: 'string', example: 'Social' },
                fri: { type: 'string', example: 'Math' },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Log in with email and password',
        description: 'Authenticates a user and returns a signed JWT token along with user profile metadata.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          200: { description: 'Login successful' },
          401: { description: 'Invalid email or password' },
        },
      },
    },
    '/auth/change-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Change password for authenticated user',
        description: 'Allows Student, Parent, Teacher, or Admin to update their temporary or existing password.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ChangePasswordRequest' } } },
        },
        responses: {
          200: { description: 'Password changed successfully' },
          400: { description: 'Incorrect current password or invalid new password' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Request password reset token via email',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ForgotPasswordRequest' } } },
        },
        responses: {
          200: { description: 'Reset email dispatched if email exists' },
        },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Reset password using token',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ResetPasswordRequest' } } },
        },
        responses: {
          200: { description: 'Password reset successful' },
          400: { description: 'Invalid or expired reset token' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current authenticated user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Current profile details' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/admissions': {
      post: {
        tags: ['Admissions'],
        summary: 'Process student admission & auto-provision accounts',
        description: `
Complete multi-step admission flow:
1. Validates student and parent data.
2. Generates secure temporary credentials for student and parent.
3. Provisions Student User + Profile + Student record.
4. Provisions Parent User + Profile + Parent record (or links existing parent).
5. Links Student and Parent via StudentParent relationship.
6. Links or provisions the Class record.
7. Automatically dispatches welcome login emails with temporary credentials.
8. Plaintext passwords are NEVER stored or returned in API responses.
        `,
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AdmissionRequest' } } },
        },
        responses: {
          201: { description: 'Admission processed and credentials emailed successfully' },
          400: { description: 'Validation error' },
          403: { description: 'Forbidden (Admin or Super Admin required)' },
          409: { description: 'Duplicate admission number or email conflict' },
        },
      },
    },
    '/students': {
      get: {
        tags: ['Students'],
        summary: 'List students (strictly organization and role-scoped)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Array of student records' } },
      },
      post: {
        tags: ['Students'],
        summary: 'Create student record directly (Admin only)',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Student created' } },
      },
    },
    '/students/{id}': {
      get: {
        tags: ['Students'],
        summary: 'Get student details (enforces parent-child & student-self isolation)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Student details' },
          403: { description: 'Forbidden: Access denied to other students' },
          404: { description: 'Student not found' },
        },
      },
      put: {
        tags: ['Students'],
        summary: 'Update student record (Admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Student updated' } },
      },
      delete: {
        tags: ['Students'],
        summary: 'Delete student record and parent links (Admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Student deleted' } },
      },
    },
    '/teachers': {
      get: {
        tags: ['Teachers'],
        summary: 'List teachers in organization',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Array of teacher records' } },
      },
      post: {
        tags: ['Teachers'],
        summary: 'Create teacher account (Admin only)',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Teacher created' } },
      },
    },
    '/teachers/{id}': {
      get: {
        tags: ['Teachers'],
        summary: 'Get teacher details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Teacher details' } },
      },
      put: {
        tags: ['Teachers'],
        summary: 'Update teacher record',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Teacher updated' } },
      },
      delete: {
        tags: ['Teachers'],
        summary: 'Delete teacher record',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Teacher deleted' } },
      },
    },
    '/parents': {
      get: {
        tags: ['Parents'],
        summary: 'List parents (Parent role sees only own account)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Array of parents with linked children' } },
      },
      post: {
        tags: ['Parents'],
        summary: 'Create parent account (Admin only)',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Parent created' } },
      },
    },
    '/parents/{id}': {
      get: {
        tags: ['Parents'],
        summary: 'Get parent details with linked children',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Parent details' } },
      },
      put: {
        tags: ['Parents'],
        summary: 'Update parent details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Parent updated' } },
      },
      delete: {
        tags: ['Parents'],
        summary: 'Delete parent record',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Parent deleted' } },
      },
    },
    '/classes': {
      get: {
        tags: ['Classes'],
        summary: 'List classes with teacher and student count (organization-scoped)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Array of classes' } },
      },
      post: {
        tags: ['Classes'],
        summary: 'Create class (Admin only)',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Class created' } },
      },
    },
    '/classes/{id}': {
      get: {
        tags: ['Classes'],
        summary: 'Get class details and enrolled students',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Class details' } },
      },
      put: {
        tags: ['Classes'],
        summary: 'Update class',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Class updated' } },
      },
      delete: {
        tags: ['Classes'],
        summary: 'Delete class',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Class deleted' } },
      },
    },
    '/organizations': {
      get: {
        tags: ['Organizations'],
        summary: 'List all organizations with stats (Super Admin only)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Array of organizations with statistics' } },
      },
      post: {
        tags: ['Organizations'],
        summary: 'Create organization / school (Super Admin only)',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Organization created' } },
      },
    },
    '/organizations/{id}': {
      get: {
        tags: ['Organizations'],
        summary: 'Get organization details (Super Admin or School Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Organization details' } },
      },
      put: {
        tags: ['Organizations'],
        summary: 'Update organization information',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Organization updated' } },
      },
      delete: {
        tags: ['Organizations'],
        summary: 'Delete organization (Super Admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Organization deleted' } },
      },
    },
    '/notices': {
      get: {
        tags: ['Notices'],
        summary: 'List notices filtered by audience and organization',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Array of notices' } },
      },
      post: {
        tags: ['Notices'],
        summary: 'Create notice announcement (Admin, Teacher, Super Admin)',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Notice created' } },
      },
    },
    '/notices/{id}': {
      get: {
        tags: ['Notices'],
        summary: 'Get notice by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Notice details' } },
      },
      put: {
        tags: ['Notices'],
        summary: 'Update notice',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Notice updated' } },
      },
      delete: {
        tags: ['Notices'],
        summary: 'Delete notice',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Notice deleted' } },
      },
    },
    '/attendance': {
      get: {
        tags: ['Attendance'],
        summary: 'Get attendance records (supports class_grade, section, date, student_id filtering)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'class_grade', in: 'query', schema: { type: 'string' } },
          { name: 'section', in: 'query', schema: { type: 'string' } },
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'student_id', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Array of attendance records' } },
      },
      post: {
        tags: ['Attendance'],
        summary: 'Mark attendance (supports single record or batch array in body)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/MarkAttendanceRequest' } } },
        },
        responses: { 200: { description: 'Attendance marked' }, 201: { description: 'Record created' } },
      },
    },
    '/attendance/{id}': {
      put: {
        tags: ['Attendance'],
        summary: 'Update attendance record (Admin or Teacher only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateAttendanceRequest' } } },
        },
        responses: { 200: { description: 'Attendance record updated' } },
      },
    },
    '/attendance/stats': {
      get: {
        tags: ['Attendance'],
        summary: 'Get attendance statistics and percentage',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'class_grade', in: 'query', schema: { type: 'string' } },
          { name: 'section', in: 'query', schema: { type: 'string' } },
          { name: 'student_id', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Attendance statistics' } },
      },
    },
    '/fees': {
      get: {
        tags: ['Fees'],
        summary: 'List fee invoices (filtered by student_id or status, scoped by role)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'student_id', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['Paid', 'Pending', 'Overdue', 'Partial'] } },
        ],
        responses: { 200: { description: 'Array of fee records' } },
      },
      post: {
        tags: ['Fees'],
        summary: 'Create fee invoice (Admin or Super Admin only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateFeeRequest' } } },
        },
        responses: { 201: { description: 'Fee record created' } },
      },
    },
    '/fees/{id}': {
      put: {
        tags: ['Fees'],
        summary: 'Update fee invoice (Admin or Super Admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateFeeRequest' } } },
        },
        responses: { 200: { description: 'Fee record updated' } },
      },
    },
    '/fees/{id}/pay': {
      post: {
        tags: ['Fees'],
        summary: 'Record fee payment installment or full payment',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PayFeeRequest' } } },
        },
        responses: { 200: { description: 'Payment recorded' } },
      },
    },
    '/fees/stats': {
      get: {
        tags: ['Fees'],
        summary: 'Get fee collection and outstanding summary stats',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Fee summary metrics' } },
      },
    },
    '/exams': {
      get: {
        tags: ['Exams'],
        summary: 'List scheduled exams (supports class_grade and term filters)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'class_grade', in: 'query', schema: { type: 'string' } },
          { name: 'term', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Array of exams' } },
      },
      post: {
        tags: ['Exams'],
        summary: 'Schedule new exam (Admin, Teacher, or Super Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateExamRequest' } } },
        },
        responses: { 201: { description: 'Exam scheduled' } },
      },
      put: {
        tags: ['Exams'],
        summary: 'Update exam by ID in body (Admin, Teacher, or Super Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/CreateExamRequest' }, { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }] } } },
        },
        responses: { 200: { description: 'Exam updated' } },
      },
      delete: {
        tags: ['Exams'],
        summary: 'Delete exam by ID in body (Admin, Teacher, or Super Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Exam deleted' } },
      },
    },
    '/exams/{id}': {
      get: {
        tags: ['Exams'],
        summary: 'Get exam by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Exam details' } },
      },
      put: {
        tags: ['Exams'],
        summary: 'Update exam (Admin, Teacher, or Super Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateExamRequest' } } },
        },
        responses: { 200: { description: 'Exam updated' } },
      },
      delete: {
        tags: ['Exams'],
        summary: 'Delete exam (Admin, Teacher, or Super Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Exam deleted' } },
      },
    },
    '/exams/results': {
      get: {
        tags: ['Exams'],
        summary: 'Get student exam results (scoped by role: Student gets own, Parent gets child, Admin/Teacher get class)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'exam_id', in: 'query', schema: { type: 'string' } },
          { name: 'student_id', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Array of exam results' } },
      },
      post: {
        tags: ['Exams'],
        summary: 'Record or update exam marks for student (Admin, Teacher)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RecordResultRequest' } } },
        },
        responses: { 201: { description: 'Result recorded' } },
      },
    },
    '/timetable': {
      get: {
        tags: ['Timetable'],
        summary: 'Get class timetable schedules (students and parents auto-filter to enrolled class)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'class_grade', in: 'query', schema: { type: 'string' } },
          { name: 'section', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Array of class timetables' } },
      },
      post: {
        tags: ['Timetable'],
        summary: 'Create or update class timetable (Admin or Teacher)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SaveTimetableRequest' } } },
        },
        responses: { 200: { description: 'Timetable saved' } },
      },
    },
    '/timetable/{id}': {
      get: {
        tags: ['Timetable'],
        summary: 'Get timetable by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Timetable record' } },
      },
      delete: {
        tags: ['Timetable'],
        summary: 'Delete timetable (Admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Timetable deleted' } },
      },
    },
    '/dashboard/stats': {
      get: {
        tags: ['Dashboard'],
        summary: 'Get unified dashboard metrics and widgets tailored to authenticated role',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Dashboard metrics object' } },
      },
    },
  },
};

export function setupSwagger(app) {
  app.get('/api/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerDocument);
  });

  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'EduCore API Documentation',
    })
  );
}

export default setupSwagger;
