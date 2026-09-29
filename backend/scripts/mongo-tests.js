// Runs the API test suite against a throwaway in-memory MongoDB (the production adapter).
const { spawnSync } = require('child_process');
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const mongo = await MongoMemoryServer.create();
  const result = spawnSync(process.execPath, ['--test', 'test/api.test.js'], {
    stdio: 'inherit',
    env: { ...process.env, MONGODB_URI: mongo.getUri(), MONGODB_DB: 'roomfit-test' },
  });
  await mongo.stop();
  process.exit(result.status ?? 1);
})();
