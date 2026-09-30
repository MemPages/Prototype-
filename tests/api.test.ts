import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { makeDeps } from './helpers.ts';
import { createServer } from '../src/server.ts';

let server: ReturnType<typeof createServer>; let base = '';
before(async () => { server = createServer(makeDeps()); await new Promise<void>((r) => server.listen(0, r)); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; });
after(() => server.close());
const post = (body: string) => fetch(`${base}/api/chat`, { method: 'POST', body, headers: { 'content-type': 'application/json' } });

test('GET doctor/hospital/specialties endpoints', async () => {
  assert.equal((await fetch(`${base}/api/doctors/DOC-001`)).status, 200);
  assert.equal((await fetch(`${base}/api/doctors/DOC-999`)).status, 404);
  assert.equal((await fetch(`${base}/api/doctors/abc`)).status, 400);
  assert.equal((await fetch(`${base}/api/hospitals/HOSP-001`)).status, 200);
  assert.equal((await fetch(`${base}/api/doctors?specialty=Cardiology&language=Arabic`)).status, 200);
  assert.equal((await fetch(`${base}/api/specialties`)).status, 200);
});
test('POST /api/chat validation: empty, malformed, oversized', async () => {
  assert.equal((await post(JSON.stringify({ message: '   ' }))).status, 400);
  assert.equal((await post('{not json')).status, 400);
  assert.equal((await post(JSON.stringify({ message: 'x'.repeat(20000) }))).status, 413);
  assert.equal((await post(JSON.stringify({ message: 'hi', language: 'fr' }))).status, 400);
});
test('POST /api/chat happy path returns validated structured response', async () => {
  const r = await post(JSON.stringify({ message: 'my doctor suggested a cardiologist in Riyadh', language: 'en' }));
  const j: any = await r.json();
  assert.equal(r.status, 200); assert.equal(j.decision.type, 'decision'); assert.ok(j.decision.disclaimer); assert.ok(j.requestId);
  assert.ok(j.recommendations.doctors.length > 0);
});
