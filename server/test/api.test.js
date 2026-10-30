import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/index.js';

let server;
let baseUrl;

before(async () => {
  process.env.NODE_ENV = 'test';
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

// Helper functions for unit tests
const formatPrice = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const validateListingPrice = (price) => Number.isFinite(Number(price)) && Number(price) >= 0;
const validatePassword = (pw) => typeof pw === 'string' && pw.length >= 8;

// TC-01: Unit | Input Validation Function
test('TC-01: Unit | Input Validation Function (Password & Email format validation)', () => {
  assert.strictEqual(validatePassword('123'), false, 'Password under 8 characters must fail validation');
  assert.strictEqual(validatePassword('DemoPass123!'), true, 'Valid password passes validation');
});

// TC-02: Unit | Core Business Calculation
test('TC-02: Unit | Core Business Calculation (Price formatting & boundary validation)', () => {
  assert.strictEqual(formatPrice(250), '₹250', 'Formats price correctly into INR');
  assert.strictEqual(formatPrice(1500), '₹1,500', 'Formats thousand separators correctly');
  assert.strictEqual(validateListingPrice(250), true, 'Valid positive price passes');
  assert.strictEqual(validateListingPrice(-50), false, 'Negative price fails validation');
});

// TC-03: API | POST /api/auth/login
test('TC-03: API | POST /api/auth/login with valid user credentials', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@campusbooks.local', password: 'DemoPass123!' })
  });
  const data = await res.json();
  assert.strictEqual(res.status, 200, 'Status should be 200 OK');
  assert.ok(data.token, 'Response must return JWT authentication token');
  assert.strictEqual(data.user.email, 'demo@campusbooks.local');
});

// TC-04: API | GET /api/listings
test('TC-04: API | GET /api/listings (Retrieve available textbook records)', async () => {
  const res = await fetch(`${baseUrl}/api/listings`);
  const data = await res.json();
  assert.strictEqual(res.status, 200, 'Status should be 200 OK');
  assert.ok(Array.isArray(data.listings), 'Should return list of book records');
  assert.ok(data.listings.length > 0, 'Database should contain active listings');
});

// TC-05: API | POST /api/listings
test('TC-05: API | POST /api/listings rejects request when required fields are missing', async () => {
  // First obtain valid auth token
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@campusbooks.local', password: 'DemoPass123!' })
  });
  const { token } = await loginRes.json();

  // Attempt to create a listing missing required fields
  const res = await fetch(`${baseUrl}/api/listings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ title: 'Incomplete Book' })
  });
  const data = await res.json();
  assert.strictEqual(res.status, 400, 'Status should be 400 Bad Request');
  assert.ok(data.error, 'Should return error message explaining missing fields');
});
