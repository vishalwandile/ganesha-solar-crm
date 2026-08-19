# Ganesha Solar Services CRM — V1 TODO / Requirements

> Working requirements collected so far. This document is intentionally limited to confirmed requirements and decisions provided by the user. Items that are still unclear are marked TODO.

---

## 1. Scope

- [x] Build a simple internal CRM for tracking customers/users and the status of their solar applications/installations.
- [x] The CRM is **not** the PM Surya Ghar application portal.
- [x] Government/PM Surya Ghar application processing will continue in the separate external portal.
- [x] CRM will only record and track relevant statuses.
- [x] No customer portal for V1.
- [x] Keep V1 simple; avoid excessive filters and unnecessary features.

## 2. Customer / Consumer Relationship

- [x] One consumer has exactly **one solar application/installation**.
- [x] A customer is first added to the CRM; the solar application itself is handled in a separate portal.
- [x] Sales person collects customer details.
- [x] Office creates the customer in CRM and uploads available documents.
- [x] Solar capacity is captured in the customer form.
- [x] Consumer can be searched using any of:
  - [x] Consumer Name
  - [x] Consumer Number
  - [x] Mobile Number

### Customer Status

- [x] Maintain an overall customer status.
- [x] **DECIDED:** Overall customer status is a simple manual field with values: **New, In Progress, Completed, On Hold**.

## 3. Customer Information

Confirmed fields/requirements:

- [x] Customer/Consumer Name
- [x] Consumer Number
- [x] Mobile Number
- [x] Email
- [x] Address
- [x] Solar Capacity
- [x] Solar Module details
- [x] Solar On-grid Inverter details
- [x] Customer documents

TODO / to confirm later:

- [x] **DECIDED:** Village, Taluka, District, PIN code, and Electricity connection/bill number are all included in the customer form.
- [ ] Exact solar module fields
- [ ] Exact inverter fields

## 4. Application / Process Tracking

- [x] CRM will not create/submit the actual government application.
- [x] CRM will track the company's/process statuses only.
- [x] Statuses will generally be:
  - [x] Pending
  - [x] Completed
- [x] **DECIDED:** Default stage status set is just **Pending / Completed**. **Rejected** is added only for stages where it's meaningful (Bank Loan, Subsidy). Other stages don't need Rejected/In Progress.
- [x] Some stages can be optional/not applicable.
- [x] Example: Name Change is required only for some customers.
- [x] Example: Bank Loan is required only for some customers.
- [x] Optional stages should only be included when applicable.
- [x] If something is rejected, record:
  - [x] Rejected status
  - [x] Rejection reason
- [x] All statuses should default to **Pending** when applicable.

### Process stages identified from the current discussion/handwritten flow

> Final exact list and ownership are still TODO.

> **SUPERSEDED — see below.** Flat list replaced by final category/sub-stage structure.

### FINAL STRUCTURE — Categories & Sub-Stages (DECIDED)

**1. Name Change** *(Optional — only for applicable customers)*
  - a. Document Received — Pending / Completed
  - b. Application Submitted — Pending / Completed
  - c. Demand — Pending / Completed
  - d. Application — Approved / Rejected

**2. Rooftop Solar**
  - a. Application Submitted — Pending / Completed

**3. PM Suryaghar**
  - a. Application — Pending / Completed
  - b. Bank Details Verification — Pending / Completed
  - c. Installation Details Uploaded — Pending / Completed
  - d. Inspection from DISCOM — Pending / Completed
  - e. Subsidy Request — Pending / Claimed
  - f. Subsidy — Pending / Disbursed

**4. Finance**
  - a. Bank Loan *(Optional)* — Request Submitted / Completed
  - b. If no Bank Loan: Payment received (mode + date), multiple entries allowed, summing to a running total

**5. Installation**
  - a. Fabrication Material Dispatched — Yes / No
  - b. Fabrication Work — Pending / Completed
  - c. Solar Panel Installation — Pending / Completed
  - d. Wiring — Pending / Completed
  - e. Release Order — Pending / Completed
  - f. Meter Installation — Pending / Completed

**6. Closure**
  - a. Project Closed — Yes / No (simple final checkbox/status, no sub-items)

**Notes / how this supersedes earlier notes in this doc:**
- [x] "Bank Details" and "Insurance" as standalone top-level stages are dropped — but **Bank Details Verification** reappears as a PM Suryaghar sub-stage (b), so it is tracked, just relocated.
- [x] Not every sub-stage is Pending/Completed — several use custom pairs (Approved/Rejected, Claimed/Pending, Disbursed/Pending, Yes/No). The earlier decision ("just Pending/Completed, Rejected only for Loan/Subsidy") is superseded per-sub-stage by this table — this table is the source of truth for status options per sub-stage.
- [x] "Rooftop Solar" is its own top-level category, separate from "PM Suryaghar" (earlier assumption that Rooftop Solar Application sits inside PM Suryaghar was wrong).
- [x] Release Order and Meter Installation sit under **Installation**, not under PM Suryaghar or a separate "Closure" category.

**Category ownership (FINAL):**
- [x] Name Change — **Office**
- [x] PM Suryaghar — **Office**
- [x] Rooftop Solar — **Office**
- [x] Finance — **Account**
- [x] Installation — **Installation team**
- [x] Closure — **Office**

TODO:

- [ ] Confirm order of categories on the Customer Details screen (suggest: Name Change → Rooftop Solar → PM Suryaghar → Finance → Installation → Closure, matching the order given).

## 5. User Roles / Teams

Confirmed teams:

- [x] Admin
- [x] Installation
- [x] Sales
- [x] Office
- [x] Account
- [x] Loan

Requirements:

- [x] Multiple users will use the CRM.
- [x] Users belong to different teams/roles.
- [x] Admin has overall control.
- [x] Separate permissions are required for editing.
- [x] **DECIDED:** Permission model is **flexible/per-user** — Admin assigns exactly which stages/sections each user can edit, rather than a rigid one-team-one-stage rule or fully open editing. (Final matrix of who-gets-what by default still TODO.)

## 6. Process Ownership — Initial Understanding

Based on the user's description:

- [x] Sales: collect customer details.
- [x] Office: create customer and upload documents.
- [x] Office: update rooftop solar application status.
- [x] PM Solar teams: update relevant PM Solar statuses.
- [x] Bank/Loan team: update bank loan status.
- [x] Installation team: update installation-related statuses.
- [ ] Account team responsibilities to be finalized.
- [ ] Exact stage-to-team ownership matrix to be finalized.

## 7. Documents

- [x] Documents must be uploadable and stored in CRM.
- [x] Customer documents can be uploaded when creating a new customer.
- [x] Additional document upload should be available at required stages.
- [x] **DECIDED:** Predefined document types for V1: **Aadhaar, Electricity Bill, Bank Passbook**.
- [ ] Document verification/status workflow to be defined if needed.

## 8. Bank Loan

- [x] CRM will **not** manage/create the actual bank loan application.
- [x] Bank loan is tracked only as a status/process in CRM.
- [x] Bank Loan is optional per customer.
- [x] Loan team updates the status.
- [x] Track progress such as:
  - [x] Application Submitted to Bank
  - [x] Amount Received by Ganesha Solar Services
- [x] Rejected status + rejection reason should be supported.
- [x] **DECIDED:** Bank Loan fields: **Bank Name, Loan Amount, Amount Received, Received Date** (plus status + rejection reason).
- [ ] Final bank-loan status list to be finalized.
- [ ] Whether to store bank name, loan amount, received amount/date, etc. to be finalized.

## 9. Payments

- [x] Payment tracking is required.
- [x] Customer can make multiple direct/manual payments.
- [x] Payment records should support multiple entries per customer/project.
- [x] **DECIDED:** Payment entry fields: **Amount, Date, Mode**. Modes: **Cash, Bank Transfer, Cheque, UPI**.
- [ ] Final payment fields to be finalized.
- [ ] Payment modes to be finalized.
- [ ] Outstanding/balance calculation to be finalized.

## 10. Subsidy

- [x] Subsidy tracking is required.
- [x] User should be able to enter subsidy amount.
- [x] Subsidy received date should be stored.
- [ ] Final subsidy status/options to be finalized.

## 11. Installation Photos

- [x] Installation photos can be added to the customer's profile.
- [x] **DECIDED:** No Before/During/After categories for V1 — just a simple photo gallery per customer, each photo tagged with its upload date.
- [ ] Whether photo upload should record uploader/date-time is to be finalized.

## 12. Activity History / Audit Trail

- [x] Track activity history for customers/process updates.
- [x] History should show what happened and when.
- [x] History should identify the user who performed the action.
- [ ] Final audit-log edit/delete policy to be finalized.

## 13. Notifications

- [x] Simple CRM notification icon is required.
- [x] Notifications should show status updates/important updates.
- [x] Keep notifications simple for V1.
- [x] **DECIDED:** Notifications trigger only on stage status changes (e.g. a stage moving to Completed or Rejected). No notifications for customer creation, document uploads, or payments in V1.
- [ ] Exact notification triggers to be finalized.
- [ ] No requirement yet for WhatsApp/email/push notifications.

## 14. Dashboard

- [x] Dashboard is required.
- [x] Dashboard should provide a simple overview of applications/customers and their statuses.
- [x] Keep dashboard simple.
- [x] **DECIDED:** Dashboard shows total customer count + counts by overall status (New / In Progress / Completed / On Hold).
- [ ] Exact dashboard cards/metrics to be finalized.

## 15. Service / Post-Installation

- [x] Service option should exist.
- [ ] Exact service workflow/details to be defined later.
- [ ] AMC requirements to be defined later if needed.

## 16. Customer Portal

- [x] No customer portal for V1.

## 17. Search / Filters

- [x] Search by Consumer Name, Consumer Number, or Mobile Number.
- [x] Keep filtering simple for V1.
- [ ] Additional filters only if they become necessary.

## 18. High-Level Business Flow

Current understanding:

Sales Person
    ↓
Collect customer details
    ↓
Office creates customer in CRM
    ↓
Office uploads available customer documents
    ↓
Check whether Name Change is required
    ├── Yes → Track Name Change stage
    └── No  → Continue
    ↓
All applicable statuses default to Pending
    ↓
Office / relevant teams update their assigned statuses
    ↓
PM Solar team updates PM Solar-related statuses
    ↓
Loan team updates Bank Loan status when applicable
    ↓
Installation team updates installation statuses
    ↓
Account/payment information is tracked
    ↓
Subsidy amount/date can be recorded
    ↓
Installation/service information can be maintained
    ↓
Activity history + notifications provide tracking

## 19. V1 UI Direction

Target: simple internal application focused on tracking.

Initial screens/modules suggested:

- [ ] Login
- [ ] Dashboard
- [ ] Customer List / Search
- [ ] Create Customer
- [ ] Customer Details
- [ ] Documents
- [ ] Status Tracking
- [ ] Payments
- [ ] Installation Photos
- [ ] Activity History
- [ ] Notifications
- [ ] Users & Teams
- [ ] Permissions
- [ ] Service

These are implementation TODOs and should be refined after requirements are finalized.

## 20. Important Product Principles

- [x] Do not duplicate the external PM Surya Ghar application.
- [x] CRM is a tracking and coordination system.
- [x] Keep V1 simple.
- [x] Role/team-based updates.
- [x] Separate edit permissions.
- [x] Statuses default to Pending.
- [x] Optional stages should be enabled only when applicable.
- [x] Rejections require a reason.
- [x] Preserve activity history.
- [x] Support documents and installation photos.
- [x] Support multiple direct payments.
- [x] Support bank-loan status tracking without building the loan application.
- [x] Support subsidy amount and received date.
- [x] No customer portal in V1.

## 21. Permissions, Auth & Tech Stack (DECIDED)

- [x] **Permissions:** Admin can override/update any category regardless of default team assignment. Default assignment is by category owner (see section 4); Admin has full access on top of that.
- [x] **Login/Auth:** Simple username/password login (no OTP, no SSO needed for V1).
- [x] **Scale confirmed:** POC-level internal tool. 4–5 users total, max ~100 new customers/month. Simple status-tracking CRM — no need for complex scaling, analytics, or high-availability infra.

### Recommended Tech Stack (matches user's React/Node/PostgreSQL preference, $0–near-$0 hosting cost)

Given the scale (4–5 users, ~100 customers/month, internal status tracker), the original React + Node + PostgreSQL choice is a good fit — no need for anything heavier. Suggested free-tier deployment:

| Layer | Choice | Why |
|---|---|---|
| Frontend | React (Vite), deployed on **Vercel** or **Netlify** free tier | Generous free static/SPA hosting, push-to-deploy from Git, free HTTPS |
| Backend API | Node.js/Express, deployed on **Render** free Web Service | No credit card needed, genuine free tier for long-running Node servers; cold start (~30–60s) after 15 min idle is fine for an internal low-traffic tool |
| Database | **Supabase** free-tier PostgreSQL (not Render's free Postgres, which auto-expires after 90 days) | Real Postgres, persistent, generous free tier, and includes free file **Storage** in the same project — useful for customer documents/installation photos without a separate service |
| File storage (docs/photos) | **Supabase Storage** (same free project as DB) | Avoids paying for S3/Cloudinary separately; one dashboard for DB + files |

- [x] **Total hosting cost: $0/month** at this scale. Only real risk is Render's free-tier cold start (~30–60s) on the first request after idle — acceptable for an internal tool used a few times a day by 4–5 people.
- [x] If it later needs to feel instant / grow beyond POC, cheapest upgrade path is a ~$6–7/month VPS or Render's paid tier (~$7/mo) to remove cold starts — no architecture change needed.



1. [ ] Final customer form fields.
2. [ ] Final overall customer statuses.
3. [ ] Final application/process stage list.
4. [ ] Final status options for each stage.
5. [ ] Exact team ownership for every stage.
6. [ ] Final role/permission matrix.
7. [ ] Final payment fields and payment modes.
8. [ ] Final bank-loan status fields.
9. [ ] Final subsidy status/fields.
10. [ ] Final document types.
11. [ ] Installation photo structure.
12. [ ] Notification triggers.
13. [ ] Dashboard metrics.
14. [ ] Service workflow.
15. [ ] Final V1 screen list.
16. [ ] Database schema.
17. [ ] API design.
18. [x] Technology/hosting architecture — **DECIDED:** React (Vercel/Netlify) + Node/Express (Render free) + Supabase (Postgres + Storage), $0/month at current scale. See Section 21.
