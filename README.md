# EduCore API (Express + MongoDB)

Production-usable RESTful backend for the EduCore Multi-School Management ERP.

## Quick Start

```bash
cd backend
cp .env.example .env
npm install
npm run dev        # Starts API server on http://localhost:8787
```

## API Documentation (Swagger)

Interactive Swagger UI documentation is available directly in the browser:

- **Swagger UI**: [http://localhost:8787/api/docs](http://localhost:8787/api/docs)
- **OpenAPI 3.0 Spec**: [http://localhost:8787/api/docs.json](http://localhost:8787/api/docs.json)

## Automated Tests

Run the complete automated test suite (in-memory MongoDB, zero external dependencies required):

```bash
npm test
```

Test coverage includes:
- **Authentication**: Admin, Teacher, Student, Parent logins, token verification, invalid credentials.
- **Password Management**: Change password, verify current password, forgot password email dispatch, token reset.
- **Student Admission**: Multi-step student & parent provisioning, bcrypt credential generation, credential email dispatch, duplicate prevention, compensating rollback.
- **Role-Based Authorization & Multi-Tenant Isolation**: School-level data isolation, parent-child restriction (parent can only access linked students), student-self isolation (student can only access own profile).
- **Swagger Documentation**: Verification of OpenAPI 3.0 spec and Swagger UI.

## Core API Endpoints

### Authentication & Account
| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Log in with email & password |
| `POST` | `/api/auth/register` | Bearer (Admin / Super Admin) | Register organization user |
| `POST` | `/api/auth/change-password` | Bearer (Any authenticated user) | Verify current password and set new password |
| `POST` | `/api/auth/forgot-password` | Public | Request password reset token via email |
| `POST` | `/api/auth/reset-password` | Public | Reset password with token |
| `GET` | `/api/auth/me` | Bearer | Current user profile |
| `POST` | `/api/auth/logout` | Optional Bearer | Invalidate / log out |

### Student Admission
| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/admissions` | Bearer (Admin / Super Admin) | Provision student, parent, link them, generate credentials, send email |

### Resources (Organization Scoped)
| Resource | Base Path | Methods | Scoping |
| :--- | :--- | :--- | :--- |
| **Students** | `/api/students` | `GET`, `POST`, `PUT`, `DELETE` | Scoped to school; parent sees linked children; student sees self |
| **Teachers** | `/api/teachers` | `GET`, `POST`, `PUT`, `DELETE` | Scoped to school |
| **Parents** | `/api/parents` | `GET`, `POST`, `PUT`, `DELETE` | Scoped to school; parent sees self |
| **Classes** | `/api/classes` | `GET`, `POST`, `PUT`, `DELETE` | Scoped to school |
| **Organizations**| `/api/organizations`| `GET`, `POST`, `PUT`, `DELETE` | Super Admin manages all; Admin views own school |
| **Notices** | `/api/notices` | `GET`, `POST`, `PUT`, `DELETE` | Scoped to school & audience (Everyone, Teachers, Parents, Students) |
| **Attendance** | `/api/attendance` | `GET`, `POST` | Batch & single attendance marking; auto-filters for student/parent |
| **Attendance Stats** | `/api/attendance/stats` | `GET` | Overall & class attendance counts and rates |
| **Fees** | `/api/fees` | `GET`, `POST` | Fee invoices with status ('Paid', 'Pending', 'Overdue', 'Partial') |
| **Fee Payment** | `/api/fees/:id/pay` | `POST` | Record payment installments; student/parent scoped |
| **Fee Stats** | `/api/fees/stats` | `GET` | School fee totals, paid amount, pending amount |
| **Exams** | `/api/exams` | `GET`, `POST` | Exam schedules filtered by grade/term |
| **Results** | `/api/exams/results` | `GET`, `POST` | Record marks with auto-calculated grades; student/parent isolation |
| **Timetable** | `/api/timetable` | `GET`, `POST`, `DELETE` | Class schedule management; students/parents auto-resolve to class |
| **Dashboard** | `/api/dashboard/stats` | `GET` | Unified dashboard stats tailored to caller's role |

## Seed Demo Data

Wipes and resets demo data for Greenwood Academy (`GWA`) and Sunrise Public School (`SPS`):

```bash
npm run seed
```

Demo Logins (password: `password123`):
- Super Admin: `superadmin@educore.edu`
- School Admin: `admin@greenwood.edu`
- Teacher: `sarah.j@greenwood.edu`
- Student: `rahul.k@greenwood.edu`
- Parent: `rajesh.k@greenwood.edu`
