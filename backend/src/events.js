// In-process pub/sub for live updates, streamed to the apps over Server-Sent Events (GET /api/events).
// Events carry ids only; clients refetch whatever they show, so permissions stay in the regular routes.
// `audience` (user ids) limits who receives an event; events without one are public catalogue changes.
const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(0);

function publish(type, data = {}, audience) {
  bus.emit('event', { type, ...data, at: new Date().toISOString() }, audience);
}

function subscribe(listener) {
  bus.on('event', listener);
  return () => bus.off('event', listener);
}

module.exports = { publish, subscribe };
