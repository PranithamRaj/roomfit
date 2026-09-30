# RoomFit: an AR furniture marketplace

Shoppers browse furniture from local shops, **place it in their own room with AR at true size**, check it fits, and **enquire** with the shop.
Listings show no prices: shops reply to enquiries with price, availability and delivery details.
Sellers list pieces with photos and sizes; the RoomFit team (admin) adds the 3D/AR models. Changes show up live on every screen.

| Part | Tech | Folder |
| --- | --- | --- |
| App (Android, iOS, web) | React Native · Expo SDK 57 · Expo Router | `mobile/` |
| API | Node · Express 5 · JWT auth · MongoDB (production) or JSON file (dev) | `backend/` + `api/` (Vercel) |
| AR / 3D | Google `<model-viewer>` → Scene Viewer (Android) / AR Quick Look (iOS) | `backend/src/arPage.js` |

## Quick start

You need Node 20+ and, on your phone, the **Expo Go** app. The phone and computer must be on the same Wi-Fi.

```bash
cd backend
npm install
npm run dev
```

The API starts on `http://localhost:4000` and seeds demo data on first run. It prints the LAN address your phone will use.

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). Press `w` to open the web version.

**Demo accounts** (password `password123`), also available as one-tap buttons on the sign-in screen:

- Shopper: `buyer@roomfit.test`
- Sellers: `seller@oakandloom.test`, `seller@chairhouse.test`, `seller@lumen.test`
- Admin (3D/AR models): `admin@roomfit.test` (local and in-memory demo data only; see [Admin account](#admin-account))

## Features

**Shoppers**
- Home: AR banner, categories, new arrivals, shops. Browse has search, category, *AR ready*, sort, and a **Fits my space** filter (max W/D/H).
- Product page: interactive 3D model with dimension labels, and **View in your room (AR)**, which places the piece on your floor at real scale.
- **Will it fit?** Enter your space's measurements and a clearance, and see per-dimension margins, a "fits if you turn it 90°" check, and a top-down floor plan.
- **Enquire** instead of buying: name, phone, optional email, preferred contact (call, WhatsApp or email) and a message. Guests can enquire without an account.
- One-tap **Call shop** and **WhatsApp** buttons when the shop has a phone number.
- Signed-in shoppers track their enquiries (New → Contacted → Closed) in the Enquiries tab.

**Sellers**
- Shop profile (logo, cover, address).
- Products: photos, real-world dimensions, material, colour and stock. Sellers don't handle 3D models; each product shows **AR pending** until the RoomFit team adds one, then **AR live**.
- **Instant photo uploads:** pick several photos or take one with the camera. Each shows its upload progress, and on a published product it goes live on the listing as soon as it finishes (no Save needed).
- Dashboard: new and in-progress enquiries, enquiries this week, most-asked-about piece, pieces waiting for a 3D model, and alerts for a missing shop phone, missing photos and unavailable pieces.
- **Live enquiry inbox:** a shopper's enquiry appears the moment it's sent, with a new-enquiry count on the Enquiries tab. The inbox shows the shopper's contact details and one-tap call/WhatsApp/email (which marks the enquiry as contacted), and tracks its status.

**Admin portal (RoomFit team)**: oversees every seller's and shopper's operations, live.
- **Overview:** enquiries awaiting a reply, this week vs last week, average first-reply time, shoppers, shops, AR coverage, the enquiry pipeline, a **Needs attention** list (enquiries unanswered for over a day, shops without a phone, sellers without a shop, products without a 3D model, suspended accounts) and the live activity feed.
- **Activity log:** every action by shoppers (including guests), sellers and admins: sign-ups, enquiries and status changes, listings, photos, shop edits, 3D models, suspensions. Filter by type; tap an entry to open what it's about.
- **Enquiries:** every enquiry across all shops, with search and status filters. Admins can open any enquiry, step in on its status (shown to both sides as "by RoomFit"), or delete spam.
- **Shops:** each shop's owner, products, enquiries, open and awaiting-reply counts, and average first-reply time. **Suspending a shop** hides it and its products from shoppers and stops new enquiries; the seller keeps access and sees a notice.
- **Users:** every account by role, with their shop or the enquiries they sent and their activity. **Suspending an account** blocks sign-in and ends existing sessions immediately. Admin accounts can't be suspended.
- **AR studio:** every shop's products, the ones still needing a 3D model first. New listings appear as sellers publish them.
- Per product: the seller's photos and listed size as reference, **.glb upload** (plus optional .usdz for iOS), floor/wall placement, a live 3D preview that checks the model against the listed size, an AR test, and removing a model.
- Publishing a model turns on AR for shoppers immediately.

## How the AR works

Tapping **View in your room** opens `GET /ar/:productId` in the phone's browser. This is a page rendered with `<model-viewer ar ar-scale="fixed">`:

- **Android (ARCore phones):** Chrome hands off to Google **Scene Viewer**, which places the GLB at 1:1 scale.
- **iPhone / iPad:** Safari opens **AR Quick Look**. model-viewer converts the GLB to USDZ on the fly, or uses the product's `iosModelUrl` if the seller uploaded one.
- `ar-scale="fixed"` stops the shopper from pinch-resizing the model, so what they see is the real size.

This works in Expo Go with no custom native build. The same page with `?embed=1` powers the in-app 3D preview (a WebView on native, an iframe on web).

**3D model requirements (admin):** a `.glb` in metres (1 unit = 1 m), with the origin on the floor. The viewer measures the model and warns when it differs from the listed dimensions by more than 10%.

The demo products use Khronos glTF sample models, which are authored at real-world scale. Their listed dimensions were measured from the models themselves.

## Live updates

Every change is published as an event: product/shop changes to everyone, and enquiry changes only to that shop's owner and the shopper who sent it. The app streams these from `GET /api/events` (Server-Sent Events) and each screen refetches what it shows. A **Live** dot means the stream is connected.

Vercel Functions run on many short-lived instances, so a stream there would miss events. On Vercel the endpoint answers `501`, and the app refreshes open screens every 5 seconds instead (shown as **Auto-refresh**). For instant updates on Vercel, publish events through a hosted pub/sub service (e.g. Ably, Pusher or Upstash Redis) from `backend/src/events.js`.

## Admin account

Admins can't sign up in the app. Create one (or promote an existing account) on whichever database the API uses:

```bash
cd backend
npm run create-admin -- you@example.com "a-strong-password" "Your Name"
```

With `MONGODB_URI` set, this targets that database. Seeding also creates an admin from `ADMIN_EMAIL` + `ADMIN_PASSWORD` if both are set. Otherwise it creates the demo admin `admin@roomfit.test`, but only for local or in-memory data, never in MongoDB.

## API overview

All routes are under `/api`. Send `Authorization: Bearer <token>` where auth is needed.

| Method & path | Who | Purpose |
| --- | --- | --- |
| `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | anyone / user | Accounts (`role`: `buyer` or `seller`; admins via `create-admin`) |
| `GET /products?q&category&shop&maxWidth&maxDepth&maxHeight&arOnly&sort` | public | Catalogue search, including "fits my space" |
| `GET /products/:id`, `GET /products/categories` | public | Product details and related items |
| `POST/PUT/DELETE /products[/:id]` | seller (owner) | Manage products (3D/AR fields are ignored) |
| `POST /products/:id/images`, `DELETE /products/:id/images?url=` | seller (owner) | Add or remove one photo, live |
| `GET /admin/products?ar=missing|ready` | admin | AR studio queue, with counts |
| `PUT /admin/products/:id/ar` | admin | Set `modelUrl`, `iosModelUrl`, `placement` (empty strings remove the model) |
| `GET /admin/overview` | admin | KPIs, needs-attention lists, recent activity |
| `GET /admin/activity?type&limit` | admin | Activity log, newest first (`type` prefix: `enquiry`, `product`, `shop`, `user`) |
| `GET /admin/enquiries?status&shop&q`, `DELETE /admin/enquiries/:id` | admin | All enquiries; remove spam |
| `GET /admin/shops[/:id]`, `PATCH /admin/shops/:id` `{ suspended }` | admin | Shops with performance stats; suspend or restore |
| `GET /admin/users?role&q`, `GET /admin/users/:id`, `PATCH /admin/users/:id` `{ suspended }` | admin | Accounts; suspend or restore |
| `GET /shops`, `GET /shops/:id`, `GET /shops/mine` | public / seller | Shops |
| `POST /shops`, `PUT /shops/:id` | seller | Create or update your shop |
| `POST /enquiries` | anyone (guest or shopper) | Send an enquiry about a product |
| `GET /enquiries`, `GET /enquiries/:id` | shopper / seller | Your enquiries, or your shop's inbox |
| `PATCH /enquiries/:id/status` | seller (owner) / admin | `new` → `contacted` → `closed` (or reopen) |
| `POST /uploads` (multipart `file`) | seller / admin | jpg/png/webp (sellers); glb/usdz too (admin only). Up to 50 MB |
| `GET /events` | anyone | Live update stream (Server-Sent Events); `501` on Vercel |
| `GET /ar/:productId[?embed=1]` | public | AR / 3D viewer page (not under `/api`) |

## Development

```bash
cd backend && npm test
```

Runs end-to-end API tests: auth, the full marketplace flow, admin-only 3D models, live photo uploads, live events, and permissions.

```bash
cd backend && npm run seed
```

Wipes and re-seeds demo data. **Stop the server first**, or the running server will overwrite the fresh data.

```bash
cd mobile && npx expo lint
```

Lints the app, including the React Compiler rules.

```bash
cd mobile && npx expo-doctor
```

Checks that dependencies match the Expo SDK.

**Configuration**
- `backend`: `PORT` (default 4000), `JWT_SECRET` (**set this in production**), `DATA_FILE`, `ADMIN_EMAIL` + `ADMIN_PASSWORD` (admin created when seeding).
- `mobile`: `EXPO_PUBLIC_API_URL`. By default the app uses the computer running Metro on port 4000. See `mobile/.env.example`.

## Deploying the website to Vercel

On Vercel, one project serves everything from a single domain:

| Path | Served by |
| --- | --- |
| `/`, `/browse`, `/product/…` | Expo web build (static, `mobile/dist`) |
| `/api/*`, `/ar/*` | Express app as one Vercel Function (`api/index.js`) |
| Database | MongoDB Atlas (`MONGODB_URI`); local dev keeps the JSON file |
| Uploads | Vercel Blob (**Public** store); local dev uses `backend/uploads` |

Routing lives in `vercel.json`.

**1. Log in to Vercel** (from the `roomfit` folder):

```bash
npx vercel login
```

**2. Create the project:**

```bash
npx vercel link
```

Accept the defaults. The build settings come from `vercel.json`.

**3. Add storage** in the Vercel dashboard → your project → **Storage**:
- **MongoDB Atlas** (Marketplace, free tier) adds `MONGODB_URI`.
- **Blob:** create a store with access set to **Public**. It adds the Blob credentials.

**4. Add environment variables** under Settings → Environment Variables:
- `JWT_SECRET`: a long random string. **The API refuses to start without it in production.**
- `SEED_DEMO`: `true` fills an empty database with the demo shops on the first request. Remove it once you have real data.

**5. Deploy:**

```bash
npx vercel --prod
```

Open the URL it prints. You can also push the folder to GitHub and import it at vercel.com/new; it redeploys on every push.

**Limits and notes**
- Vercel Functions accept at most 4.5 MB per request. Uploads through the site are capped at **4 MB**; for bigger `.glb` models, the admin pastes a link instead.
- Live updates fall back to 5-second refreshes on Vercel (see [Live updates](#live-updates)).
- After deploying with a real database, create your admin account: `MONGODB_URI=… npm run create-admin --prefix backend -- <email> <password>`.
- `npm run seed` **wipes** whichever database it's pointed at. Only run it with `MONGODB_URI` set if you mean to reset production.
- Test the MongoDB adapter locally with `npm run test:mongo --prefix backend` (uses an in-memory MongoDB).
- For the Android app against the live site, build with `EXPO_PUBLIC_API_URL=https://<your-domain>`.

## Going to production

- Set a strong `JWT_SECRET`, add rate limiting on `/auth`, and add spam protection (e.g. a CAPTCHA or rate limit) on `POST /enquiries` if it gets abused.
- Product search filters in memory after a database query. That's fine for thousands of products; add MongoDB text indexes beyond that.
- Build the native apps with EAS: `npx eas-cli@latest build`.

## Project layout

```text
backend/
  src/app.js          Express app (routes, static uploads, AR page)
  src/arPage.js       model-viewer AR / 3D page
  src/events.js       live-update pub/sub
  src/activity.js     activity log for the admin portal
  src/routes/         auth, shops, products, enquiries, uploads, admin, events
  scripts/create-admin.js
  src/seed.js         demo shops, products, accounts
  test/api.test.js    end-to-end API tests
mobile/
  src/app/            Expo Router screens
    (shop)/           shopper tabs: home, browse, enquiries, account
    (seller)/         seller tabs: dashboard, products, enquiry inbox, profile
    (admin)/          admin tabs: overview, enquiries, shops, users, AR studio
    admin/            shop and account details, activity log, 3D model editor
    product/[id].js   product page (3D, AR, fit checker, enquire)
    enquire/[id].js   enquiry form (works for guests)
    enquiry/[id].js   enquiry detail and seller follow-up
    seller/           product and shop forms
  src/components/     UI kit, ProductCard, ModelPreview, FitChecker, …
  src/lib/            api client, config, live updates, ar launcher, fit logic
```

3D models: [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) (see each model's license).
