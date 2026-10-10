# Skilled Workers – Backend v2

Hardened rewrite of the original Express + MongoDB API. All URLs the current React frontend calls
(`/api/user/*`, `/api/admin/*`) still work; new features live under `/api/*`.

## Run
```bash
cp .env.example .env        # fill MONGO_DB and JWT_SECRET (ROTATE the old ones – they were in the zip)
npm install
npm run migrate             # only if you have data from the old version
npm run create-admin -- "Your Name" you@example.com 'StrongPass123'
npm run dev
```

## Security fixes
| # | Problem in old code | Fix |
|---|---|---|
| 1 | `POST /register` saved `req.body` → anyone could send `type:"admin"`; `/admin/register` was public | Zod schema strips unknown keys; only `user`/`worker` allowed. Admins only via `ADMIN_REGISTRATION_KEY` header or `npm run create-admin` |
| 2 | Any user could change any job's status, to any string | Ownership checks, role-based allowed statuses, enforced transition table, timeline log |
| 3 | Original file names, any file type, public `/uploads` (Aadhaar image was downloadable) | Random names, jpg/png/webp(/pdf for ID) only, size caps, magic-byte check, **no static folder**; files served by `/api/files` with per-file authorisation; ID docs private and deleted after admin review |
| 4 | `.env` shipped in the zip | `.env.example`, `.gitignore`, server refuses to start without secrets (≥32 chars in production). **Rotate the old secrets.** |
| 5 | `cookie-parser` missing from package.json, `bcrypt`+`bcryptjs` both used | Dependencies fixed, bcryptjs only (cost 12) |
| 6 | Status case mismatch | Enum of lowercase statuses |
| 7 | Race: two workers accept same job | Atomic `findOneAndUpdate` compare-and-set |
| 8 | Hard-coded CORS origin | `CLIENT_URL` list, credentials only for those origins |
| 9 | Duplicate code/3 cookie names | Single httpOnly `sw_token` cookie, JWT HS256 pinned, old tokens die on password change |
| 10 | No validation / rate limits | Zod on every write, helmet, global + auth + upload + chat rate limits, NoSQL-operator stripping, 100 kb body cap, login lockout (5 fails → 15 min), constant-time login, generic error messages in production |
| + | IDOR on `requestchangeusertype/:userId`; unauth'd upload before auth; crash on `workerId` null in unassign; phone/address of customers visible to all workers | All fixed (job address/phone hidden until a worker is assigned) |

## New features → endpoints
| Feature | Endpoints |
|---|---|
| Auth, email verify, password reset, change password, avatar, language/SMS settings | `/api/auth/*` (`register, login, logout, me, verify-email, resend-verification, forgot-password, reset-password, change-password, settings, avatar`) |
| Search & filters + pagination | `GET /api/workers?q&category&city&minRating&minExperience&verified&available&lat&lng&radiusKm&sort&page` · `GET /api/jobs/available?category&city&urgent&minBudget&maxBudget&near=me&lat&lng&sort` · `GET /api/admin/jobs`, `/api/admin/users` |
| Reviews & ratings (real averages) | `POST /api/reviews` · `GET /api/reviews/worker/:id` · `DELETE /api/reviews/:id` (admin) |
| Notifications (in-app + email + SMS, English/Hindi) | `/api/notifications` (list, unread-count, read, read-all) |
| Worker ID verification + badge | `POST /api/workers/me/verification` · admin: `GET /api/admin/verifications`, `POST /api/admin/verifications/:userId` |
| Quotes & pricing | `POST /api/quotes` · `GET /api/quotes/job/:jobId` · `POST /api/quotes/:id/accept|reject` · `POST /api/jobs/:id/price` |
| Payments, invoices, promo codes | `POST /api/payments/order|verify|promo/validate` · `POST /api/payments/:id/confirm-cash` · `GET /api/payments/:id/invoice?format=html` · Razorpay webhook `POST /api/payments/webhook` |
| Scheduling & availability | `scheduledAt` on jobs; weekly `availability` + `available` on worker profile; double-booking check |
| Status timeline | `job.timeline[]` returned by `GET /api/jobs/:id` |
| Cancel / edit request | `POST /api/jobs/:id/cancel` · `PATCH /api/jobs/:id` (while pending) |
| Chat | `GET/POST /api/messages/:jobId` (poll with `?since=<ISO>`) |
| Multiple photos, before/after | `POST /api/jobs` (`photos` ×5) · `POST /api/jobs/:id/photos` · `POST /api/jobs/:id/after-photos` |
| Location / "jobs near me" | `lat`/`lng` on jobs & worker profile (2dsphere), `distanceKm` in results |
| Categories | `GET /api/categories` · admin `POST/PATCH /api/admin/categories` |
| Admin reports | `GET /api/admin/reports/overview?months=12` (status, category, monthly jobs, revenue, top workers, completion rate…) |
| Urgent jobs | `urgent:true` → matching workers in the city are notified (SMS if opted in) |
| Worker earnings | `GET /api/workers/me/earnings` |
| Referral codes & promos | `referralCode` on user, `referralCode` at register, reward promo after the referred user's first payment · admin `POST/GET/PATCH /api/admin/promos` |
| Disputes | `POST /api/disputes` · `GET /api/disputes/mine` · admin `GET /api/admin/disputes`, `POST /api/admin/disputes/:id/resolve` (can refund) |
| Block users | `POST /api/admin/users/:id/block` |

Responses on new endpoints are `{ success, ... }`; list endpoints add `pagination`.

## Frontend changes you will need
* Image URLs are now `/api/files/jobs/<file>` (authenticated, `withCredentials`). Old `/uploads/...` links no longer work; `npm run migrate` copies old attachments to the new location.
* Customer **phone/address are hidden** on open jobs; they appear after a worker is assigned.
* Workers may only set `in-progress` and `completed` (the old "assigned" option in the dropdown is rejected).
* Login failures still return HTTP 200 + `success:false` so the current 401-redirect interceptor keeps working.
* Worker list only includes workers who have a profile; `/api/user/allworkers` no longer returns phone numbers (admins still see them).

## Known limits / next steps
* Chat is REST + polling; swap in Socket.IO if you want push.
* Online payments need Razorpay keys; cash flow works without them.
* Not run against a live MongoDB in the build environment (no network) – the code is syntax-checked and the module wiring was verified, so run `npm install` and smoke-test the flows once. Add Jest/Supertest tests before production.
