import { randomUUID } from 'node:crypto';
import type { Session } from '../types.ts';
/** In-memory session store (prototype). Production: Redis/Postgres with encryption + retention policy. */
export class SessionStore {
  private m = new Map<string, Session>();
  private ttl: number;
  constructor(ttlMs = 30 * 60_000) { this.ttl = ttlMs; }
  getOrCreate(id?: string): Session {
    const now = Date.now();
    if (this.m.size > 1000) for (const [k, v] of this.m) if (now - v.touched > this.ttl) this.m.delete(k);
    const hit = id ? this.m.get(id) : undefined;
    if (hit && now - hit.touched <= this.ttl) { hit.touched = now; return hit; }
    const s: Session = { id: id ?? randomUUID(), touched: now, history: [], state: { lang: 'en', userText: '', specialty: null, specialtyAr: null, screenFirst: false, screening: null, awaiting: null, asked: [] } };
    this.m.set(s.id, s);
    return s;
  }
}
