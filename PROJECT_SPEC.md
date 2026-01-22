# REVIVA Internal System (ERP Lite) — Project Specification

## 1. Vision & UI Standards
The REVIVA Internal System is a professional, high-performance ERP Lite designed for 2025. The UI must be clean, utilizing a card-based layout with consistent spacing and the **Reviva Visual Identity**.

### Color System (CSS Variables)
- **Primary / Headers:** `--scampi: #635d9e`
- **Success / Active States:** `--patina: #66a286`
- **Primary Actions / Buttons:** `--picton-blue: #54c0e8`
- **Secondary UI / Sub-headings:** `--hippie-blue: #5f84b5`
- **Accents & Icons:** `--juniper: #658a8e`, `--fountain-blue: #5bb4c2`, `--breaker-bay: #63a597`

---

## 2. Technical Stack
- **Backend:** Node.js + Express.js.
- **Database:** Supabase (PostgreSQL) via `@supabase/supabase-js` using the `SERVICE_ROLE_KEY` for secure server-side operations.
- **Frontend:** Vanilla JavaScript (ES6 Modules), Tailwind CSS (via CDN), HTML5.
- **File Storage:** Supabase Storage (`documents` bucket).

---

## 3. Core Module: Project Details
The Project Details page is the central hub for operational tracking. It must support the following functional blocks:

### A. General Information & Metadata
- **Project Header:** Real-time editing for Project Name, Value (SAR), and Status.
- **Timeline Fields:** Start Date, Target End Date, and Description.
- **PM Assignment:** Searchable dropdown populated from the `profiles` table.

### B. Team Management
- **Interface:** Multi-select user interface to add staff to the project.
- **Data Model:** Must capture `user_id`, `role_in_project`, and optional `member_role`.

### C. Task Management & Timeline
- **CRUD Operations:** Tasks including Name, Start/Due Date, Status, and Priority.
- **Visualisation:** A simple CSS-based Gantt chart representing the project roadmap.

### D. File & Document Management
- **Storage:** Real file uploads to Supabase `documents` bucket.
- **Flow:** 1. Upload binary to storage.
    2. Create record in `documents` table.
    3. Link record in `project_documents` junction table.

### E. Partners & Procurement
- **Categorization:** Logic to handle `LAB` or `SUBCONTRACTOR` partner types.
- **Procurement Workflow:** Management of rows for PR (Purchase Request), PO (Purchase Order), and SEC (Service Entry Sheet) within `project_partner_procurement`.

### F. Financial Tracking
- **Billing:** Tracking of all issued invoices.
- **Collections:** Recording of payments received against project value.

---

## 4. Development Rules
- **No Mocking:** All buttons and forms must connect to valid Express API endpoints. No "Coming Soon" or non-functional UI elements.
- **Language:** The interface is strictly English.
- **Code Standards:** - JavaScript must be modular and clean.
    - API endpoints must match frontend fetch calls exactly.
    - Use human-centric design patterns (clear success/error feedback, loading states).
- **Security:** The backend handles all DB communication; the client never talks directly to the DB with the `anon` key for project management tasks.

---

## 5. Database Schema Reference (Context)
Ensure the following tables are optimized for the queries:
- `projects` (Main project data)
- `profiles` (User data for PM/Team)
- `project_team` (Junction table for staff)
- `tasks` (Timeline items)
- `documents` & `project_documents` (Attachment tracking)
- `project_partner_procurement` (PR/PO/SEC records)
- `invoices` & `payments` (Financial records)
