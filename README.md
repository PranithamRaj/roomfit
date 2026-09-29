# RoomFit: an AR furniture marketplace

Shoppers browse furniture from local shops, **place it in their own room with AR at true size**, check it fits, and order.
Shops manage their catalogue (including 3D models) and fulfil orders.

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
- Cart across multiple shops. Checkout creates **one order per shop**, with cash or card on delivery (no card data is collected).
- Order tracking (placed → confirmed → shipped → delivered). You can cancel until the shop confirms; stock is restored.

**Sellers**
- Shop profile (logo, cover, address).
- Products: photos (upload or URL), real-world dimensions, **.glb 3D model upload** (plus optional .usdz for iOS), floor/wall AR placement, and an in-app AR test.
- Dashboard: orders to confirm and ship, delivered sales, open pipeline, low-stock and missing-3D-model alerts.
- Incoming orders with enforced status transitions.

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
| `GET /products?q&category&shop&minPrice&maxPrice&maxWidth&maxDepth&maxHeight&arOnly&sort` | public | Catalogue search, including "fits my space" |
| `GET /products/:id`, `GET /products/categories` | public | Product details and related items |
| `POST/PUT/DELETE /products[/:id]` | seller (owner) | Manage products |
| `GET /shops`, `GET /shops/:id`, `GET /shops/mine` | public / seller | Shops |
| `POST /shops`, `PUT /shops/:id` | seller | Create or update your shop |
| `GET/POST /cart`, `PATCH/DELETE /cart/:productId` | buyer | Cart (stock-checked) |
| `POST /orders` | buyer | Checkout (splits by shop, decrements stock) |
| `GET /orders`, `GET /orders/:id`, `PATCH /orders/:id/status` | buyer / seller | Tracking and fulfilment |
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

- Set a strong `JWT_SECRET`, add rate limiting on `/auth`, and add a real payment provider if you want online payments.
- Product search filters in memory after a database query. That's fine for thousands of products; add MongoDB text indexes beyond that.
- Build the native apps with EAS: `npx eas-cli@latest build`.

## Project layout

```text
backend/
  src/app.js          Express app (routes, static uploads, AR page)
  src/arPage.js       model-viewer AR / 3D page
  src/routes/         auth, shops, products, cart, orders, uploads
  src/seed.js         demo shops, products, accounts
  test/api.test.js    end-to-end API tests
mobile/
  src/app/            Expo Router screens
    (shop)/           shopper tabs: home, browse, cart, orders, account
    (seller)/         seller tabs: dashboard, products, sales, profile
    product/[id].js   product page (3D, AR, fit checker)
    seller/           product and shop forms
  src/components/     UI kit, ProductCard, ModelPreview, FitChecker, …
  src/lib/            api client, config, ar launcher, fit logic
```

3D models: [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) (see each model's license).
