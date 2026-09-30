import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { ChatRequest, SearchQuery } from './schemas.ts';
import { handleChat, type Deps } from './agent/orchestrator.ts';

const MAX_BODY = 10_000, RATE_MAX = 30, RATE_WINDOW = 60_000;
const STATIC: Record<string, [string, string]> = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
const SEC = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'self'; frame-ancestors 'none'" };

export function createServer(deps: Deps) {
  const hits = new Map<string, { n: number; reset: number }>();
  const limited = (ip: string) => {
    const now = Date.now(); const h = hits.get(ip);
    if (!h || now > h.reset) { hits.set(ip, { n: 1, reset: now + RATE_WINDOW }); return false; }
    return ++h.n > RATE_MAX;
  };
  return http.createServer(async (req, res) => {
    const requestId = randomUUID(); const t0 = Date.now();
    const send = (status: number, body: unknown, type = 'application/json') => {
      res.writeHead(status, { 'content-type': type, 'x-request-id': requestId, ...SEC });
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    };
    const err = (status: number, code: string, message: string) => send(status, { error: { code, message, requestId } });
    try {
      const url = new URL(req.url ?? '/', 'http://localhost'); const path = url.pathname;
      if (req.method === 'GET' && STATIC[path]) {
        const [file, type] = STATIC[path];
        return send(200, await readFile(new URL(`../public/${file}`, import.meta.url)), type);
      }
      if (req.method === 'GET' && path === '/api/health') return send(200, { status: 'ok', demoData: true });
      if (req.method === 'POST' && path === '/api/chat') {
        if (limited(req.socket.remoteAddress ?? 'unknown')) return err(429, 'rate_limited', 'Too many requests. Please slow down.');
        const chunks: Buffer[] = []; let size = 0;
        for await (const c of req) { size += (c as Buffer).length; if (size > MAX_BODY) return err(413, 'payload_too_large', 'Request too large.'); chunks.push(c as Buffer); }
        let json: unknown;
        try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return err(400, 'invalid_json', 'Malformed JSON.'); }
        const parsed = ChatRequest.safeParse(json);
        if (!parsed.success) return err(400, 'invalid_request', 'Invalid request: a non-empty message (max 1000 chars) and language "en" or "ar" are required.');
        return send(200, { ...(await handleChat(deps, parsed.data, requestId)), requestId });
      }
      if (req.method === 'GET' && path.startsWith('/api/')) {
        const q = SearchQuery.safeParse(Object.fromEntries(url.searchParams));
        if (!q.success) return err(400, 'invalid_query', 'Invalid query parameters.');
        const seg = path.split('/').filter(Boolean); // ['api', resource, id?]
        if (seg[1] === 'specialties' && seg.length === 2) return send(200, { data: await deps.repo.listSpecialties() });
        if (seg[1] === 'doctors' && seg.length === 2) return send(200, { data: await deps.repo.searchDoctors(q.data), demoData: true });
        if (seg[1] === 'hospitals' && seg.length === 2) return send(200, { data: await deps.repo.searchHospitals(q.data), demoData: true });
        if (seg[1] === 'doctors' && seg.length === 3) {
          if (!/^DOC-\d{3}$/.test(seg[2])) return err(400, 'invalid_id', 'Invalid doctor id.');
          const r = await deps.repo.getDoctor(seg[2]); return r ? send(200, { data: r, demoData: true }) : err(404, 'not_found', 'Doctor not found.');
        }
        if (seg[1] === 'hospitals' && seg.length === 3) {
          if (!/^HOSP-\d{3}$/.test(seg[2])) return err(400, 'invalid_id', 'Invalid hospital id.');
          const r = await deps.repo.getHospital(seg[2]); return r ? send(200, { data: r, demoData: true }) : err(404, 'not_found', 'Hospital not found.');
        }
      }
      return err(404, 'not_found', 'Not found.');
    } catch {
      deps.log('unhandled_error', { requestId, category: 'internal' });
      if (!res.headersSent) err(500, 'internal_error', 'Something went wrong. Please try again.');
    } finally {
      deps.log('request', { requestId, method: req.method, path: req.url?.split('?')[0], status: res.statusCode, ms: Date.now() - t0 });
    }
  });
}
