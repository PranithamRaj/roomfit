// Creates an admin account, or promotes an existing account to admin (resetting its password).
// Admins add the 3D/AR models; they can't sign up through the app.
//   npm run create-admin -- <email> <password> [name]
// Works on whichever database the API uses: set MONGODB_URI to target production.
const bcrypt = require('bcryptjs');
const db = require('../src/db');

async function main() {
  const [emailArg, password, ...nameParts] = process.argv.slice(2);
  const email = String(emailArg || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (password || '').length < 8) {
    console.error('Usage: npm run create-admin -- <email> <password (8+ characters)> [name]');
    process.exit(1);
  }
  const name = nameParts.join(' ').trim() || 'RoomFit Admin';
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await db.users.findOne({ email });
  if (existing) {
    await db.users.update(existing.id, { role: 'admin', passwordHash });
    console.log(`${email} is now an admin (was ${existing.role}) in the ${db.kind} database.`);
  } else {
    await db.users.insert({ name, email, role: 'admin', passwordHash });
    console.log(`Created admin ${email} in the ${db.kind} database.`);
  }
}

main()
  .then(() => db.close())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
