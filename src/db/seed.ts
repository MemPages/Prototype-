import type { DatabaseSync } from 'node:sqlite';
// ALL RECORDS BELOW ARE FICTIONAL DEMO DATA. Not real doctors, hospitals or facilities.
const SPECIALTIES: [string, string, string, string, string, number][] = [
  ['SPEC-001', 'Cardiology', 'أمراض القلب', 'Heart and circulation.', 'chest pain,chest discomfort,palpitation,heart,cardiolog,قلب,صدر,خفقان', 1],
  ['SPEC-002', 'Neurology', 'الأعصاب', 'Brain and nervous system.', 'headache,migraine,dizz,numb,seizure,neurolog,صداع,دوخة,أعصاب', 1],
  ['SPEC-003', 'Orthopedics', 'العظام', 'Bones, joints and muscles.', 'knee,back pain,joint,bone,fracture,orthop,ركبة,ظهر,مفصل,عظام', 0],
  ['SPEC-004', 'Pulmonology', 'أمراض الرئة', 'Lungs and breathing.', 'cough,asthma,lung,pulmon,سعال,ربو,رئة', 1],
  ['SPEC-005', 'Dermatology', 'الجلدية', 'Skin conditions.', 'rash,skin,acne,eczema,derma,جلد,طفح', 0],
  ['SPEC-006', 'Internal Medicine', 'الباطنة', 'General adult medicine.', 'fatigue,fever,diabetes,blood pressure,internal,تعب,حمى,سكري,ضغط', 0],
];
const HOSPITALS: [string, string, string, string, string, string[], number][] = [
  ['HOSP-001', 'HealTrip Medical Center', 'مركز هيل تريب الطبي', 'Riyadh', 'DEMO address 1, Riyadh', ['Cardiology', 'Neurology', 'Internal Medicine', 'Pulmonology'], 1],
  ['HOSP-002', 'Riyadh Care Hospital', 'مستشفى الرياض كير', 'Riyadh', 'DEMO address 2, Riyadh', ['Cardiology', 'Orthopedics', 'Dermatology'], 1],
  ['HOSP-003', 'Advanced Health Clinic', 'عيادة الصحة المتقدمة', 'Riyadh', 'DEMO address 3, Riyadh', ['Internal Medicine', 'Dermatology'], 0],
  ['HOSP-004', 'Jeddah Demo Hospital', 'مستشفى جدة التجريبي', 'Jeddah', 'DEMO address 4, Jeddah', ['Neurology', 'Orthopedics', 'Cardiology'], 1],
];
const DOCTORS: [string, string, string, string, string, string, string[], number, number][] = [
  ['DOC-001', 'Dr. Layla Demo', 'د. ليلى ديمو', 'Cardiology', 'HOSP-001', 'Riyadh', ['Arabic', 'English'], 14, 1],
  ['DOC-002', 'Dr. Omar Sample', 'د. عمر سامبل', 'Cardiology', 'HOSP-002', 'Riyadh', ['Arabic'], 9, 1],
  ['DOC-003', 'Dr. Nadia Example', 'د. نادية إكزامبل', 'Cardiology', 'HOSP-004', 'Jeddah', ['Arabic', 'English'], 20, 1],
  ['DOC-004', 'Dr. Yusuf Mockwell', 'د. يوسف موكويل', 'Neurology', 'HOSP-001', 'Riyadh', ['English', 'Arabic'], 11, 1],
  ['DOC-005', 'Dr. Huda Testani', 'د. هدى تستاني', 'Orthopedics', 'HOSP-002', 'Riyadh', ['Arabic'], 7, 1],
  ['DOC-006', 'Dr. Karim Fictional', 'د. كريم فكشنال', 'Internal Medicine', 'HOSP-003', 'Riyadh', ['Arabic', 'English'], 16, 1],
  ['DOC-007', 'Dr. Reem Placeholder', 'د. ريم بلايسهولدر', 'Dermatology', 'HOSP-003', 'Riyadh', ['English'], 6, 0],
  ['DOC-008', 'Dr. Faisal Prototype', 'د. فيصل بروتوتايب', 'Pulmonology', 'HOSP-001', 'Riyadh', ['Arabic', 'English'], 12, 1],
  ['DOC-009', 'Dr. Mona Illustrative', 'د. منى إلستريتف', 'Neurology', 'HOSP-004', 'Jeddah', ['Arabic'], 8, 1],
];
/** Idempotent: INSERT OR IGNORE, never deletes or duplicates. */
export function seed(db: DatabaseSync): void {
  const arOf = new Map(SPECIALTIES.map((s) => [s[1], s[2]]));
  const s = db.prepare(`INSERT OR IGNORE INTO specialties VALUES (?,?,?,?,?,?)`);
  const h = db.prepare(`INSERT OR IGNORE INTO hospitals VALUES (?,?,?,?,?,?,?)`);
  const d = db.prepare(`INSERT OR IGNORE INTO doctors VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  for (const r of SPECIALTIES) s.run(...r);
  for (const r of HOSPITALS) h.run(r[0], r[1], r[2], r[3], r[4], JSON.stringify(r[5]), r[6]);
  for (const r of DOCTORS) d.run(r[0], r[1], r[2], r[3], arOf.get(r[3])!, r[4], r[5], JSON.stringify(r[6]), r[7], r[8], 'DEMO DATA: fictional record.');
}
