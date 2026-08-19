# Ganesha Solar Services CRM — Frontend TODO

> Tracks what's built in the `ganesha-solar-crm` React/Vite/Tailwind scaffold vs. what's still needed before this becomes a real, deployed product. Pairs with `ganesha_solar_crm_v1_todo.md` (requirements doc) and `FRONTEND.md` (architecture doc).

---

## 0. UI/UX improvement pass (added after reviewing PM Suryaghar's official portal patterns)

- [x] Visual stage tracker at the top of Customer detail — clickable nodes jump to and auto-expand the matching category card, mirroring the official portal's linear stage view.
- [x] Aging indicator per category ("Nd pending" since its status last changed), flagged in red past 14 days.
- [x] Auto-calculated PM Suryaghar subsidy estimate shown next to the Subsidy sub-stage, based on the customer's solar capacity (Rs 30,000/kW up to 2kW, capped at Rs 78,000 for 3kW+) — indicative only, always confirm the sanctioned amount on the official portal.
- [x] Per-category notes field (free text, e.g. "waiting on DISCOM inspection slot") — mirrors the official portal's stage-specific query flags.
- [x] Quick lookup box on the Dashboard — search by consumer number or mobile to see current stage without opening the full profile.
- [ ] Not yet done: WhatsApp/SMS notifications to the customer (the official portal's app-based push notifications) — explicitly out of scope for V1 per the requirements doc, revisit if it becomes a priority.

## 1. Done in this scaffold

- [x] Vite + React + Tailwind project set up and structured (`src/components`, `src/pages`, `src/data`)
- [x] React Router routes for every screen
- [x] Mock login (username/password, no real auth)
- [x] Dashboard — total customers + counts by overall status, recent activity feed
- [x] Customer list — search by name / consumer number / mobile
- [x] Add customer form — all confirmed fields incl. Village/Taluka/District/PIN, electricity connection no., solar capacity/module/inverter, document upload UI (Aadhaar, Electricity bill, Bank passbook)
- [x] Customer detail — tabs: Status tracking, Documents, Payments, Photos, History
- [x] Status tracking — all 6 categories (Name change, Rooftop solar, PM Suryaghar, Finance, Installation, Closure) as expandable cards, per-sub-stage status dropdowns, rejection reason display
- [x] Payments tab — running total vs. amount due, add-payment form (Cash/Bank transfer/Cheque/UPI)
- [x] Photos tab — simple gallery, no categories (per decision)
- [x] History tab — activity log per customer
- [x] Users & teams page — user list with per-user edit permissions (display only)
- [x] Notifications page — read/unread state, mark-all-read
- [x] Single mock data file (`src/data/mockData.js`) driving all screens

## 2. Known gaps in this scaffold (needs your review)

- [ ] **Not verified with `npm install` / `npm run dev`** — this sandbox has no network access, so the build was checked for syntax only, not actually run. Run it locally first and flag anything broken.
- [ ] No real backend — all edits (status changes, new payments, new customers) are local React state and reset on page refresh.
- [ ] No permission enforcement — every logged-in user can currently edit every category, regardless of what the Users & teams page says. Needs to be wired once real auth/roles exist.
- [ ] "Add customer" doesn't actually create a customer in the list — it shows a save confirmation and redirects, but the new record isn't persisted anywhere.
- [ ] Document/photo upload inputs are placeholders — no actual file storage wired up.
- [ ] No pagination on the customer list — fine at ~100 customers/month scale for now, worth revisiting if the list grows past a page or two.
- [ ] No mobile-specific layout pass — Tailwind classes are reasonably responsive but not explicitly tested at small widths.
- [ ] No loading states, error states, or empty-state polish beyond the basics already in Payments/Photos/Documents tabs.
- [ ] No AMC/Service screen yet (Section 15 of requirements doc — workflow still undefined there too).

## 3. Next build phase — backend & integration

- [ ] Finalize database schema (customers, categories/sub-stages, payments, documents, photos, users, activity log) — see requirements doc Section 21 for the recommended stack (React + Node/Express + Supabase Postgres/Storage).
- [ ] Design REST (or similar) API endpoints for each screen's data needs.
- [ ] Replace mock login with real username/password auth + sessions against the users table.
- [ ] Wire Documents/Photos tabs to real file storage (Supabase Storage).
- [ ] Wire Status tracking, Payments, and Add customer forms to real API calls instead of local state.
- [ ] Enforce per-user permissions from the Users & teams page in the UI (hide/disable controls a user can't edit).
- [ ] Deploy: frontend to Vercel/Netlify, backend to Render, DB to Supabase — per requirements doc Section 21.

## 4. Open product decisions still outstanding

(Carried over from the requirements doc — not blocking the frontend scaffold, but blocking a real launch.)

- [ ] AMC / Service workflow details (Section 15).
- [ ] Document verification/status workflow, if any is needed beyond "uploaded / not uploaded".
- [ ] Whether photo uploads should record uploader + timestamp (currently only date is shown).
- [ ] Final confirmation of the Closure category — currently just a single Yes/No "Project closed" flag, no sub-items.
