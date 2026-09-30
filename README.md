# RoomFit: an AR furniture marketplace

Shoppers browse furniture from local shops, **place it in their own room with AR at true size**, check it fits, and **enquire** with the shop.
Listings show no prices: shops reply to enquiries with price, availability and delivery details.

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
- Products: photos (upload or URL), real-world dimensions, **.glb 3D model upload** (plus optional .usdz for iOS), floor/wall AR placement, and an in-app AR test.
- Dashboard: new and in-progress enquiries, enquiries this week, most-asked-about piece, and alerts for a missing shop phone, unavailable pieces and missing 3D models.
- Enquiry inbox with the shopper's contact details, one-tap call/WhatsApp/email (which marks the enquiry as contacted), and status tracking.

## How the AR works

Tapping **View in your room** opens `GET /ar/:productId` in the phone's browser. This is a page rendered with `<model-viewer ar ar-scale="fixed">`:

- **Android (ARCore phones):** Chrome hands off to Google **Scene Viewer**, which places the GLB at 1:1 scale.
- **iPhone / iPad:** Safari opens **AR Quick Look**. model-viewer converts the GLB to USDZ on the fly, or uses the product's `iosModelUrl` if the seller uploaded one.
- `ar-scale="fixed"` stops the shopper from pinch-resizing the model, so what they see is the real size.

This works in Expo Go with no custom native build. The same page with `?embed=1` powers the in-app 3D preview (a WebView on native, an iframe on web).

**3D model requirements for sellers:** a `.glb` in metres (1 unit = 1 m), with the origin on the floor. The viewer measures the model and warns when it differs from the listed dimensions by more than 10%.

The demo products use Khronos glTF sample models, which are authored at real-world scale. Their listed dimensions were measured from the models themselves.

## API overview

All routes are under `/api`. Send `Authorization: Bearer <token>` where auth is needed.

| Method & path | Who | Purpose |
| --- | --- | --- |
| `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | anyone / user | Accounts (`role`: `buyer` or `seller`) |
| `GET /products?q&category&shop&maxWidth&maxDepth&maxHeight&arOnly&sort` | public | Catalogue search, including "fits my space" |
| `GET /products/:id`, `GET /products/categories` | public | Product details and related items |
| `POST/PUT/DELETE /products[/:id]` | seller (owner) | Manage products |
| `GET /shops`, `GET /shops/:id`, `GET /shops/mine` | public / seller | Shops |
| `POST /shops`, `PUT /shops/:id` | seller | Create or update your shop |
| `POST /enquiries` | anyone (guest or shopper) | Send an enquiry about a product |
| `GET /enquiries`, `GET /enquiries/:id` | shopper / seller | Your enquiries, or your shop's inbox |
| `PATCH /enquiries/:id/status` | seller (owner) | `new` → `contacted` → `closed` (or reopen) |
| `POST /uploads` (multipart `file`) | seller | jpg/png/webp/glb/usdz, up to 50 MB |
| `GET /ar/:productId[?embed=1]` | public | AR / 3D viewer page (not under `/api`) |

## Development

```bash
cd backend && npm test
```

Runs end-to-end API tests: auth, the full marketplace flow, and permissions.

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
- `backend`: `PORT` (default 4000), `JWT_SECRET` (**set this in production**), `DATA_FILE`.
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
- Vercel Functions accept at most 4.5 MB per request. Uploads through the site are capped at **4 MB**; for bigger `.glb` models, sellers paste a link instead.
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
  src/routes/         auth, shops, products, enquiries, uploads
  src/seed.js         demo shops, products, accounts
  test/api.test.js    end-to-end API tests
mobile/
  src/app/            Expo Router screens
    (shop)/           shopper tabs: home, browse, enquiries, account
    (seller)/         seller tabs: dashboard, products, enquiry inbox, profile
    product/[id].js   product page (3D, AR, fit checker, enquire)
    enquire/[id].js   enquiry form (works for guests)
    enquiry/[id].js   enquiry detail and seller follow-up
    seller/           product and shop forms
  src/components/     UI kit, ProductCard, ModelPreview, FitChecker, …
  src/lib/            api client, config, ar launcher, fit logic
```

3D models: [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) (see each model's license).
