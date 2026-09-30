import type { Lang } from './types.ts';
export const CITY_ALIASES: Record<string, string> = { riyadh: 'Riyadh', 'الرياض': 'Riyadh', jeddah: 'Jeddah', 'جدة': 'Jeddah' };
export function extractCity(text: string): string | undefined {
  const l = text.toLowerCase();
  for (const [k, v] of Object.entries(CITY_ALIASES)) if (l.includes(k)) return v;
  return undefined;
}
interface Strings {
  disclaimer: string; emergency: string; fallback: string; toolFailed: string; needMore: string; whichArea: string;
  screeningQ: string; yesNo: string; demoNote: string; yes: string; no: string;
  found(spec: string, d: number, h: number): string; none(spec: string): string;
}
export const T: Record<Lang, Strings> = {
  en: {
    disclaimer: 'HealTrip AI is a navigation aid, not a medical diagnosis or a substitute for a doctor. Data shown is DEMO data only.',
    emergency: 'Your message contains warning signs that may be serious. Please call your local emergency number or go to the nearest emergency department now, and do not drive yourself. This assistant cannot diagnose or assess your condition.',
    fallback: "I'm having trouble processing that right now. If your symptoms feel severe or sudden, please seek emergency care. Otherwise, please try rephrasing.",
    toolFailed: "I couldn't retrieve information from the HealTrip database right now. Please try again shortly. If your symptoms feel severe or sudden, seek emergency care.",
    needMore: "I couldn't match that to a specialty in our controlled list yet.",
    whichArea: 'Which area is this about (for example heart, brain/nerves, bones and joints, lungs, skin, or general medicine)?',
    screeningQ: 'Do you have any of these right now: trouble breathing, pain spreading to your arm, jaw or back, sweating or fainting, or a sudden severe onset?',
    yesNo: 'Please answer Yes or No so I can make sure this is not urgent.',
    demoNote: 'Note: these are fictional DEMO records, not real providers.', yes: 'Yes', no: 'No',
    found: (s, d, h) => `Based on what you described, ${s} looks like the most relevant specialty. I searched the HealTrip demo database and found ${d} doctor(s) and ${h} hospital(s) below.`,
    none: (s) => `I couldn't find a matching ${s} option in the current HealTrip database.`,
  },
  ar: {
    disclaimer: 'HealTrip AI أداة إرشاد وليست تشخيصًا طبيًا ولا بديلًا عن الطبيب. البيانات المعروضة تجريبية فقط.',
    emergency: 'رسالتك تتضمن علامات تحذيرية قد تكون خطيرة. يرجى الاتصال برقم الطوارئ المحلي أو التوجه إلى أقرب قسم طوارئ الآن، وعدم القيادة بنفسك. هذا المساعد لا يستطيع التشخيص أو تقييم حالتك.',
    fallback: 'أواجه صعوبة في معالجة ذلك الآن. إذا كانت أعراضك شديدة أو مفاجئة فيرجى طلب الرعاية الطارئة. وإلا فحاول إعادة الصياغة.',
    toolFailed: 'تعذّر الحصول على المعلومات من قاعدة بيانات HealTrip الآن. حاول مرة أخرى بعد قليل، وإذا كانت أعراضك شديدة أو مفاجئة فاطلب الرعاية الطارئة.',
    needMore: 'لم أتمكن بعد من ربط ذلك بتخصص في قائمتنا المحددة.',
    whichArea: 'ما المجال المتعلق بالأمر (مثل القلب، الأعصاب، العظام والمفاصل، الرئة، الجلد، أو الطب العام)؟',
    screeningQ: 'هل لديك الآن أيٌّ مما يلي: صعوبة في التنفس، ألم ينتشر إلى الذراع أو الفك أو الظهر، تعرّق أو إغماء، أو بداية مفاجئة وشديدة؟',
    yesNo: 'يرجى الإجابة بنعم أو لا للتأكد من أن الحالة غير عاجلة.',
    demoNote: 'ملاحظة: هذه سجلات تجريبية وهمية وليست مقدّمي رعاية حقيقيين.', yes: 'نعم', no: 'لا',
    found: (s, d, h) => `بناءً على ما وصفته، يبدو أن تخصص ${s} هو الأكثر ملاءمة. بحثت في قاعدة بيانات HealTrip التجريبية ووجدت ${d} طبيب/أطباء و${h} مستشفى/مستشفيات أدناه.`,
    none: (s) => `لم أجد خيارًا مطابقًا في تخصص ${s} في قاعدة بيانات HealTrip الحالية.`,
  },
};
