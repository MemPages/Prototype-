/**
 * Agent orchestrator. Pipeline per message:
 *  1. Deterministic safety layer (red flags, screening answers) -- BEFORE any LLM call.
 *  2. Bounded loop: LLM decides tool calls -> orchestrator executes them against the DB (LLM never supplies results).
 *  3. LLM draft is Zod-validated, grounded (no invented names / specialties), then composed SERVER-SIDE.
 *  4. Recommendations come exclusively from tool results. Disclaimer/sources are server-generated.
 */
import { randomUUID } from 'node:crypto';
import type { Doctor, Hospital, LLMProvider, Logger, Repo, Session, ToolResult, Lang } from '../types.ts';
import { ChatResponse, DecisionDraft, type ChatResponseT, type DecisionT } from '../schemas.ts';
import { T } from '../i18n.ts';
import { checkRedFlags, interpretYesNo } from '../safety/redFlags.ts';
import { executeTool, makeTools } from '../tools/index.ts';
import { findUngrounded } from './grounding.ts';
import type { SessionStore } from './sessions.ts';

export interface Deps { repo: Repo; provider: LLMProvider; sessions: SessionStore; log: Logger; timeoutMs: number }
const MAX_STEPS = 4;
const REC_ACTIONS = ['consult_specialist', 'seek_second_opinion', 'monitor_and_consult'];

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let h: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<never>((_, rej) => { h = setTimeout(() => rej(new Error('timeout')), ms); })]).finally(() => clearTimeout(h));
}
const asList = (d: unknown): any[] => (Array.isArray(d) ? d : d && typeof d === 'object' ? [d] : []);

export async function handleChat(deps: Deps, input: { sessionId?: string; message: string; language: Lang }, requestId: string): Promise<ChatResponseT> {
  const { repo, provider, log } = deps;
  const session = deps.sessions.getOrCreate(input.sessionId);
  const st = session.state; st.lang = input.language;
  const t = T[st.lang];
  const t0 = Date.now();
  session.history.push({ role: 'user', content: input.message });
  if (session.history.length > 20) session.history.splice(0, session.history.length - 20);

  const build = (p: { decision: Omit<DecisionT, 'type' | 'disclaimer' | 'sources'> & { sources?: string[] }; message: string; toolResults?: ToolResult[]; doctors?: Doctor[]; hospitals?: Hospital[]; replies?: string[] }): ChatResponseT => {
    const tr = p.toolResults ?? [];
    const sources = p.decision.sources ?? tr.filter((r) => r.ok).map((r) => `${r.name}: ${asList(r.data).map((x) => x.id).join(',') || 'no results'}`);
    const out = ChatResponse.parse({
      sessionId: session.id, message: p.message, emergency: p.decision.urgency === 'emergency', demoData: true,
      decision: { ...p.decision, type: 'decision', sources, disclaimer: t.disclaimer },
      recommendations: { doctors: p.doctors ?? [], hospitals: p.hospitals ?? [] },
      toolCalls: tr.map((r) => ({ name: r.name, ok: r.ok, resultCount: asList(r.data).length, ms: r.ms })),
      suggestedReplies: p.replies ?? [],
    });
    session.history.push({ role: 'assistant', content: out.message });
    log('chat_done', { requestId, sessionId: session.id, action: out.decision.recommended_action, urgency: out.decision.urgency, tools: tr.length, ms: Date.now() - t0 });
    return out;
  };
  const emergency = (rule: string, source = 'safety_rule') => {
    log('emergency_escalation', { requestId, sessionId: session.id, rule });
    return build({ decision: { urgency: 'emergency', recommended_action: 'seek_emergency_care', specialty: null, reason: t.emergency, questions: [], confidence: 'high', sources: [`${source}:${rule}`] }, message: t.emergency });
  };
  const fallback = (category: string, toolResults: ToolResult[] = [], msg = t.fallback) => {
    log('fallback', { requestId, sessionId: session.id, category });
    return build({ decision: { urgency: 'unclear', recommended_action: 'ask_questions', specialty: null, reason: msg, questions: [], confidence: 'low', sources: [] }, message: msg, toolResults });
  };

  // 1. Safety layer
  const yn = interpretYesNo(input.message);
  if (st.awaiting === 'screening') {
    if (yn === 'yes') return emergency('screening_positive', 'screening');
    if (yn === 'no') { st.screening = 'clear'; st.awaiting = null; }
    else if (!checkRedFlags(input.message))
      return build({ decision: { urgency: 'unclear', recommended_action: 'ask_questions', specialty: st.specialty, reason: t.yesNo, questions: [], confidence: 'low', sources: [] }, message: t.yesNo, replies: [t.yes, t.no] });
  }
  const flag = checkRedFlags(input.message);
  if (flag) return emergency(flag.ruleId);
  if (yn === null) st.userText = `${st.userText} ${input.message}`.trim().slice(-1500);

  // 2. Agent loop
  const tools = makeTools(repo);
  const toolResults: ToolResult[] = [];
  let draft: unknown = null;
  try {
    for (let step = 0; step < MAX_STEPS && draft === null; step++) {
      const signal = AbortSignal.timeout(deps.timeoutMs);
      const out = await withTimeout(provider.next({ lang: st.lang, userText: st.userText, state: st, history: session.history, toolResults, signal }), deps.timeoutMs);
      if (out.kind === 'final') { draft = out.draft ?? {}; break; }
      for (const call of out.calls.slice(0, 3)) {
        const r = await executeTool(tools, String(call.name), call.args);
        toolResults.push(r);
        log('tool_call', { requestId, sessionId: session.id, tool: r.name, ok: r.ok, error: r.error, ms: r.ms });
        if (r.name === 'search_specialties' && r.ok && asList(r.data)[0]) {
          const sp = asList(r.data)[0]; st.specialty = sp.name; st.specialtyAr = sp.name_ar; st.screenFirst = sp.screen_first;
        }
      }
    }
  } catch (e) {
    return fallback((e as Error).message === 'timeout' ? 'llm_timeout' : 'llm_error', toolResults);
  }
  if (draft === null) return fallback('max_steps', toolResults);

  // 3. Validate + ground the LLM draft
  const parsed = DecisionDraft.safeParse(draft);
  if (!parsed.success) { log('invalid_llm_response', { requestId, issues: parsed.error.issues.map((i) => `${i.path.join('.')}:${i.code}`) }); return fallback('invalid_llm_response', toolResults); }
  const d = parsed.data;
  if (d.urgency === 'emergency' || d.recommended_action === 'seek_emergency_care') return emergency('llm_escalation', 'llm_escalation'); // LLM may escalate, never downgrade
  const records = toolResults.filter((r) => r.ok).flatMap((r) => asList(r.data));
  const known = records.flatMap((x) => [x.name, x.name_ar]).filter(Boolean) as string[];
  if (findUngrounded([d.reason, ...d.questions].join(' '), known).length) return fallback('ungrounded_entity', toolResults);
  const allowed = new Set([st.specialty, ...toolResults.filter((r) => r.name === 'search_specialties' && r.ok).flatMap((r) => asList(r.data).map((x) => x.name))].filter(Boolean).map((x) => String(x).toLowerCase()));
  if (d.specialty && !allowed.has(d.specialty.toLowerCase())) return fallback('unknown_specialty', toolResults);

  // 4. Compose server-side; recommendations only from tool results
  const failed = toolResults.some((r) => !r.ok && r.error !== 'not_found');
  if (failed) return fallback('tool_failure', toolResults, t.toolFailed);
  const last = (n: string) => [...toolResults].reverse().find((r) => r.name === n && r.ok);
  const showRecs = REC_ACTIONS.includes(d.recommended_action);
  const doctors = showRecs ? (asList(last('search_doctors')?.data) as Doctor[]) : [];
  const hospitals = showRecs ? (asList(last('search_hospitals')?.data) as Hospital[]) : [];
  const questions = d.questions.filter((q) => !st.asked.includes(q));
  st.asked.push(...questions);
  let replies: string[] = [];
  if (d.recommended_action === 'ask_questions' && st.specialty && st.screenFirst && !st.screening && !st.asked.includes('screening') && questions.length) {
    st.asked.push('screening'); st.awaiting = 'screening'; replies = [t.yes, t.no];
  }
  const message = [d.reason, ...questions, ...(doctors.length + hospitals.length ? [t.demoNote] : [])].join('\n\n');
  return build({ decision: { ...d, questions }, message, toolResults, doctors, hospitals, replies });
}
