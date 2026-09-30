import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadConfig } from './config.ts';
import { openDb, migrate, SqliteRepo } from './db/sqlite.ts';
import { seed } from './db/seed.ts';
import { MockProvider } from './agent/providers/mock.ts';
import { OpenAIProvider } from './agent/providers/openai.ts';
import { SessionStore } from './agent/sessions.ts';
import { createServer } from './server.ts';

// Structured JSON logs. By design NEVER logs message text or symptoms: ids, tool names, outcomes, latency only.
const log = (event: string, f: Record<string, unknown> = {}) => console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...f }));
const cfg = loadConfig();
mkdirSync(dirname(cfg.dbPath), { recursive: true });
const db = openDb(cfg.dbPath); migrate(db); seed(db);
if (cfg.providerFellBack) log('provider_fallback', { reason: 'AI_PROVIDER=openai requested but no usable OPENAI_API_KEY; using mock' });
const provider = cfg.provider === 'openai' ? new OpenAIProvider(cfg.openaiKey!, cfg.openaiBase, cfg.openaiModel) : new MockProvider();
createServer({ repo: new SqliteRepo(db), provider, sessions: new SessionStore(), log, timeoutMs: cfg.llmTimeoutMs })
  .listen(cfg.port, () => log('listening', { port: cfg.port, provider: provider.name }));
