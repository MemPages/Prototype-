import type { LLMProvider, ProviderContext, ProviderStep } from '../../types.ts';
import { T, extractCity } from '../../i18n.ts';

const SECOND = /second opinion|another opinion|رأي ثان|رأي آخر|رأي طبي آخر/i;
// Screening is skipped only when a clinician is already involved (referral) or a diagnosis already exists.
const REFERRED = /\b(suggested|referred|recommended|advised)\b|already (received|got|have|had).{0,20}diagnos|أوصى|حولني|نصحني|أحالني|تم تشخيص/i;
const LANG_AR = /arabic[- ]speaking|يتحدث العربية|يتكلم العربية/i;
const LANG_EN = /english[- ]speaking|يتحدث الإنجليزية/i;
const final = (draft: Record<string, unknown>): ProviderStep => ({ kind: 'final', draft });

/** Deterministic stand-in for an LLM. Mimics real tool-calling: it only DECIDES calls; it never fabricates results. */
export class MockProvider implements LLMProvider {
  name = 'mock';
  async next(ctx: ProviderContext): Promise<ProviderStep> {
    const { state: s, toolResults: tr, lang, userText: text } = ctx;
    const t = T[lang];
    if (!s.specialty && !tr.some((r) => r.name === 'search_specialties'))
      return { kind: 'tool_calls', calls: [{ name: 'search_specialties', args: { symptom_category: text.slice(0, 200) } }] };
    if (!s.specialty)
      return final({ urgency: 'unclear', recommended_action: 'ask_questions', specialty: null, reason: t.needMore, questions: [t.whichArea], confidence: 'low' });
    const name = lang === 'ar' ? (s.specialtyAr ?? s.specialty) : s.specialty;
    const second = SECOND.test(text);
    if (s.screenFirst && !s.screening && !REFERRED.test(text) && !s.asked.includes('screening'))
      return final({ urgency: 'unclear', recommended_action: 'ask_questions', specialty: s.specialty, reason: lang === 'ar' ? 'قبل البحث، أحتاج للتأكد من أن الحالة ليست عاجلة.' : 'Before searching, I want to make sure this is not urgent.', questions: [t.screeningQ], confidence: 'low' });
    const dRes = tr.find((r) => r.name === 'search_doctors');
    const hRes = tr.find((r) => r.name === 'search_hospitals');
    if (!dRes || !hRes) {
      const city = extractCity(text);
      const language = LANG_AR.test(text) ? 'Arabic' : LANG_EN.test(text) ? 'English' : undefined;
      return { kind: 'tool_calls', calls: [
        { name: 'search_doctors', args: { specialty: s.specialty, ...(city && { city }), ...(language && { language }) } },
        { name: 'search_hospitals', args: { specialty: s.specialty, ...(city && { city }) } },
      ] };
    }
    const d = Array.isArray(dRes.data) ? dRes.data.length : 0, h = Array.isArray(hRes.data) ? hRes.data.length : 0;
    return final({
      urgency: 'routine', recommended_action: second ? 'seek_second_opinion' : 'consult_specialist', specialty: s.specialty,
      reason: d + h > 0 ? t.found(name, d, h) : t.none(name), questions: [], confidence: d + h > 0 ? 'medium' : 'low',
    });
  }
}
