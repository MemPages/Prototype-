import { openDb, migrate, SqliteRepo } from '../src/db/sqlite.ts';
import { seed } from '../src/db/seed.ts';
import { SessionStore } from '../src/agent/sessions.ts';
import { MockProvider } from '../src/agent/providers/mock.ts';
import type { Deps } from '../src/agent/orchestrator.ts';
import type { LLMProvider } from '../src/types.ts';

export function makeDeps(provider?: LLMProvider, timeoutMs = 2000): Deps & { db: ReturnType<typeof openDb> } {
  const db = openDb(':memory:'); migrate(db); seed(db);
  return { db, repo: new SqliteRepo(db), provider: provider ?? new MockProvider(), sessions: new SessionStore(), log: () => {}, timeoutMs };
}
/** Every doctor/hospital in a response must exist, unmodified, in the database. */
export async function assertGrounded(deps: Deps, res: any, assert: any) {
  for (const d of res.recommendations.doctors) assert.deepEqual(d, await deps.repo.getDoctor(d.id));
  for (const h of res.recommendations.hospitals) assert.deepEqual(h, await deps.repo.getHospital(h.id));
}
