# Skilled Workers – Frontend v2

React 18 + Vite + Tailwind CSS 3. Glassmorphism UI with a light/dark theme toggle, built for the v2 backend.

## Run
```bash
# 1. backend (in ../backend):  npm install && cp .env.example .env && npm run dev      -> http://localhost:3000
# 2. frontend:
npm install
cp .env.example .env        # optional; defaults proxy /api to http://localhost:3000
npm run dev                 # http://localhost:5173
npm run build               # production bundle in dist/
```
In the backend `.env`, keep `CLIENT_URL=http://localhost:5173`.
The Vite dev server **proxies `/api` to the backend**, so the httpOnly login cookie and the private images
(`/api/files/...`) are same-origin. In production serve `dist/` and `/api` from the same domain (e.g. nginx),
or set `VITE_API_URL` / `VITE_API_ORIGIN` and use `COOKIE_SAMESITE=none` + HTTPS on the backend.

## Design system
* **Glass** surfaces (`.glass`, `.glass-strong` in `src/index.css`): translucent, `backdrop-blur`, soft borders.
* Animated gradient + blurred blobs backdrop (`components/Background.jsx`).
* **Theme toggle** (`components/ThemeToggle.jsx`): class-based dark mode, saved in `localStorage`, applied before first paint (no flash), defaults to the OS setting. Also available under Settings.
* Reusable kit in `components/ui.jsx` (Button, Card, Field/Input, Modal, Tabs, Stars, Badge, charts, …).
* Responsive: sidebar on desktop, slide-over menu on mobile.

## Screens
| Role | Pages |
|---|---|
| Public | Landing, Login, Register (role + referral code), Forgot / Reset password, Verify email |
| Customer | Dashboard, **New request** (photos, category, urgent, schedule, budget, location), My requests (status tabs), **Find workers** (search, category, city, rating, verified, available, near me, sort), Worker profile (reviews, rating breakdown, availability) |
| Worker | Dashboard (availability switch, verification banner), **Open jobs** (filters, near me, urgent, budget), My jobs, Earnings (monthly chart), **Profile** (skills, bio, service radius, weekly slots, location, ID verification upload) |
| Admin | Overview (KPIs + charts), Users (block, approve worker requests), All jobs, **Verifications** (review ID, approve/reject), Disputes (resolve + refund), Promos / Categories / Payments |
| Shared | **Job detail**: timeline, photos (before/after), quotes (compare, accept), accept-or-quote for workers, status actions, final price, in-app **chat**, **payment** (Razorpay or cash, promo codes, invoice), review, dispute, edit / cancel, admin assign. Notifications, Settings (avatar, language, SMS, password, referral link) |

## Notes
* Razorpay Checkout loads on demand; enable it by adding the keys in the backend `.env`. Cash works without it.
* Chat polls every 5 s and the notification bell every 30 s (no websockets needed).
* Customer phone/address are hidden from workers until assigned (backend rule), and the UI explains this.
* Verified in the build environment: all 37 source files parse (JSX), no undefined identifiers, and every API call matches a backend route.
  It could **not** be bundled or opened in a browser there (no network for `npm install`), so run it once and report anything odd.
