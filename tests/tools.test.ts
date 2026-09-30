import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDeps } from './helpers.ts';
import { makeTools, executeTool } from '../src/tools/index.ts';

const tools = makeTools(makeDeps().repo);
test('search_doctors returns only available DB cardiologists', async () => {
  const r = await executeTool(tools, 'search_doctors', { specialty: 'Cardiology', city: 'Riyadh' });
  assert.equal(r.ok, true);
  const ids = (r.data as any[]).map((d) => d.id).sort();
  assert.deepEqual(ids, ['DOC-001', 'DOC-002']);
});
test('unavailable doctor (DOC-007) is never returned in search', async () => {
  const r = await executeTool(tools, 'search_doctors', { specialty: 'Dermatology' });
  assert.equal((r.data as any[]).length, 0);
});
test('search_hospitals returns only DB hospitals', async () => {
  const r = await executeTool(tools, 'search_hospitals', { specialty: 'Cardiology', city: 'Riyadh' });
  assert.deepEqual((r.data as any[]).map((h) => h.id), ['HOSP-001', 'HOSP-002']);
});
test('invalid doctor id: malformed => invalid_args, unknown => not_found', async () => {
  assert.equal((await executeTool(tools, 'get_doctor_details', { doctor_id: "DOC-1'; DROP TABLE doctors;--" })).error, 'invalid_args');
  const r = await executeTool(tools, 'get_doctor_details', { doctor_id: 'DOC-999' });
  assert.equal(r.ok, false); assert.equal(r.error, 'not_found');
});
test('get_doctor_details returns the exact DB record', async () => {
  const r = await executeTool(tools, 'get_doctor_details', { doctor_id: 'DOC-001' });
  assert.equal((r.data as any).name, 'Dr. Layla Demo');
});
test('no search results => empty list, nothing invented', async () => {
  const r = await executeTool(tools, 'search_doctors', { specialty: 'Cardiology', city: 'Atlantis' });
  assert.equal(r.ok, true); assert.deepEqual(r.data, []);
});
test('unknown tool and unknown specialty are handled', async () => {
  assert.equal((await executeTool(tools, 'delete_everything', {})).error, 'unknown_tool');
  assert.deepEqual((await executeTool(tools, 'search_specialties', { symptom_category: 'xyzzy' })).data, []);
});
test('DB failure is reported as tool_error, not thrown', async () => {
  const d = makeDeps(); d.db.exec('DROP TABLE doctors');
  const r = await executeTool(makeTools(d.repo), 'search_doctors', {});
  assert.equal(r.ok, false); assert.equal(r.error, 'tool_error');
});
