import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDeps, assertGrounded } from './helpers.ts';
import { handleChat } from '../src/agent/orchestrator.ts';
import type { LLMProvider } from '../src/types.ts';

const chat = (deps: any, message: string, language: 'en' | 'ar' = 'en', sessionId?: string) => handleChat(deps, { message, language, sessionId }, 'req-test');
const has = (s: string, re: RegExp) => re.test(s);

test('emergency: guidance first, NO tools called, no doctors', async () => {
  const deps = makeDeps();
  const r = await chat(deps, 'I have severe chest pain and difficulty breathing.');
  assert.equal(r.emergency, true); assert.equal(r.decision.recommended_action, 'seek_emergency_care');
  assert.equal(r.toolCalls.length, 0); assert.equal(r.recommendations.doctors.length, 0);
});
test('normal flow (EN): screen question -> No -> DB doctors + hospitals, no repeated question', async () => {
  const deps = makeDeps();
  const a = await chat(deps, "I have chest pain and I'm not sure whether I should see a cardiologist, go to the ER, or seek a second opinion.");
  assert.equal(a.decision.recommended_action, 'ask_questions'); assert.deepEqual(a.suggestedReplies, ['Yes', 'No']);
  assert.equal(a.recommendations.doctors.length, 0);
  const b = await chat(deps, 'No', 'en', a.sessionId);
  assert.ok(['consult_specialist', 'seek_second_opinion'].includes(b.decision.recommended_action));
  assert.ok(b.recommendations.doctors.length > 0); assert.ok(b.toolCalls.some((t) => t.name === 'search_doctors' && t.ok));
  assert.ok(!b.message.includes('trouble breathing'), 'screening question must not repeat');
  await assertGrounded(deps, b, assert);
});
test('screening "Yes" escalates to emergency without searching', async () => {
  const deps = makeDeps();
  const a = await chat(deps, 'I have chest pain, unsure who to see');
  const b = await chat(deps, 'Yes', 'en', a.sessionId);
  assert.equal(b.emergency, true); assert.equal(b.toolCalls.length, 0);
});
test('scenario 2: doctor referral skips screening and searches DB', async () => {
  const deps = makeDeps();
  const r = await chat(deps, "I've had recurring chest discomfort for a few weeks and my doctor suggested seeing a cardiologist. I'm in Riyadh.");
  assert.equal(r.decision.recommended_action, 'consult_specialist');
  assert.ok(r.recommendations.doctors.every((d: any) => d.city === 'Riyadh' && d.specialty === 'Cardiology'));
  await assertGrounded(deps, r, assert);
});
test('scenario 3: second opinion asks specialty, then searches', async () => {
  const deps = makeDeps();
  const a = await chat(deps, 'I already received a diagnosis and want another opinion.');
  assert.equal(a.decision.recommended_action, 'ask_questions'); assert.equal(a.recommendations.doctors.length, 0);
  const b = await chat(deps, 'It is about my heart', 'en', a.sessionId);
  assert.equal(b.decision.recommended_action, 'seek_second_opinion'); assert.ok(b.recommendations.doctors.length > 0);
  await assertGrounded(deps, b, assert);
});
test('Arabic input: Arabic replies, Arabic flow works, Arabic emergency works', async () => {
  const deps = makeDeps();
  const a = await chat(deps, 'عندي ألم في الصدر', 'ar');
  assert.ok(has(a.message, /[\u0600-\u06FF]/)); assert.deepEqual(a.suggestedReplies, ['نعم', 'لا']);
  const b = await chat(deps, 'لا', 'ar', a.sessionId);
  assert.ok(b.recommendations.doctors.length > 0); assert.ok(has(b.message, /[\u0600-\u06FF]/));
  const e = await chat(makeDeps(), 'لدي صعوبة في التنفس', 'ar');
  assert.equal(e.emergency, true);
});
test('no matching options: explicit "could not find", no fabricated alternatives', async () => {
  const deps = makeDeps();
  const r = await chat(deps, 'I have a skin rash, I prefer a dermatologist in Jeddah');
  assert.equal(r.recommendations.doctors.length, 0); assert.equal(r.recommendations.hospitals.length, 0);
  assert.match(r.message, /couldn't find a matching Dermatology option/);
});
test('malformed LLM response => safe fallback, never forwarded', async () => {
  const bad: LLMProvider = { name: 'bad', next: async () => ({ kind: 'final', draft: { hello: 'world', urgency: 'banana' } }) };
  const r = await chat(makeDeps(bad), 'knee pain');
  assert.equal(r.decision.recommended_action, 'ask_questions'); assert.equal(r.recommendations.doctors.length, 0);
});
test('ANTI-HALLUCINATION: LLM naming a fake doctor/hospital is blocked', async () => {
  const liar: LLMProvider = { name: 'liar', next: async (ctx) => ctx.toolResults.length === 0
    ? { kind: 'tool_calls', calls: [{ name: 'search_doctors', args: { specialty: 'Cardiology' } }] }
    : { kind: 'final', draft: { urgency: 'routine', recommended_action: 'consult_specialist', specialty: 'Cardiology', reason: 'I recommend Dr. Ahmed at Riyadh Medical Center.', questions: [], confidence: 'high' } } };
  const deps = makeDeps(liar);
  const r = await chat(deps, 'heart checkup');
  assert.ok(!/Ahmed|Riyadh Medical Center/.test(r.message)); assert.equal(r.recommendations.doctors.length, 0);
});
test('ANTI-HALLUCINATION: LLM claiming an invented specialty is blocked', async () => {
  const p: LLMProvider = { name: 'p', next: async () => ({ kind: 'final', draft: { urgency: 'routine', recommended_action: 'consult_specialist', specialty: 'Oncology', reason: 'See oncology.', questions: [], confidence: 'high' } }) };
  const r = await chat(makeDeps(p), 'knee pain');
  assert.equal(r.decision.specialty, null);
});
test('LLM cannot smuggle records: recommendations equal DB rows even if LLM asks for bogus tools', async () => {
  const p: LLMProvider = { name: 'p', next: async (ctx) => ctx.toolResults.length === 0
    ? { kind: 'tool_calls', calls: [{ name: 'get_doctor_details', args: { doctor_id: 'DOC-999' } }, { name: 'invent_doctor', args: { name: 'Dr. Fake' } }] }
    : { kind: 'final', draft: { urgency: 'routine', recommended_action: 'consult_specialist', specialty: null, reason: 'Nothing found.', questions: [], confidence: 'low' } } };
  const r = await chat(makeDeps(p), 'hello');
  assert.equal(r.recommendations.doctors.length, 0); assert.ok(r.toolCalls.every((t) => !t.ok));
});
test('LLM error and timeout => safe fallback (no exception)', async () => {
  const boom: LLMProvider = { name: 'boom', next: async () => { throw new Error('secret upstream detail'); } };
  const r1 = await chat(makeDeps(boom), 'knee pain'); assert.ok(!r1.message.includes('secret'));
  const hang: LLMProvider = { name: 'hang', next: () => new Promise(() => {}) };
  const r2 = await chat(makeDeps(hang, 50), 'knee pain'); assert.equal(r2.decision.recommended_action, 'ask_questions');
});
test('database unavailable mid-chat => safe message', async () => {
  const deps = makeDeps(); deps.db.exec('DROP TABLE specialties');
  const r = await chat(deps, 'knee pain'); assert.match(r.message, /couldn't retrieve information/);
});
