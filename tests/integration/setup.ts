import { connectTestDb, cleanTestDatabase, disconnectTestDb } from '../testDb';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await connectTestDb();
});

beforeEach(async () => {
  await cleanTestDatabase();
});

afterAll(async () => {
  await disconnectTestDb();
});
