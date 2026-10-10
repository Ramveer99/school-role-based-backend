# Super-admin school member APIs

All requests use `Authorization: Bearer <token>`. Only `super_admin` can use the new member routes. The existing organization and global member endpoints retain their behavior.

Start with `GET /api/organizations`, which returns schools with `stats.students`, `stats.teachers`, and `stats.parents`. `GET /api/organizations/:organizationId` returns a school and the same counts. Both responses include `admin_email`, the linked school administrator login email (separate from the school contact `email`). It is `null` when no administrator is linked. If multiple admins exist, the earliest created admin is selected consistently.

For each resource (`students`, `teachers`, `parents`):

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/organizations/:organizationId/:resource` | List this school's members |
| POST | `/api/organizations/:organizationId/:resource` | Create a member in this school |
| GET | `/api/organizations/:organizationId/:resource/:id` | View one member |
| PUT | `/api/organizations/:organizationId/:resource/:id` | Edit a member, including login email/password |
| DELETE | `/api/organizations/:organizationId/:resource/:id` | Delete the member record using existing behavior |

Lists are arrays, with the existing avatar, teacher, and child/parent enrichment. No pagination is introduced. Create responses retain their existing shapes: a teacher object, `{ success, ok, student, parent_id, message }` for students, or `{ success, ok, parent, message }` for new parents. Reusing an existing parent returns its object with HTTP 200. Updates and detail reads return member objects.

The URL supplies `organization_id`. If supplied in JSON, it must match. IDs for another school's members return 404. Invalid IDs/unsupported fields return 400, missing authentication 401, other roles 403, and duplicate accounts 409. Internal fields such as `profile_id`, `_id`, and update operators cannot be submitted. Student `teacher_id` and creation `parent_id` must belong to the selected school.

## Request fields

- All types: `full_name`, `email`, `phone`, `password`.
- Students: `admission_no`, `roll_no`, `class_grade`, `section`, `gender`, `dob`, `address`, `teacher_id`, `status`. Creation additionally accepts `parent_id` or the existing `parent` object (`full_name`, `email`, optional `phone`, `occupation`, `address`).
- Teachers: `employee_id`, `department`, `subjects`, `classes`, `status`, `joining_date`.
- Parents: `occupation`, `address`.
- Creation accepts `avatar_image` as the existing controllers do; student creation does not currently persist this field.

Creation requires full name and email; students additionally require admission number, teachers employee ID. Existing password behavior is retained: students and parents receive the school default credentials by email; teacher creation accepts `password` and otherwise uses the school default. See [default-password.md](default-password.md). `password` on PUT changes the linked login password. Sending `parent_id` on PUT is unsupported; this endpoint does not relink families.

Example: `POST /api/organizations/<school-id>/teachers`

```json
{
  "full_name": "Anita Sharma",
  "email": "anita@example.com",
  "employee_id": "EMP-042",
  "password": "ExamplePassword123!",
  "department": "Mathematics"
}
```

Then `PUT /api/organizations/<school-id>/teachers/<teacher-id>`:

```json
{ "email": "anita.updated@example.com", "password": "NewExamplePassword123!" }
```

## Verification and existing findings

The original 32 tests passed before changes. The expanded 39-test suite (including school default passwords) passes, including authentication, password reset, admission creation, academics, authorization, Swagger, and new organization-member tests. New tests verify all three member types, school isolation, role restrictions, account-link protection, create/edit/delete, and login after email/password edits. Tests use temporary MongoDB and HTTP servers; no production data was changed.

Static frontend review confirms `/api` paths, Bearer-token handling, login response fields, and existing member response shapes match the backend. This is not a live deployed browser/SMTP/database verification. Frontend files were only read. The frontend does not yet call the new school-specific routes.

Existing issues observed and deliberately left unchanged:

- `AddTeacher.jsx` and `AddParent.jsx` do not submit a selected organization. A super-admin without an assigned school cannot create through those existing forms. New nested APIs obtain the school from the URL.
- Existing member deletion removes domain records (and relevant parent/student links), but retains User/Profile login accounts. Deleting a record does not revoke login access.
- School `active` and member `status` are not checked by login/token middleware; they do not suspend accounts.
- Existing `createAuthUser` can overwrite a matching account's role, school, and password. The new member routes reject reuse of another account, while permitting the existing same-school parent reuse flow. Legacy endpoints are unchanged.
- Legacy create/update flows perform multiple database writes without a transaction. Unexpected later failures can leave partial changes. The new routes prevalidate member fields, but do not redesign these flows.
- Legacy update handlers accept internal fields; legacy student creation does not enforce school membership for linked parents/teachers. The new routes reject these inputs. Existing global routes remain unchanged as requested.
- Existing `getMyChildren` allows an admin-supplied parent ID without school scoping. The new routes do not expose that action.

These findings mean passing tests should not be read as a claim that every existing authorization or account-lifecycle case is correct.
