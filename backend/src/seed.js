// Demo data. Run `npm run seed` to wipe and re-seed.
// 3D models are CC-BY/CC0 samples from the Khronos glTF-Sample-Assets repository.
const bcrypt = require('bcryptjs');
const db = require('./db');

const KHR = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models';
const model = (name) => `${KHR}/${name}/glTF-Binary/${name}.glb`;
const shot = (name, ext = 'jpg') => `${KHR}/${name}/screenshot/screenshot.${ext}`;

const DEMO_PASSWORD = 'password123';

const SHOPS = [
  {
    owner: { name: 'Meera Kapoor', email: 'seller@oakandloom.test' },
    shop: {
      name: 'Oak & Loom',
      description: 'Hand-finished sofas and lounge seating, upholstered in our own workshop.',
      city: 'Bengaluru',
      address: '12 Residency Road',
      phone: '+91 98450 00001',
      logo: shot('GlamVelvetSofa'),
      coverImage: shot('SheenWoodLeatherSofa'),
    },
    products: [
      {
        name: 'Glam Velvet Sofa',
        category: 'Sofas',
        price: 48999,
        stock: 6,
        material: 'Velvet, solid wood frame',
        color: 'Midnight blue',
        description: 'A plush three-seater with deep cushions and a soft velvet finish that catches the light.',
        model: 'GlamVelvetSofa',
        dimensions: { width: 219, depth: 102, height: 79 },
      },
      {
        name: 'Heritage Wood & Leather Sofa',
        category: 'Sofas',
        price: 62500,
        stock: 3,
        material: 'Top-grain leather, walnut',
        color: 'Cognac',
        description: 'Mid-century lines, walnut arms and hand-stitched leather that ages beautifully.',
        model: 'SheenWoodLeatherSofa',
        dimensions: { width: 273, depth: 92, height: 112 },
      },
      {
        name: 'Silk Floor Pouf',
        category: 'Decor',
        price: 6499,
        stock: 15,
        material: 'Silk blend',
        color: 'Pearl',
        description: 'A sculpted pouf for extra seating or a footrest. Light enough to move anywhere.',
        model: 'SpecularSilkPouf',
        dimensions: { width: 61, depth: 61, height: 20 },
      },
    ],
  },
  {
    owner: { name: 'Arjun Rao', email: 'seller@chairhouse.test' },
    shop: {
      name: 'The Chair House',
      description: 'Accent chairs and armchairs, from statement velvets to timeless damask.',
      city: 'Mumbai',
      address: '88 Linking Road, Bandra',
      phone: '+91 98200 00002',
      logo: shot('SheenChair'),
      coverImage: shot('ChairDamaskPurplegold'),
    },
    products: [
      {
        name: 'Sheen Accent Chair',
        category: 'Chairs',
        price: 14999,
        stock: 10,
        material: 'Performance fabric, beech legs',
        color: 'Mango velvet',
        description: 'A curvy accent chair with a soft sheen fabric. Small footprint, big personality.',
        model: 'SheenChair',
        dimensions: { width: 83, depth: 57, height: 69 },
      },
      {
        name: 'Damask Armchair',
        category: 'Chairs',
        price: 21999,
        stock: 4,
        material: 'Damask jacquard, carved wood',
        color: 'Purple & gold',
        description: 'A regal carved armchair upholstered in woven damask.',
        model: 'ChairDamaskPurplegold',
        dimensions: { width: 83, depth: 57, height: 69 },
      },
    ],
  },
  {
    owner: { name: 'Sara Thomas', email: 'seller@lumen.test' },
    shop: {
      name: 'Lumen & Glass',
      description: 'Lighting and glass decor to finish a room.',
      city: 'Kochi',
      address: '5 Marine Drive',
      phone: '+91 98470 00003',
      logo: shot('AnisotropyBarnLamp'),
      coverImage: shot('GlassVaseFlowers'),
    },
    products: [
      {
        name: 'Brushed Barn Lamp',
        category: 'Lighting',
        price: 7999,
        stock: 20,
        material: 'Brushed steel',
        color: 'Gunmetal',
        description: 'Industrial barn-style lamp with a brushed metal shade.',
        model: 'AnisotropyBarnLamp',
        dimensions: { width: 19, depth: 23, height: 26 },
      },
      {
        name: 'Iridescent Table Lamp',
        category: 'Lighting',
        price: 5499,
        stock: 12,
        material: 'Iridescent glass, metal',
        color: 'Rainbow sheen',
        description: 'A table lamp whose shade shifts colour as you move around it.',
        model: 'IridescenceLamp',
        dimensions: { width: 30, depth: 30, height: 48 },
      },
      {
        name: 'Glass Vase with Flowers',
        category: 'Decor',
        price: 2499,
        stock: 30,
        material: 'Hand-blown glass',
        color: 'Clear',
        description: 'A hand-blown glass vase, arranged and ready to brighten a side table.',
        model: 'GlassVaseFlowers',
        dimensions: { width: 22, depth: 14, height: 20 },
      },
      {
        name: 'Hurricane Candle Holder',
        category: 'Decor',
        price: 1899,
        stock: 25,
        material: 'Glass, brass',
        color: 'Clear / brass',
        description: 'A classic hurricane lantern for a warm, flickering glow.',
        model: 'GlassHurricaneCandleHolder',
        dimensions: { width: 19, depth: 19, height: 31 },
      },
    ],
  },
];

// Wipes the database (file or MongoDB) and inserts the demo data.
async function seed({ log = true } = {}) {
  await db.reset();
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await db.users.insert({ name: 'Demo Buyer', email: 'buyer@roomfit.test', role: 'buyer', passwordHash: hash });

  let products = 0;
  for (const entry of SHOPS) {
    const owner = await db.users.insert({ ...entry.owner, role: 'seller', passwordHash: hash });
    const shop = await db.shops.insert({ ...entry.shop, ownerId: owner.id });
    for (const { model: name, ...p } of entry.products) {
      await db.products.insert({ placement: 'floor', ...p, shopId: shop.id, modelUrl: model(name), iosModelUrl: '', images: [shot(name)] });
      products += 1;
    }
  }

  if (log) {
    console.log(`Seeded ${SHOPS.length} shops and ${products} products into the ${db.kind} database.`);
    console.log(`Demo logins (password "${DEMO_PASSWORD}"): buyer@roomfit.test, seller@oakandloom.test`);
  }
}

if (require.main === module) {
  seed()
    .then(() => db.close())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seed, DEMO_PASSWORD };
