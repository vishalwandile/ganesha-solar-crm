# Ganesha Solar Services CRM — Frontend (FE) documentation

Describes the `ganesha-solar-crm` React/Vite/Tailwind scaffold: how it's structured, how data flows, and how to extend it. Pairs with `TODO.md` (what's left to build) and the main requirements doc.

---

## 1. Stack

| Layer | Choice |
|---|---|
| Build tool | Vite 5 |
| UI library | React 18 |
| Routing | react-router-dom 6 |
| Styling | Tailwind CSS 3 |
| State | Local component state only (no Redux/Context store) — no backend yet |
| Data | Single mock file, `src/data/mockData.js` |

No UI component library (no MUI/shadcn) — everything is plain Tailwind-styled HTML elements, kept intentionally simple for a small internal tool.

## 2. Running it

```bash
npm install
npm run dev      # starts local dev server, usually http://localhost:5173
npm run build    # production build to dist/
npm run preview  # preview the production build locally
```

Login accepts any non-empty username/password — there's no real auth yet (see `TODO.md`).

## 3. Folder structure

```
src/
  main.jsx              Entry point — mounts <App /> inside BrowserRouter
  App.jsx                Route table + mock login gate
  index.css              Tailwind directives + a few base element styles
  data/
    mockData.js          All mock data + category/sub-stage schema + helpers
  components/
    Layout.jsx            Page shell: Sidebar + Topbar + content area
    Sidebar.jsx            Left nav (Dashboard, Customers, Notifications, Users & teams)
    Topbar.jsx             Page title + notification badge + avatar
    StatusBadge.jsx        Colored pill for any status value (New/Pending/Completed/etc.)
    CategoryCard.jsx       Expandable card for one process category (used on Customer detail)
  pages/
    Login.jsx
    Dashboard.jsx
    CustomerList.jsx
    CreateCustomer.jsx
    CustomerDetail.jsx
    Users.jsx
    Notifications.jsx
```

## 4. Data model (`src/data/mockData.js`)

This file is the single source of truth for the scaffold and mirrors the finalized requirements doc exactly. When the real backend is built, its shape should map directly to the database schema.

- **`CATEGORY_DEFS`** — the 6 tracked categories (Name change, Rooftop solar, PM Suryaghar, Finance, Installation, Closure), each with:
  - `key`, `label`, `owner` (team name), `optional` (bool)
  - `subStages`: array of `{ key, label, options }` — `options` is the exact allowed status set for that sub-stage (e.g. `['Approved', 'Rejected']` for Name change's final step, `['Pending', 'Claimed']` for Subsidy request).
- **`DOCUMENT_TYPES`**, **`PAYMENT_MODES`**, **`TEAMS`**, **`OVERALL_STATUSES`** — fixed option lists used across forms and filters.
- **`USERS`** — mock user list with team + a plain-text summary of what they can edit.
- **`CUSTOMERS`** — array of full customer records, each with:
  - profile fields (name, consumer number, address fields, solar details)
  - `categories` — object keyed by category `key`, holding the actual sub-stage values for that customer (or `null` for an optional category that doesn't apply)
  - `documents`, `payments`, `photos`, `history` — arrays for the other detail tabs
- **`NOTIFICATIONS`** — mock notification feed.
- **`getCategoryStatus(categoryDef, customerCategoryData)`** — helper that rolls up a category's sub-stage values into one overall badge (`Rejected` / `Completed` / `In progress` / `Pending` / `Not applicable`). Used by both the Customer detail cards and could be reused for list/dashboard rollups later.

## 5. Screens

| Route | File | Notes |
|---|---|---|
| `/login` (implicit) | `Login.jsx` | Shown whenever `user` state in `App.jsx` is null |
| `/` | `Dashboard.jsx` | Status counts computed client-side from `CUSTOMERS` |
| `/customers` | `CustomerList.jsx` | Client-side search filter, no pagination yet |
| `/customers/new` | `CreateCustomer.jsx` | Form only — doesn't persist a new customer yet |
| `/customers/:id` | `CustomerDetail.jsx` | Tabbed; loads the matching record from `CUSTOMERS` by id, edits are local state (`useState`, initialized from the mock record) |
| `/users` | `Users.jsx` | Read-only table for now |
| `/notifications` | `Notifications.jsx` | Local read/unread toggle |

## 6. Key patterns worth knowing before extending

- **Category rendering is data-driven.** `CustomerDetail.jsx` just loops over `CATEGORY_DEFS` and renders a `CategoryCard` per category — adding, removing, or reordering categories only requires editing `CATEGORY_DEFS` in `mockData.js`, not the page component.
- **Status color mapping lives in one place** — `StatusBadge.jsx`'s `COLOR_MAP`. Add any new status string there or it'll fall back to the neutral gray style.
- **`CategoryCard` handles both required and optional categories** — if `categoryDef.optional` is true and the customer's data for that category is `null`/undefined, it renders a "Not applicable" badge and skips the sub-stage list.
- **All "writes" are local state, not persisted** — `CustomerDetail.jsx`'s `updateSubStage` and `addPayment`, and `CreateCustomer.jsx`'s `handleSubmit`, all just call `setState`. Swapping these for real API calls is the main integration point once a backend exists.

## 7. What's intentionally not here yet

See `TODO.md` for the full list — in short: no backend, no real auth, no persisted writes, no permission enforcement, no file storage, no AMC/Service screen.
