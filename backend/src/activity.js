// Operations log for the admin portal: who did what, across sellers, shoppers and admins.
// Each entry is stored in the `activity` collection and pushed live to admins
// (events with an empty audience reach admins only; see routes/events.js).
const db = require('./db');
const { publish } = require('./events');

// `actor` is the signed-in user, or { name, role: 'guest' } for guest shoppers.
async function record(type, actor, summary, refs = {}) {
  try {
    const entry = await db.activity.insert({
      type,
      actorId: actor?.id || null,
      actorName: actor?.name || 'Someone',
      actorRole: actor?.role || 'guest',
      summary,
      ...refs, // productId, shopId, enquiryId, userId
    });
    publish('activity.created', { activityId: entry.id, activityType: type }, []);
  } catch (err) {
    // Logging must never break the action it describes.
    console.error('activity log failed:', err.message);
  }
}

module.exports = { record };
