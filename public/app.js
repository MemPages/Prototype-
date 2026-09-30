// Vanilla JS on purpose (no build step, works offline). All server text is inserted via textContent (no XSS).
const UI = {
  en: { subtitle: 'Your healthcare navigation assistant', demo: 'DEMO DATA: fictional doctors and hospitals. Not medical advice.', ph: 'Describe your situation…', send: 'Send',
    hello: 'Hi, I can help you work out which healthcare option may be appropriate (emergency care, a specialist, or a second opinion). I cannot diagnose. What is going on?',
    starters: ["I have chest pain and I'm not sure whether I should see a cardiologist, go to the ER, or get a second opinion.", "I've had recurring chest discomfort for a few weeks and my doctor suggested a cardiologist. I'm in Riyadh.", 'I already received a diagnosis and want another opinion.'],
    thinking: 'Thinking…', error: 'Something went wrong. Please try again. If this is an emergency, call your local emergency number.', yrs: 'yrs experience', er: 'Emergency dept', city: 'City', langs: 'Languages', disc: 'HealTrip AI is a navigation aid, not a medical diagnosis.' },
  ar: { subtitle: 'مساعدك للتوجيه الصحي', demo: 'بيانات تجريبية: أطباء ومستشفيات وهمية. ليست نصيحة طبية.', ph: 'صف حالتك…', send: 'إرسال',
    hello: 'مرحبًا، يمكنني مساعدتك في معرفة الخيار الصحي المناسب (رعاية طارئة، أخصائي، أو رأي ثانٍ). لا أستطيع التشخيص. ما الذي يحدث؟',
    starters: ['عندي ألم في الصدر ولست متأكدًا هل أراجع طبيب قلب أم الطوارئ أم أطلب رأيًا ثانيًا.', 'أعاني من انزعاج متكرر في الصدر منذ أسابيع وأوصى طبيبي بزيارة طبيب قلب. أنا في الرياض.', 'حصلت على تشخيص وأريد رأيًا طبيًا آخر.'],
    thinking: 'جارٍ التفكير…', error: 'حدث خطأ. حاول مرة أخرى. وإذا كانت حالة طارئة فاتصل برقم الطوارئ المحلي.', yrs: 'سنة خبرة', er: 'طوارئ', city: 'المدينة', langs: 'اللغات', disc: 'HealTrip AI أداة إرشاد وليست تشخيصًا طبيًا.' },
};
let lang = 'en', sessionId, busy = false;
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

function applyLang(l) {
  lang = l; const u = UI[l];
  document.documentElement.lang = l; document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  $('subtitle').textContent = u.subtitle; $('demo').textContent = u.demo; $('input').placeholder = u.ph; $('send').textContent = u.send; $('disclaimer').textContent = u.disc;
  $('btn-ar').classList.toggle('on', l === 'ar'); $('btn-en').classList.toggle('on', l === 'en');
  $('chat').replaceChildren(); $('replies').replaceChildren(); sessionId = undefined; // new session per language keeps server state consistent
  addMsg('ai', u.hello); showReplies(u.starters);
}
function addMsg(who, text, opts = {}) {
  const m = el('div', `msg ${who === 'user' ? 'user' : ''} ${opts.emergency ? 'emergency' : ''}`, text);
  if (opts.doctors?.length || opts.hospitals?.length) {
    const cards = el('div', 'cards'), u = UI[lang], ar = lang === 'ar';
    for (const d of opts.doctors || []) { const c = el('div', 'card'); c.append(el('b', '', ar ? d.name_ar : d.name), el('span', '', `${ar ? d.specialty_ar : d.specialty} · ${d.years_experience} ${u.yrs}`), el('div', 'tag', `${u.city}: ${d.city} · ${u.langs}: ${d.languages.join(', ')} · ${d.id} · ${d.hospital_id}`)); cards.append(c); }
    for (const h of opts.hospitals || []) { const c = el('div', 'card'); c.append(el('b', '', ar ? h.name_ar : h.name), el('span', '', `${h.city} · ${h.address}`), el('div', 'tag', `${h.specialties.join(', ')}${h.emergency_available ? ' · ' + u.er : ''} · ${h.id}`)); cards.append(c); }
    m.append(cards);
  }
  $('chat').append(m); $('chat').scrollTop = $('chat').scrollHeight;
}
function showReplies(list) {
  $('replies').replaceChildren(...list.map((t) => { const b = el('button', '', t); b.type = 'button'; b.onclick = () => send(t); return b; }));
}
async function send(text) {
  text = text.trim(); if (!text || busy) return;
  busy = true; $('send').disabled = true; $('replies').replaceChildren(); addMsg('user', text);
  $('status').className = 'status'; $('status').textContent = UI[lang].thinking; $('input').value = '';
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, message: text, language: lang }) });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json(); sessionId = j.sessionId; $('status').textContent = '';
    addMsg('ai', j.message, { emergency: j.emergency, doctors: j.recommendations.doctors, hospitals: j.recommendations.hospitals });
    showReplies(j.suggestedReplies || []);
  } catch { $('status').className = 'status err'; $('status').textContent = UI[lang].error; }
  finally { busy = false; $('send').disabled = false; }
}
$('form').addEventListener('submit', (e) => { e.preventDefault(); send($('input').value); });
$('btn-ar').onclick = () => applyLang('ar'); $('btn-en').onclick = () => applyLang('en');
applyLang('en');
