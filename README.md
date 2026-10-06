# CampusMarket

A marketplace for verified students: buy, sell, rent and give away campus essentials, and
trade study material in the Resource Hub. Only students with an approved college email can
sign up, and every handover happens on campus with cash or UPI.

| Area | What it does |
|---|---|
| **Marketplace** | Listings for sale, rent or free, each with 1–3 photos, a condition, a pickup spot and a status (available / reserved / sold). Recommendations are based on the categories you browse. |
| **Resource Hub** | Study material for sale or free, as a soft copy (a PDF we host, or a drive link) or a hard copy (picked up on campus). Previews are rendered on the server, and paid access is granted by the seller. |
| **Looking For** | Students post what they need ("Casio fx-991CW for tomorrow"). Sellers see these requests in their dashboard. |
| **Notifications** | The seller dashboard and navbar bell show access requests on your resources and students tapping WhatsApp / Email on your items, plus Looking For posts. |
| **Accounts** | Sign-up with a one-time code sent to your college email, onboarding, interests, profile with avatar and phone, and buyer → seller upgrade. |
| **Wishlist** | Saved listings, stored in the browser (per user). |

## Tech stack

- **Frontend:** React 18, Vite 5, Tailwind CSS 3, React Router 6
- **Backend:** FastAPI, SQLAlchemy 2, Alembic, Postgres (Supabase), JWT auth, OTP over Gmail SMTP
- **PDF previews:** PyMuPDF + Pillow
- **Tooling:** npm for the frontend, [uv](https://docs.astral.sh/uv/) for Python, pytest for backend tests

## Getting started

### 1. Frontend

```bash
npm install
cp .env.example .env
npm run dev            # http://localhost:5173
```

`.env` settings:

| Variable | Value |
|---|---|
| `VITE_DATA_SOURCE` | `mock` runs everything on in-memory sample data (no backend needed). `live` calls the API. |
| `VITE_API_BASE_URL` | `http://localhost:8000/api` |

In **mock** mode the seeded user has `role: "admin"`, so `/admin` is reachable and every
resource opens with full access. To see the locked and request states, set
`currentUser.role` to `'student'` in `src/data/sample.js`.

### 2. Backend

```bash
cd campusmarket-backend
uv sync                       # installs dependencies (including dev: pytest, httpx)
cp .env.example .env          # then fill it in, see below
uv run alembic upgrade head   # creates/updates the tables
uv run uvicorn app.main:app --reload --port 8000
```

Check http://localhost:8000/health. It returns `{"status": "ok"}` only when the database is reachable.
Interactive API docs are at http://localhost:8000/docs.

Backend `.env`:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Supabase Postgres URI (Project Settings → Database → Connection string) |
| `JWT_SECRET_KEY` | Long random string used to sign login tokens |
| `OTP_PEPPER` | Extra secret mixed into stored OTP hashes |
| `ALLOWED_EMAIL_DOMAINS` | JSON list of college domains allowed to sign up, e.g. `["medhaviskillsuniversity.edu.in"]` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM` | Gmail SMTP for OTP emails (use an app password) |
| `CORS_ORIGINS` | e.g. `["http://localhost:5173"]` |
| `SUPABASE_SERVICE_ROLE_KEY` | Stores uploads in Supabase Storage so every machine sees the same photos and PDFs. Without it, files stay on the machine that received them. See the [backend README](campusmarket-backend/README.md#files-and-storage). |

> **After pulling new code, run `uv sync` and `uv run alembic upgrade head`.** If the
> database is behind the code, endpoints return 500, and the browser shows that as
> "Failed to fetch".

### 3. Tests and build

```bash
cd campusmarket-backend && uv run pytest   # in-memory SQLite + temp folders; never touches Supabase
npm run build                              # production build into dist/
```

### 4. Deploying

The frontend is on Vercel, the backend on Render, and both deploy from `main`; you work on `dev`.
[DEPLOY.md](DEPLOY.md) has the step-by-step setup and the release workflow.

## Resource Hub

Every resource is **for sale** (a whole-rupee price) or **free** (price 0). It has a subject
(free text, autocompleted from existing subjects), a year of study (1st–4th or any), a
copy type (soft / hard), a description of up to 500 characters, and a status
(**available / closed**) that the owner can toggle.

| Copy type | Delivery | File |
|---|---|---|
| Soft | **PDF**, hosted by us | Required: the full resource |
| Soft | **Drive link** (https only; Google Drive/Docs, OneDrive, SharePoint, Dropbox or Mega) | A sample PDF is required, so there is a preview |
| Hard | Pickup spot (required) | A sample PDF is optional |

**Previews are made on the server.** When a PDF is uploaded, the backend checks it: it must
start with `%PDF`, be unencrypted and be under 15 MB. It then renders **page 1 sharp** and
**pages 2–4 as small, heavily Gaussian-blurred JPEGs**. A single-page PDF sold through
hosted delivery keeps only its top half sharp. Previews are public files. The original PDF
goes to private storage (a private Supabase bucket, or `private/` on local disk) and is only
streamed through `GET /api/resources/{id}/file` after an access check. The frontend fetches
it as a blob with the auth header.

**Who gets full access:**

| Viewer | Free soft copy | Paid resource |
|---|---|---|
| Owner / admin | ✅ | ✅ |
| Logged-in verified student | ✅ | Only after the owner approves their access request |
| Guest or unverified user | Preview only | Preview only |

Payment happens offline. The buyer pays by UPI (the seller's optional UPI ID is shown as a
`upi://` pay link) or cash, then taps **Request access** with an optional note. The owner
approves or denies the request on the resource page. After a denial, the buyer can ask again,
and the owner can revoke access later. Closing a resource stops new requests, but approved
buyers keep access. The PDF, the drive link, the UPI ID and the seller's phone/email are
returned only to viewers who are allowed to see them.

## Project structure

```
campusmarket/
  src/
    App.jsx                 routes: public, verified-only, seller-only and admin-only groups
    pages/                  one file per route (Marketplace, Sell, Resources, ResourceDetail, ResourceForm, …)
    components/             Navbar, ListingCard, ResourcePreview, ReportModal, RequireAuth, …
    hooks/                  useAuth, useApi (+ useDebounced), useToast, useWishlist, useRecommendations, …
    services/
      client.js             fetch wrapper: base URL, bearer token, FastAPI error unwrapping, blob downloads
      api.js                the only module pages import; pick() switches between live and mock
      mockApi.js            in-memory backend with the same response shapes
    data/sample.js          mock seed data
    lib/                    format helpers, recommendations, Resource Hub constants and checks
  campusmarket-backend/
    app/
      main.py               FastAPI app, CORS, /uploads static mount, /health
      api/routes/           auth.py, listings.py, requests.py, resources.py
      core/                 config, security (JWT, get_current_user, get_optional_user, require_seller),
                            email (OTP), pdf_preview (validation + previews), storage (Supabase / local)
      models/  schemas/     SQLAlchemy models and Pydantic schemas
    alembic/versions/       migrations
    tests/                  pytest suite for the Resource Hub
    scripts/                migrate_uploads_to_storage.py (one-time move of local files to Supabase)
    uploads/  private/      local-disk storage when Supabase Storage isn't configured (gitignored)
```

## API

All paths are under `/api`. In this table, *seller* means `account_type = "seller"` or an admin.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/signup` | – | Checks the domain, emails a 6-digit OTP |
| POST | `/auth/login` | – | `{ email, otp }` → `{ token, user }` |
| POST | `/auth/profile`, `/auth/interests`, `/auth/account-type` | user | Onboarding, interests, buyer → seller upgrade |
| GET / PATCH | `/users/me` | user | |
| POST / DELETE | `/users/me/avatar` | user | Multipart, field `file` |
| GET | `/listings` | – | `q, category, condition, listing_type, min_price, max_price, status, seller_id, campus_id, include_sold, sort` |
| GET | `/listings/recommended` | – | `exclude_id, campus_id, category_scores` (JSON) |
| GET | `/listings/{id}` | – | |
| POST / PUT / DELETE | `/listings`, `/listings/{id}` | seller (owner) | |
| PATCH | `/listings/{id}/status` | seller (owner) | available / reserved / sold |
| POST | `/listings/{id}/images` | seller (owner) | Multipart, up to 3 photos |
| POST | `/requests` | verified user | Looking For post, max 5 a day |
| GET | `/requests`, `/requests/mine` | seller / user | Seller feed (last 30 days) / your own |
| DELETE | `/requests/{id}` | owner or admin | |
| GET | `/resources` | optional | `q, subject, year, copy_type, offer_type, sort, mine` |
| GET | `/resources/facets` | – | `{ subjects }` |
| GET | `/resources/{id}` | optional | Includes `access`. Sensitive fields depend on the viewer |
| POST / PUT | `/resources`, `/resources/{id}` | seller (owner) | Multipart form plus optional `file`; a bad PDF saves nothing |
| DELETE | `/resources/{id}` | owner or admin | Also deletes its files |
| PATCH | `/resources/{id}/status` | seller (owner) | available / closed |
| POST | `/resources/{id}/access` | verified user | `{ note }`: request access to a paid resource |
| GET | `/resources/{id}/access` | owner or admin | List requests |
| PATCH | `/resources/{id}/access/{request_id}` | owner or admin | `{ status: "approved" \| "denied" }` |
| GET | `/resources/{id}/file` | full access | Streams the PDF |
| GET | `/notifications` | user | Your notifications → `{ items, unread }`: access requests on your resources, and WhatsApp / Email taps on your items |
| POST | `/notifications/read-all` | user | |
| POST | `/notifications/contact` | verified user | `{ target_type, target_id, channel }`: sent when a student taps WhatsApp / Email; repeat taps within 1 hour are ignored |

**Mock-only so far:** reports (`POST /reports`), the admin dashboard (reports, users,
domains) and campuses exist in `mockApi.js` but have no backend routes yet, so they fail in
live mode.

## Notes

- `RequireAuth` in the frontend is for convenience only. The real permission checks are the
  FastAPI dependencies (`get_current_user`, `require_seller`, `require_admin`).
- Contact happens off-platform (WhatsApp / email). There is no in-app chat, escrow or
  ratings. Payment is always cash or UPI on campus.
