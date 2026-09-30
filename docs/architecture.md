# Architecture
**Why this stack:** Node/TypeScript + Zod give one language and runtime validation at every trust boundary. SQLite (built into Node 22) lets the prototype run anywhere; `Repo` is an async interface so Postgres is a drop-in.
**Layers:** `server.ts` (HTTP, limits) → `safety/` (deterministic) → `agent/orchestrator.ts` (loop, validation, composition) → `agent/providers/*` (LLM abstraction) → `tools/` (Zod-validated) → `db/` (Repo).
**Trust boundaries:** Browser (untrusted) → API (validates) → LLM (untrusted output: schema + grounding checks) → DB (trusted). Only the DB may originate doctor/hospital facts.
**Failure modes:** LLM timeout/error/garbage → safe fallback message; DB down → tool_error → "couldn't retrieve"; ungrounded name → fallback; rate/size limits → 429/413.
**Scalability:** stateless API except sessions (move to Redis); DB indexed on (specialty, city); provider calls bounded (4 steps, timeout).
