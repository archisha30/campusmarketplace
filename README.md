# CampusMarket — Frontend

Verified student-only campus marketplace and academic resource hub.
React + Vite + Tailwind, structured so a FastAPI backend drops in without touching the UI.

## Run it

```bash
npm install
cp .env.example .env
npm run dev
```

Opens on http://localhost:5173 with `VITE_DATA_SOURCE=mock`, so every screen works
on sample data before the backend exists.

Demo shortcuts: sign up with any `@polaris.edu` or `@northgate.edu` address.
`@riverdale.edu` is deliberately disabled so you can see the rejected-domain error.
The seeded user has `role: "admin"`, so `/admin` is reachable.

## Structure

```
src/
  main.jsx              providers: router, auth, toast
  App.jsx               all routes, including the two guarded groups
  components/           Navbar, BottomNav, ListingCard, Badge, Modal, EmptyState, skeletons, filters
  pages/                one file per route
  hooks/
    useAuth.jsx         session + role, reads from authApi
    useToast.jsx        single global toast
    useApi.js           fetch-on-mount with loading/error/refetch, plus useDebounced
  services/
    client.js           fetch wrapper: base URL, bearer token, FastAPI error unwrapping
    api.js              the only module pages import — listingsApi, resourcesApi, reportsApi, authApi, adminApi
    mockApi.js          in-memory backend, delete once the API is live
  data/sample.js        seed data shaped like the API response models
  lib/format.js         price formatting, WhatsApp/email contact links
  lib/recommendations.js  client-side view history + category affinity scoring (used by
                           hooks/useRecommendations.js and components/RecommendedForYou.jsx)
```

## Connecting FastAPI

1. Set `VITE_DATA_SOURCE=live` and `VITE_API_BASE_URL=http://localhost:8000/api` in `.env`.
2. Implement the endpoints listed below. Response shapes must match `src/data/sample.js`.
3. Delete `src/services/mockApi.js` and the `pick()` helper in `api.js`.

Nothing in `components/` or `pages/` changes.

| Method | Path | Notes |
|---|---|---|
| GET | `/listings` | query: `q, category, condition, listing_type, min_price, max_price, campus_id, seller_id, status, sort` → `{ items, total }` |
| GET | `/listings/{id}` | |
| POST | `/listings` | |
| PUT | `/listings/{id}` | |
| DELETE | `/listings/{id}` | |
| PATCH | `/listings/{id}/status` | body `{ status }` — available / reserved / sold |
| GET | `/listings/recommended` | query: `exclude_id, campus_id, category_scores` (JSON-encoded) → `{ items, personalized }`. Content-based: scores available listings by category affinity (sent from the client's local browsing history) plus a same-campus boost. `personalized: false` on cold start, so the UI can show honest fallback copy instead of a fake "just for you" claim. |
| POST | `/listings/{id}/images` | multipart, 1–3 files → Supabase Storage or Cloudinary |
| GET | `/resources` | query: `q, department, semester, category` |
| GET | `/resources/{id}` | |
| POST | `/resources` | |
| POST | `/resources/{id}/helpful` | |
| POST | `/reports` | body `{ listing_id?, resource_id?, reason }` |
| POST | `/auth/signup` | domain check, then OTP / magic link |
| POST | `/auth/login` | → `{ token, user }` |
| POST | `/auth/profile` | completes onboarding |
| GET | `/users/me` | |
| GET | `/campuses` | |
| GET/PATCH | `/admin/reports`, `/admin/reports/{id}` | body `{ action }` — hide / delete / dismiss |
| GET/PATCH | `/admin/users`, `/admin/users/{id}` | body `{ status }` |
| GET/POST/PATCH/DELETE | `/admin/domains`, `/admin/domains/{id}` | |

Sold listings are filtered out of `/listings` server-side unless `include_sold=true`
(the dashboard passes it).

`RequireAuth` is convenience only. Verification and the admin role must be enforced
in FastAPI dependencies too — a guarded route is not a permission.

## Deliberately out of MVP

Favourites, internal chat, escrow, ratings, push notifications, and the Looking For
board. Looking For has landing-page UI marked Coming Soon; the rest have no UI at all,
which is the point.
