import type { LLMProvider, ProviderContext, ProviderStep } from '../../types.ts';
// UNVERIFIED: not exercised in the build sandbox (no network / API key). Same interface as MockProvider.
const SYSTEM = `You are HealTrip AI, a healthcare NAVIGATION assistant. You never diagnose. Use tools to find specialties, doctors and hospitals; never invent any. Do not write doctor or hospital names in your text. When done, reply with ONLY JSON: {"urgency":"emergency|urgent|routine|unclear","recommended_action":"seek_emergency_care|consult_specialist|seek_second_opinion|monitor_and_consult|ask_questions","specialty":string|null,"reason":string,"questions":string[],"confidence":"low|medium|high"}. Reply in the user's language.`;
const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []) =>
  ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } } });
const str = { type: 'string' };
const TOOL_DEFS = [
  fn('search_specialties', 'Find specialties for a symptom category from the controlled list', { symptom_category: str }, ['symptom_category']),
  fn('search_doctors', 'Search available doctors in the database', { specialty: str, city: str, language: str }),
  fn('search_hospitals', 'Search hospitals in the database', { specialty: str, city: str }),
  fn('get_doctor_details', 'Get one doctor record by id (DOC-001)', { doctor_id: str }, ['doctor_id']),
  fn('get_hospital_details', 'Get one hospital record by id (HOSP-001)', { hospital_id: str }, ['hospital_id']),
];
const safeJson = (x: unknown): unknown => { try { return JSON.parse(String(x ?? '')); } catch { return null; } };

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private key: string; private base: string; private model: string;
  constructor(key: string, base: string, model: string) { this.key = key; this.base = base; this.model = model; }
  async next(ctx: ProviderContext): Promise<ProviderStep> {
    const facts = { language: ctx.lang, specialty: ctx.state.specialty, screening_done: ctx.state.screening === 'clear', already_asked: ctx.state.asked.length };
    const messages: unknown[] = [{ role: 'system', content: SYSTEM }, { role: 'system', content: `Session facts: ${JSON.stringify(facts)}` }, ...ctx.history];
    ctx.toolResults.forEach((r, i) => {
      messages.push({ role: 'assistant', content: null, tool_calls: [{ id: `call_${i}`, type: 'function', function: { name: r.name, arguments: JSON.stringify(r.args ?? {}) } }] });
      messages.push({ role: 'tool', tool_call_id: `call_${i}`, content: JSON.stringify(r.ok ? r.data : { error: r.error }) });
    });
    const res = await fetch(`${this.base}/chat/completions`, {
      method: 'POST', signal: ctx.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.key}` },
      body: JSON.stringify({ model: this.model, messages, tools: TOOL_DEFS, temperature: 0 }),
    });
    if (!res.ok) throw new Error(`llm_http_${res.status}`);
    const msg = ((await res.json()) as any)?.choices?.[0]?.message;
    if (msg?.tool_calls?.length)
      return { kind: 'tool_calls', calls: msg.tool_calls.map((c: any) => ({ name: c.function?.name, args: safeJson(c.function?.arguments) })) };
    return { kind: 'final', draft: safeJson(msg?.content) };
  }
}
