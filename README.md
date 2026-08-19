# Ganesha Solar Services CRM — UI scaffold

React + Vite + Tailwind CSS front-end scaffold implementing every V1 screen with mock data, matching the finalized requirements doc. No backend — all data lives in `src/data/mockData.js` and edits are local component state (refresh resets them).

## Setup

```bash
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`). Login accepts any username/password.

## Screens included

- **Login** — mock username/password auth
- **Dashboard** — a quick-lookup box (search by consumer number or mobile, no need to open the full profile), total customers + counts by overall status (New / In progress / Completed / On hold), recent activity feed
- **Customers** — searchable list (name, consumer number, mobile)
- **Add customer** — full form: customer details, address (incl. Village/Taluka/District/PIN), electricity & solar fields, document upload (Aadhaar, Electricity bill, Bank passbook)
- **Customer detail** — a visual stage tracker across the top (click any node to jump to that category), then tabs for:
  - **Status tracking** — all 6 categories as expandable cards with per-sub-stage status dropdowns, rejection reasons, an aging badge ("Nd pending" since the category last changed), a per-category notes field, and an auto-calculated PM Suryaghar subsidy estimate based on capacity
  - **Documents** — uploaded document list
  - **Payments** — running total vs. amount due, add-payment form (Cash/Bank transfer/Cheque/UPI)
  - **Photos** — installation photo gallery (no categories, per plan)
  - **History** — activity/audit log
- **Users & teams** — user list with per-user edit permissions
- **Notifications** — stage-change notifications with read/unread state

## Structure

```
src/
  data/mockData.js       All mock data + category/sub-stage definitions
  components/            Sidebar, Topbar, Layout, StatusBadge, CategoryCard
  pages/                 One file per screen
  App.jsx                Routes (react-router-dom)
```

## Next steps (not in this scaffold)

- Wire up a real backend (see the requirements doc's Section 21 for the recommended React + Node/Express + Supabase stack)
- Replace mock login with real username/password auth + sessions
- Persist status/payment/document changes via API calls instead of local state
- Enforce per-user edit permissions in the UI (currently everyone can edit everything)
