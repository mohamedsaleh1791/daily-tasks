const assert = require('assert');
const C = require('./core.js');

function near(a, b) { assert(Math.abs(a - b) < 1e-9, a + ' != ' + b); }

// التواريخ
assert.strictEqual(C.weekStart('2026-10-09'), '2026-10-05'); // الجمعة -> الاثنين
assert.strictEqual(C.weekStart('2026-10-05'), '2026-10-05');
assert.strictEqual(C.weekStart('2026-10-11'), '2026-10-05'); // الأحد آخر الأسبوع
assert.strictEqual(C.weekStart('2026-10-12'), '2026-10-12');
assert.strictEqual(C.addDays('2026-10-31', 1), '2026-11-01');
assert.strictEqual(C.addDays('2026-12-31', 1), '2027-01-01');
assert.strictEqual(C.addDays('2026-03-01', -1), '2026-02-28');
assert(C.isDate('2026-02-28') && !C.isDate('2026-02-30') && !C.isDate('x'));
assert.strictEqual(C.longDate('2026-10-09', '2026-10-09'), 'الجمعة، 9 أكتوبر');

// اليوم: 50% زي الشكل المقترح (مكتمل + جزئي + لم يتم)
let s = C.emptyState();
const A = C.addTask(s, 'قراءة القرآن', '2026-10-05');
const B = C.addTask(s, 'الدراسة', '2026-10-05');
const D = C.addTask(s, 'الرياضة', '2026-10-05');
C.setStatus(s, '2026-10-09', A.id, 1);
C.setStatus(s, '2026-10-09', B.id, 0.5);
let d = C.daySummary(s, '2026-10-09');
near(d.percent, 50);
assert.deepStrictEqual([d.full, d.partial, d.none, d.total], [1, 1, 1, 3]);

// قبل الإنشاء: لا مهام ولا قسمة على صفر
d = C.daySummary(s, '2026-10-04');
assert.strictEqual(d.total, 0);
assert.strictEqual(d.percent, null);

// أسبوعي: مهمة جديدة في الأربعاء، وأيام مستقبلية لا تُحسب
s = C.emptyState();
const a = C.addTask(s, 'A', '2026-10-05');
const b = C.addTask(s, 'B', '2026-10-05');
const c = C.addTask(s, 'C', '2026-10-07');
C.setStatus(s, '2026-10-05', a.id, 1); C.setStatus(s, '2026-10-05', b.id, 0.5);
C.setStatus(s, '2026-10-06', a.id, 1); C.setStatus(s, '2026-10-06', b.id, 1);
C.setStatus(s, '2026-10-07', a.id, 1); C.setStatus(s, '2026-10-07', c.id, 0.5);
C.setStatus(s, '2026-10-08', a.id, 0.5); C.setStatus(s, '2026-10-08', b.id, 0.5); C.setStatus(s, '2026-10-08', c.id, 1);
C.setStatus(s, '2026-10-09', a.id, 1); C.setStatus(s, '2026-10-09', b.id, 1); C.setStatus(s, '2026-10-09', c.id, 1);
let w = C.weekSummary(s, '2026-10-05', '2026-10-09');
assert.strictEqual(w.total, 13);
near(w.sum, 10);
near(w.percent, 10 / 13 * 100);
assert(w.days[5].future && w.days[6].future);
assert.strictEqual(w.days[0].total, 2);
assert.strictEqual(w.days[2].total, 3);
assert.strictEqual(w.full + w.partial + w.none, 13);

// الأسبوع السابق (قبل أي مهام)
w = C.weekSummary(s, '2026-09-28', '2026-10-09');
assert.strictEqual(w.percent, null);

// تعطيل بدون سجل اليوم: اليوم يخرج، الماضي يفضل
const f = C.addTask(s, 'F', '2026-10-05');
C.disableTask(s, f.id, '2026-10-09');
assert(!C.isEligible(C.findTask(s, f.id), '2026-10-09'));
assert(C.isEligible(C.findTask(s, f.id), '2026-10-08'));
// تعطيل مع سجل اليوم: اليوم يفضل محسوب، بكرة لا
C.disableTask(s, b.id, '2026-10-09');
assert(C.isEligible(C.findTask(s, b.id), '2026-10-09'));
assert(!C.isEligible(C.findTask(s, b.id), '2026-10-10'));
assert.strictEqual(C.scoreOf(s, '2026-10-08', b.id), 0.5); // السجل القديم محفوظ
// تعطيل مع سجل اليوم: اليوم يفضل محسوب، بكرة لا
C.disableTask(s, c.id, '2026-10-09');
assert(C.isEligible(C.findTask(s, c.id), '2026-10-09'));
assert(!C.isEligible(C.findTask(s, c.id), '2026-10-10'));
// إعادة التفعيل لاحقًا
C.enableTask(s, b.id, '2026-10-12');
assert(!C.isEligible(C.findTask(s, b.id), '2026-10-10'));
assert(!C.isEligible(C.findTask(s, b.id), '2026-10-11'));
assert(C.isEligible(C.findTask(s, b.id), '2026-10-12'));
// تعطيل وتفعيل في نفس اليوم
const e = C.addTask(s, 'E', '2026-10-09');
C.disableTask(s, e.id, '2026-10-09');
assert(!C.isEligible(e, '2026-10-09'));
C.enableTask(s, e.id, '2026-10-09');
assert(C.isEligible(e, '2026-10-09') && C.isEnabled(e));

// حذف: يختفي من القائمة ويحتفظ بالتاريخ
C.deleteTask(s, a.id, '2026-10-09');
assert(C.findTask(s, a.id).deleted);
assert.strictEqual(C.scoreOf(s, '2026-10-05', a.id), 1);
assert(C.isEligible(C.findTask(s, a.id), '2026-10-05'));

// تعديل الاسم، وقيم غير صالحة
assert(C.renameTask(s, e.id, '  مهمة جديدة '));
assert.strictEqual(C.findTask(s, e.id).name, 'مهمة جديدة');
assert(!C.renameTask(s, e.id, '   '));
C.setStatus(s, '2026-10-09', e.id, 0.7);
assert.strictEqual(C.scoreOf(s, '2026-10-09', e.id), 0);
assert.strictEqual(C.addTask(s, '  ', '2026-10-09'), null);

// تصدير/استيراد
const back = C.sanitize(JSON.parse(JSON.stringify(s)));
assert.deepStrictEqual(back, s);
assert.strictEqual(C.sanitize(null), null);
assert.strictEqual(C.sanitize('x'), null);
assert.strictEqual(C.sanitize({ foo: 1 }), null);
const junk = C.sanitize({ tasks: [{ id: 1 }, { id: 'ok', name: 'x', periods: [{ from: 'bad' }] }], records: { bad: { x: 1 }, '2026-10-01': { ok: 5, z: 1 } } });
assert.strictEqual(junk.tasks.length, 1);
assert.strictEqual(junk.tasks[0].periods.length, 0);
assert.deepStrictEqual(junk.records, { '2026-10-01': { z: 1 } });

console.log('كل الاختبارات نجحت ✔');
