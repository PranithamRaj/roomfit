const os = require('os');
const db = require('./db');
const { createApp } = require('./app');
const { seed } = require('./seed');

const PORT = Number(process.env.PORT) || 4000;

async function main() {
  if (!(await db.users.findOne({}))) await seed();

  createApp().listen(PORT, '0.0.0.0', () => {
    const lan = Object.values(os.networkInterfaces())
      .flat()
      .filter((i) => i && i.family === 'IPv4' && !i.internal)
      .map((i) => `http://${i.address}:${PORT}`);
    console.log(`RoomFit API listening on http://localhost:${PORT} (${db.kind} database)`);
    if (lan.length) console.log(`On your phone (same Wi-Fi): ${lan.join('  ')}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
