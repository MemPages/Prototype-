import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRedFlags, interpretYesNo } from '../src/safety/redFlags.ts';

test('English red flags', () => {
  for (const m of ['I have severe chest pain and difficulty breathing', 'my father passed out', 'heavy bleeding that wont stop', 'sudden weakness on one side', 'slurred speech since morning'])
    assert.ok(checkRedFlags(m), m);
});
test('Arabic red flags', () => {
  for (const m of ['عندي ألم شديد في الصدر', 'لدي صعوبة في التنفس', 'فقدان الوعي', 'نزيف شديد', 'ضعف مفاجئ في الذراع'])
    assert.ok(checkRedFlags(m), m);
});
test('non-emergency and negated text is not flagged', () => {
  assert.equal(checkRedFlags("I have chest pain and I'm not sure whether to see a cardiologist"), null);
  assert.equal(checkRedFlags('recurring chest discomfort for a few weeks'), null);
  assert.equal(checkRedFlags('I have chest pain but no difficulty breathing'), null);
});
test('yes/no interpretation (EN + AR)', () => {
  assert.equal(interpretYesNo('Yes'), 'yes'); assert.equal(interpretYesNo('نعم'), 'yes');
  assert.equal(interpretYesNo('No.'), 'no'); assert.equal(interpretYesNo('لا'), 'no');
  assert.equal(interpretYesNo('nothing'), null);
});
