(function (root) {
  'use strict';

  var DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  var MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  // ---------- التواريخ (نصوص YYYY-MM-DD بالتوقيت المحلي) ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && fmt(parse(s)) === s; }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return fmt(d); }
  function today() { return fmt(new Date()); }
  // بداية الأسبوع = الاثنين
  function weekStart(s) { var dow = (parse(s).getDay() + 6) % 7; return addDays(s, -dow); }
  function longDate(s, todayStr, forceYear) {
    var d = parse(s);
    var out = DAYS[d.getDay()] + '، ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
    if (forceYear || (todayStr && d.getFullYear() !== parse(todayStr).getFullYear())) out += ' ' + d.getFullYear();
    return out;
  }
  function shortDate(s) { var d = parse(s); return d.getDate() + '/' + (d.getMonth() + 1); }
  function dayName(s) { return DAYS[parse(s).getDay()]; }

  // ---------- الحالة ----------
  // state = { version, tasks: [{id, name, deleted, periods:[{from, to|null}]}], records: { 'YYYY-MM-DD': { taskId: 0.5 | 1 } } }
  // period.to = أول يوم لم تعد فيه المهمة مطلوبة (غير شامل). غياب السجل = 0 (لم يتم).
  function emptyState() { return { version: 1, tasks: [], records: {} }; }
  function newId() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function findTask(state, id) { for (var i = 0; i < state.tasks.length; i++) if (state.tasks[i].id === id) return state.tasks[i]; return null; }

  function isEligible(task, date) {
    return task.periods.some(function (p) { return p.from <= date && (!p.to || date < p.to); });
  }
  function isEnabled(task) { return task.periods.some(function (p) { return !p.to; }); }
  function eligibleTasks(state, date) { return state.tasks.filter(function (t) { return isEligible(t, date); }); }

  function scoreOf(state, date, id) {
    var r = state.records[date];
    var v = r ? r[id] : 0;
    return v === 1 || v === 0.5 ? v : 0;
  }

  // ---------- العمليات ----------
  function addTask(state, name, date) {
    name = String(name || '').trim().slice(0, 100);
    if (!name) return null;
    var t = { id: newId(), name: name, deleted: false, periods: [{ from: date, to: null }] };
    state.tasks.push(t);
    return t;
  }
  function renameTask(state, id, name) {
    var t = findTask(state, id);
    name = String(name || '').trim().slice(0, 100);
    if (!t || !name) return false;
    t.name = name;
    return true;
  }
  function disableTask(state, id, date) {
    var t = findTask(state, id);
    if (!t) return;
    var p = t.periods.filter(function (x) { return !x.to; })[0];
    if (!p) return;
    // لو اتسجّل لليوم حالة فعلية، اليوم يفضل محسوب. غير كده التعطيل يبدأ من اليوم.
    var end = scoreOf(state, date, id) > 0 ? addDays(date, 1) : date;
    if (end <= p.from) t.periods.splice(t.periods.indexOf(p), 1);
    else p.to = end;
  }
  function enableTask(state, id, date) {
    var t = findTask(state, id);
    if (!t || isEnabled(t)) return;
    var reopen = t.periods.filter(function (p) { return p.to && p.to >= date && p.from < date; })[0];
    if (reopen && reopen.to <= addDays(date, 1)) reopen.to = null;
    else t.periods.push({ from: date, to: null });
  }
  function deleteTask(state, id, date) {
    var t = findTask(state, id);
    if (!t) return;
    disableTask(state, id, date);
    t.deleted = true; // السجلات القديمة تفضل محفوظة للتقارير
  }
  function setStatus(state, date, id, v) {
    if (!isDate(date) || (v !== 0 && v !== 0.5 && v !== 1)) return;
    var rec = state.records[date] || (state.records[date] = {});
    if (v === 0) delete rec[id]; else rec[id] = v;
    if (!Object.keys(rec).length) delete state.records[date];
  }

  // ---------- الحسابات ----------
  function daySummary(state, date) {
    var ts = eligibleTasks(state, date);
    var full = 0, partial = 0, none = 0, sum = 0;
    ts.forEach(function (t) {
      var s = scoreOf(state, date, t.id);
      if (s === 1) full++; else if (s === 0.5) partial++; else none++;
      sum += s;
    });
    return { date: date, future: false, total: ts.length, full: full, partial: partial, none: none, sum: sum,
      percent: ts.length ? sum / ts.length * 100 : null };
  }
  function weekSummary(state, start, todayStr) {
    var days = [], total = 0, full = 0, partial = 0, none = 0, sum = 0;
    for (var i = 0; i < 7; i++) {
      var d = addDays(start, i);
      if (d > todayStr) {
        days.push({ date: d, future: true, total: 0, full: 0, partial: 0, none: 0, sum: 0, percent: null });
        continue;
      }
      var s = daySummary(state, d);
      days.push(s);
      total += s.total; full += s.full; partial += s.partial; none += s.none; sum += s.sum;
    }
    return { start: start, end: addDays(start, 6), days: days, total: total, full: full, partial: partial, none: none, sum: sum,
      percent: total ? sum / total * 100 : null };
  }

  // ---------- تنظيف البيانات (تحميل/استيراد) ----------
  function sanitize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!Array.isArray(raw.tasks) && !(raw.records && typeof raw.records === 'object')) return null;
    var out = emptyState();
    var seen = {};
    (Array.isArray(raw.tasks) ? raw.tasks : []).forEach(function (t) {
      if (!t || typeof t.id !== 'string' || typeof t.name !== 'string' || seen[t.id]) return;
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(t.id)) return;
      seen[t.id] = true;
      var periods = (Array.isArray(t.periods) ? t.periods : [])
        .filter(function (p) { return p && isDate(p.from) && (p.to == null || isDate(p.to)); })
        .map(function (p) { return { from: p.from, to: p.to || null }; });
      out.tasks.push({ id: t.id, name: t.name.slice(0, 100), deleted: !!t.deleted, periods: periods });
    });
    if (raw.records && typeof raw.records === 'object') {
      Object.keys(raw.records).forEach(function (d) {
        var r = raw.records[d];
        if (!isDate(d) || !r || typeof r !== 'object') return;
        var o = {};
        Object.keys(r).forEach(function (id) { if (r[id] === 1 || r[id] === 0.5) o[id] = r[id]; });
        if (Object.keys(o).length) out.records[d] = o;
      });
    }
    return out;
  }

  var api = {
    fmt: fmt, parse: parse, isDate: isDate, addDays: addDays, today: today, weekStart: weekStart,
    longDate: longDate, shortDate: shortDate, dayName: dayName,
    emptyState: emptyState, findTask: findTask, isEligible: isEligible, isEnabled: isEnabled,
    eligibleTasks: eligibleTasks, scoreOf: scoreOf,
    addTask: addTask, renameTask: renameTask, disableTask: disableTask, enableTask: enableTask,
    deleteTask: deleteTask, setStatus: setStatus,
    daySummary: daySummary, weekSummary: weekSummary, sanitize: sanitize
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Core = api;
})(typeof window !== 'undefined' ? window : globalThis);
