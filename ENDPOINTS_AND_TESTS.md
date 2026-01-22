# Project Details Endpoints and Curl Tests

## Base URL
```
http://127.0.0.1:4000
```

## Authentication
All endpoints require a Bearer token. Replace `YOUR_TOKEN` with your actual JWT token.

---

## 1. GET /api/project-execution/:id
Get project details by ID.

```bash
curl -X GET "http://127.0.0.1:4000/api/project-execution/PROJECT_ID_HERE" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Response fields include:**
- `id`, `name`, `title`, `description`, `status`
- `project_code`, `project_manager_user_id`
- `start_date`, `target_end_date`
- `value_sar` (numeric, nullable)
- `created_at`, `updated_at`

---

## 2. PATCH /api/project-execution/:id
Update project basics (requires ADMIN or MANAGER role).

**Allowed fields:**
- `name`, `title`, `description`, `status`
- `project_code`, `project_manager_user_id`
- `start_date`, `target_end_date`
- `value_sar` (numeric, nullable)

```bash
curl -X PATCH "http://127.0.0.1:4000/api/project-execution/PROJECT_ID_HERE" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Project Name",
    "status": "ACTIVE",
    "value_sar": 50000.00,
    "start_date": "2026-01-15",
    "target_end_date": "2026-06-30",
    "description": "Updated description",
    "project_manager_user_id": "USER_ID_HERE"
  }'
```

---

## 3. GET /api/project-execution/:id/team
Get project team members.

```bash
curl -X GET "http://127.0.0.1:4000/api/project-execution/PROJECT_ID_HERE/team" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Response includes:**
- Team member details with `profiles` relation (id, email, full_name, role)
- `role_in_project` (LEAD, MEMBER, SUPPORT)
- `member_role` (optional string)

---

## 4. POST /api/project-execution/:id/team
Add team members (requires ADMIN or MANAGER role).

**Body:**
- `user_ids` (array of user IDs, required)
- `role_in_project` (string, required: LEAD, MEMBER, or SUPPORT)
- `member_role` (string, optional)

```bash
curl -X POST "http://127.0.0.1:4000/api/project-execution/PROJECT_ID_HERE/team" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_ids": ["USER_ID_1", "USER_ID_2"],
    "role_in_project": "MEMBER",
    "member_role": "Senior Engineer"
  }'
```

---

## 5. DELETE /api/project-execution/:id/team/:userId
Remove a team member (requires ADMIN or MANAGER role).

```bash
curl -X DELETE "http://127.0.0.1:4000/api/project-execution/PROJECT_ID_HERE/team/USER_ID_HERE" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

---

## 6. GET /api/users/directory
Get all profiles for dropdowns (id, email, full_name, role).

```bash
curl -X GET "http://127.0.0.1:4000/api/users/directory" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:** Array of profiles with:
- `id`, `email`, `full_name`, `role`

---

## Additional Endpoints (Already Implemented)

### POST /api/project-execution/:id/close
Close a project (requires ADMIN or MANAGER).

```bash
curl -X POST "http://127.0.0.1:4000/api/project-execution/PROJECT_ID_HERE/close" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Closing notes here"}'
```

### POST /api/project-execution/:id/archive
Archive a project (requires ADMIN or MANAGER).

```bash
curl -X POST "http://127.0.0.1:4000/api/project-execution/PROJECT_ID_HERE/archive" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Quick Test Sequence

1. **Get your token** (login first):
```bash
curl -X POST "http://127.0.0.1:4000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com", "password": "yourpassword"}'
```

2. **Get users directory**:
```bash
curl -X GET "http://127.0.0.1:4000/api/users/directory" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. **Get project**:
```bash
curl -X GET "http://127.0.0.1:4000/api/project-execution/PROJECT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

4. **Update project basics**:
```bash
curl -X PATCH "http://127.0.0.1:4000/api/project-execution/PROJECT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project", "value_sar": 100000, "status": "ACTIVE"}'
```

5. **Get team**:
```bash
curl -X GET "http://127.0.0.1:4000/api/project-execution/PROJECT_ID/team" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

6. **Add team members**:
```bash
curl -X POST "http://127.0.0.1:4000/api/project-execution/PROJECT_ID/team" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_ids": ["USER_ID"], "role_in_project": "MEMBER", "member_role": "Engineer"}'
```

7. **Remove team member**:
```bash
curl -X DELETE "http://127.0.0.1:4000/api/project-execution/PROJECT_ID/team/USER_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Notes

- All endpoints require authentication (Bearer token).
- PATCH, POST, and DELETE operations on project execution require ADMIN or MANAGER role.
- `value_sar` is a numeric field (nullable) representing project value in SAR.
- `role_in_project` defaults to 'MEMBER' if not provided.
- `member_role` is optional and can be any string.
