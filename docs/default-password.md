# School default passwords

One default password belongs to each school. An admin can read/set only their own school's default; a super admin can read/set any school's default. Teachers, students, and parents cannot access this setting.

## API

Send `Authorization: Bearer <token>` on both endpoints.

- `GET /api/organizations/:id/default-password` returns the current default. On first use, a random default is generated and persisted for the school.
- `PUT /api/organizations/:id/default-password` sets the default:

```json
{ "default_password": "SchoolWelcome123!" }
```

Both return HTTP 200:

```json
{
  "organization_id": "<school-id>",
  "default_password": "SchoolWelcome123!"
}
```

Responses use `Cache-Control: no-store`. Invalid IDs/passwords return 400; unauthenticated requests return 401; unauthorized roles or schools return 403; missing schools return 404. The password must have at least 8 characters, fit within 72 UTF-8 bytes (bcrypt's limit), be nonblank, and not start with a bcrypt hash prefix. Passwords are used exactly as submitted, without trimming.

## Creation behavior

The school default is used by existing and school-specific teacher, parent, and student creation routes, student admissions, and organization creation with an initial administrator. It also applies to `/api/auth/register` when `password` is omitted. An explicit password remains supported for teacher creation and `/api/auth/register`, taking precedence over the school default. Student/parent creation retains its existing request contract and uses the school default rather than a supplied password.

Student and parent credential emails contain the assigned school default. Existing parent records reused during admission keep their existing credentials. Changing the default does not reset any existing user's password or change user-initiated password changes/resets. The setting can be read after creating a school to retrieve its initial administrator password.

## Storage and configuration

Individual user passwords remain bcrypt hashes. The retrievable default is stored separately in `organizationpasswordsettings`, encrypted with AES-256-GCM, and is not included in normal organization, member, profile, or login responses. Generic organization updates cannot set this value.

The optional server environment variable `DEFAULT_PASSWORD_ENCRYPTION_KEY` supplies the encryption secret. If omitted, the existing `JWT_SECRET` is used with a purpose-specific key derivation. Use a stable secret: changing the effective encryption secret makes previously stored defaults unreadable until an authorized admin sets each school's default again. Existing user logins are unaffected by this setting encryption, though changing JWT_SECRET separately invalidates existing tokens.

No frontend files were changed. The frontend can call these APIs to display or edit the school's default password.

Verification: all 39 backend tests pass, including default retrieval/update authorization, encryption and response isolation, creation/login across schools and roles, explicit-password precedence, and preservation of existing credentials.
