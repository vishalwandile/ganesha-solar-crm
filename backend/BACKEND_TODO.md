# Ganesha Solar Services CRM — Backend TODO

Tracks the Node/Express + PostgreSQL backend build. Pairs with `db/schema.sql`, the frontend `TODO.md`/`FRONTEND.md`, and the requirements doc (`docs/ganesha_solar_crm_v1_todo.md`, Section 21) which specifies the recommended stack: **React (Vercel/Netlify) + Node/Express (Render) + Supabase (Postgres + Storage)**, targeting $0/month at current scale (4-5 users, ~100 customers/month).

---

## 1. Database

- [x] Schema drafted (`db/schema.sql`) — covers users, teams, per-user category permissions, category/sub-stage config tables, customers, per-customer category + sub-stage tracking, documents, photos, payments, activity log, notifications.
- [ ] Stand up a Supabase project, run `schema.sql` against it (`npm run db:push`).
- [x] Seed `category_definitions` and `stage_definitions` included in schema — keys map to frontend via API layer (`src/lib/keys.js`).
- [x] Migration tooling for V1: plain SQL file (`db/schema.sql` + `npm run db:push`). Revisit when schema needs iterative changes.
- [ ] Set up Supabase Storage buckets for `documents` and `photos` (API falls back to local `uploads/` until configured).
- [ ] Confirm backup/retention plan — Supabase's free tier plan for backups should be checked before relying on it for real customer data.

## 2. Project setup

- [x] Initialize Node/Express project (`backend/` with express, pg, zod, jwt, bcryptjs, multer, etc.).
- [x] **Decided: `pg` + SQL schema file** (schema.sql is source of truth; avoids duplicating schema in an ORM for V1).
- [x] Environment config: `.env.example` for `DATABASE_URL`, `JWT_SECRET`, Supabase Storage keys.
- [x] CORS setup for configured frontend origin(s).
- [x] Request logging (`morgan`) + error-handling middleware.

## 3. Authentication

- [x] Username/password login endpoint (`POST /auth/login`).
- [x] Password hashing with `bcryptjs`.
- [x] **Decided: JWT** (httpOnly cookie + Bearer token) — stateless for Render free tier.
- [x] `POST /auth/logout`.
- [x] Auth middleware protecting all `/api/*` routes.
- [x] Seed users script (`npm run seed`) — Admin + Office/Sales/Account/Installation demos.

## 4. Permissions enforcement

- [x] `canEditCategory` / `requireCategoryEdit` checks `user_category_permissions`.
- [x] Admin bypasses all permission checks.
- [x] **Default: no permission row ⇒ view-only** (cannot edit).
- [x] `GET /api/users` / `POST /api/users` / `PATCH /api/users/:id/permissions`.

## 5. Core API endpoints

**Dashboard**
- [x] `GET /api/dashboard/summary`
- [x] `GET /api/customers/quick-lookup?query=`
- [x] `GET /api/activity/recent`

**Customer list**
- [x] `GET /api/customers?search=`

**Create customer**
- [x] `POST /api/customers` — creates categories for non-optional stages; optional Name Change via `enableNameChange`.
- [x] Name Change can also be enabled/disabled later from detail (`…/categories/nameChange/enable|disable`).
- [x] Document upload (`POST /api/customers/:id/documents`) — Supabase Storage or local fallback.

**Customer detail**
- [x] `GET /api/customers/:id`
- [x] `PATCH /api/customers/:id/categories/:category/sub-stages/:subStageKey` (+ activity + notification on category status change)
- [x] `PATCH /api/customers/:id/categories/:category/notes`
- [x] Roll-up `getCategoryStatus()` ported to backend
- [x] Subsidy estimate `calculateExpectedSubsidy()` ported to backend
- [x] Payments + photos + history endpoints

**Notifications**
- [x] `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`

**Users & teams**
- [x] `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id/permissions`

## 6. Validation & data integrity

- [x] Validate sub-stage values against `stage_definitions.options`
- [x] Require `rejectionReason` when value is Rejected
- [x] Friendly consumer number uniqueness errors
- [x] Validation library: **zod**

## 7. Testing

- [ ] Pick a test runner and add smoke tests for auth + customer CRUD
- [ ] Manual test pass against frontend once wired to this API

## 8. Deployment

- [ ] Push backend to Git, connect Render, set env vars
- [ ] Point frontend API base URL at Render URL
- [ ] Confirm cold-start behavior acceptable
- [ ] Production Supabase project

## 9. Not yet decided (product review)

- [ ] AMC / Service workflow
- [ ] Document verification/status workflow
- [ ] Whether UI should display photo uploader identity (`uploaded_by` already stored)
