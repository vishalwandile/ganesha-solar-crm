# Ganesha Solar CRM — Backend API

Node/Express API for the Ganesha Solar Services CRM. Uses PostgreSQL (Supabase) + optional Supabase Storage. JWT auth (httpOnly cookie + Bearer token).

## Stack decisions (locked for V1)

| Topic | Choice |
|---|---|
| Query layer | `pg` (SQL stays in sync with `db/schema.sql`) |
| Validation | `zod` |
| Auth | JWT (`httpOnly` cookie + `Authorization: Bearer`) |
| Passwords | `bcryptjs` |
| Files | Supabase Storage when configured; local `uploads/` fallback otherwise |

## Setup

```bash
cd backend
cp .env.example .env
# fill DATABASE_URL, JWT_SECRET, FRONTEND_ORIGIN

npm install
npm run db:push    # applies db/schema.sql
npm run seed       # creates demo users
npm run dev        # http://localhost:4000
```

### Demo users (from seed)

| Username | Password | Team |
|---|---|---|
| `vishal.wandile` | `admin123` | Admin |
| `priya.sawant` | `office123` | Office |
| `ganesh.more` | `sales123` | Sales |
| `sunita.jadhav` | `account123` | Account |
| `vikas.pawar` | `install123` | Installation |

## Main endpoints

- `POST /auth/login` `{ username, password }`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /api/dashboard/summary`
- `GET /api/activity/recent`
- `GET /api/customers?search=`
- `GET /api/customers/quick-lookup?query=`
- `POST /api/customers`
- `GET /api/customers/:id`
- `PATCH /api/customers/:id/categories/:category/sub-stages/:subStageKey`
- `PATCH /api/customers/:id/categories/:category/notes`
- `POST /api/customers/:id/payments`
- `POST /api/customers/:id/documents` (multipart)
- `POST /api/customers/:id/photos` (multipart)
- `GET /api/notifications`
- `GET /api/users` / `POST /api/users` (admin)

All `/api/*` routes require auth.

## Frontend key mapping

API responses use the frontend camelCase shapes (`nameChange`, `In progress`, `Bank transfer`, etc.). DB enums stay snake_case / Title Case as in `schema.sql`.
