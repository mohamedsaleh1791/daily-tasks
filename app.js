(function () {
  'use strict';
  const C = window.Core;
  const KEY = 'daily-checklist-v1';
  const app = document.getElementById('app');
  const toastEl = document.getElementById('toast');
  let toastTimer;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 3500);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- التخزين ----------
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
    if (!raw) return C.emptyState();
    try {
      const s = C.sanitize(JSON.parse(raw));
      if (s) return s;
    } catch (e) { /* corrupted */ }
    try { localStorage.setItem(KEY + '-corrupt-' + Date.now(), raw); } catch (e) { /* ignore */ }
    setTimeout(function () { toast('تعذّر قراءة البيانات المحفوظة. تم الاحتفاظ بنسخة منها وبدء قائمة جديدة.'); }, 300);
    return C.emptyState();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { toast('تعذّر الحفظ على الجهاز!'); return false; }
  }

  let state = load();
  let todayStr = C.today();
  let view = 'today';
  let viewDate = todayStr;
  let repWeek = C.weekStart(todayStr);
  let repDay = todayStr;

  // ---------- مكوّنات مشتركة ----------
  function progressBlock(s) {
    if (!s.total) {
      return '<div class="card prog"><div class="plabel">نسبة الإنجاز</div><div class="pnone">لا توجد مهام متاحة</div></div>';
    }
    const p = Math.round(s.percent);
    return '<div class="card prog"><div class="plabel">نسبة الإنجاز</div><div class="pbig">' + p + '%</div>' +
      '<div class="bar"><i style="width:' + p + '%"></i></div>' +
      '<div class="counts">' + s.full + ' مكتمل · ' + s.partial + ' مكتمل جزئيًا · ' + s.none + ' لم يتم</div></div>';
  }

  // ---------- اليوم ----------
  function renderToday() {
    const s = C.daySummary(state, viewDate);
    const tasks = C.eligibleTasks(state, viewDate);
    const isToday = viewDate === todayStr;
    let h = '<div class="datebar"><button class="ghost" data-act="day-prev">→ السابق</button>' +
      '<div class="date">' + C.longDate(viewDate, todayStr) + '</div>' +
      '<button class="ghost" data-act="day-next"' + (isToday ? ' disabled' : '') + '>التالي ←</button></div>';
    if (!isToday) {
      h += '<div class="note">أنت تعدّل يومًا سابقًا. <button class="link" data-act="day-today">العودة لليوم</button></div>';
    }
    h += progressBlock(s);
    if (!tasks.length) {
      h += '<div class="card empty">لا توجد مهام في هذا اليوم.<br>أضف مهامك من «إدارة المهام».</div>';
    }
    tasks.forEach(function (t) {
      const v = C.scoreOf(state, viewDate, t.id);
      h += '<div class="card"><div class="tname">' + esc(t.name) + '</div><div class="st">' +
        '<button data-act="set" data-task="' + t.id + '" data-v="0" class="' + (v === 0 ? 'on-0' : '') + '">لم يتم</button>' +
        '<button data-act="set" data-task="' + t.id + '" data-v="0.5" class="' + (v === 0.5 ? 'on-5' : '') + '">مكتمل جزئيًا</button>' +
        '<button data-act="set" data-task="' + t.id + '" data-v="1" class="' + (v === 1 ? 'on-1' : '') + '">مكتمل</button>' +
        '</div></div>';
    });
    app.innerHTML = h;
  }

  // ---------- إدارة المهام ----------
  function renderTasks() {
    const list = state.tasks.filter(function (t) { return !t.deleted; });
    let h = '<form class="add" id="addForm"><input id="newTask" maxlength="100" placeholder="اسم المهمة الجديدة" autocomplete="off">' +
      '<button class="primary" type="submit">إضافة مهمة</button></form>' +
      '<div class="hint">المهمة الجديدة تظهر من اليوم فقط، والتعطيل أو الحذف لا يمس الأيام السابقة.</div>';
    if (!list.length) h += '<div class="card empty">لا توجد مهام بعد.</div>';
    list.forEach(function (t) {
      const en = C.isEnabled(t);
      h += '<div class="card trow ' + (en ? '' : 'off') + '"><div class="tn">' + esc(t.name) + '</div>' +
        '<span class="badge ' + (en ? 'bon' : 'boff') + '">' + (en ? 'مفعّلة' : 'معطّلة') + '</span>' +
        '<div class="acts">' +
        '<button data-act="edit" data-id="' + t.id + '">تعديل</button>' +
        '<button data-act="toggle" data-id="' + t.id + '">' + (en ? 'تعطيل' : 'تفعيل') + '</button>' +
        '<button class="danger" data-act="delete" data-id="' + t.id + '">حذف</button></div></div>';
    });
    h += '<div class="card"><h3>نسخة احتياطية</h3><div class="muted">احفظ نسخة من مهامك وسجلّك، أو استرجعها لاحقًا.</div>' +
      '<div class="backup"><button data-act="export">تصدير نسخة</button>' +
      '<label>استيراد نسخة<input type="file" id="importFile" accept=".json,application/json"></label></div></div>';
    app.innerHTML = h;
  }

  // ---------- التقارير ----------
  function dailyReport(date) {
    let h = '<div class="card"><h3>التقرير اليومي</h3><div class="muted">' + C.longDate(date, todayStr, true) + '</div>';
    if (date > todayStr) {
      h += '<div class="muted">هذا اليوم لم يأتِ بعد.</div></div>';
      return h;
    }
    const s = C.daySummary(state, date);
    h += '<table class="kv">' +
      '<tr><td>مهام مكتملة</td><td>' + s.full + '</td></tr>' +
      '<tr><td>مهام مكتملة جزئيًا</td><td>' + s.partial + '</td></tr>' +
      '<tr><td>مهام لم تتم</td><td>' + s.none + '</td></tr>' +
      '<tr><td>نسبة الإنجاز</td><td>' + (s.total ? Math.round(s.percent) + '%' : 'لا توجد مهام متاحة') + '</td></tr>' +
      '</table></div>';
    return h;
  }
  function renderReports() {
    const ws = C.weekSummary(state, repWeek, todayStr);
    const isCur = repWeek === C.weekStart(todayStr);
    let h = '<div class="datebar"><button class="ghost" data-act="wk-prev">→ الأسبوع السابق</button>' +
      '<button class="ghost" data-act="wk-next"' + (isCur ? ' disabled' : '') + '>الأسبوع التالي ←</button></div>';
    h += '<div class="card"><h3>التقرير الأسبوعي</h3>' +
      '<div class="muted">الفترة: من ' + C.longDate(ws.start, todayStr, true) + ' إلى ' + C.longDate(ws.end, todayStr, true) + '</div>';
    if (!isCur) h += '<div><button class="link" data-act="wk-this">العودة للأسبوع الحالي</button></div>';
    h += '</div>';
    h += progressBlock(ws);
    h += '<div class="card"><h3>تفصيل الأيام</h3><div class="hint">اضغط على يوم لعرض تقريره.</div>';
    ws.days.forEach(function (d) {
      const sel = d.date === repDay;
      const pct = d.future ? null : (d.total ? Math.round(d.percent) : null);
      h += '<button class="drow ' + (sel ? 'sel ' : '') + (d.future ? 'fut' : '') + '" data-act="pick-day" data-date="' + d.date + '">' +
        '<span class="dn"><b>' + C.dayName(d.date) + '</b>' + C.shortDate(d.date) + '</span>' +
        '<span class="bar"><i style="width:' + (pct || 0) + '%"></i></span>' +
        '<span class="dp">' + (pct == null ? '—' : pct + '%') + '</span></button>';
    });
    h += '</div>' + dailyReport(repDay);
    app.innerHTML = h;
  }

  function render() {
    document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.view === view); });
    if (view === 'today') renderToday();
    else if (view === 'tasks') renderTasks();
    else renderReports();
  }

  function fixRepDay() {
    repDay = (todayStr >= repWeek && todayStr <= C.addDays(repWeek, 6)) ? todayStr : repWeek;
  }

  // ---------- الأحداث ----------
  document.getElementById('tabs').addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b) return;
    view = b.dataset.view;
    window.scrollTo(0, 0);
    render();
  });

  app.addEventListener('submit', function (e) {
    e.preventDefault();
    const input = document.getElementById('newTask');
    const name = input ? input.value.trim() : '';
    if (!name) { toast('اكتب اسم المهمة أولًا'); return; }
    C.addTask(state, name, todayStr);
    save();
    render();
  });

  app.addEventListener('click', function (e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const a = b.dataset.act;
    const id = b.dataset.id || b.dataset.task;
    if (a === 'day-prev') viewDate = C.addDays(viewDate, -1);
    else if (a === 'day-next') { if (viewDate < todayStr) viewDate = C.addDays(viewDate, 1); }
    else if (a === 'day-today') viewDate = todayStr;
    else if (a === 'set') { C.setStatus(state, viewDate, id, Number(b.dataset.v)); save(); }
    else if (a === 'edit') {
      const t = C.findTask(state, id);
      const n = t && prompt('اسم المهمة:', t.name);
      if (n && C.renameTask(state, id, n)) save();
    }
    else if (a === 'toggle') {
      const t = C.findTask(state, id);
      if (t) { if (C.isEnabled(t)) C.disableTask(state, id, todayStr); else C.enableTask(state, id, todayStr); save(); }
    }
    else if (a === 'delete') {
      const t = C.findTask(state, id);
      if (t && confirm('حذف المهمة «' + t.name + '» من القائمة؟\nسجلّاتها القديمة ستبقى في التقارير.')) {
        C.deleteTask(state, id, todayStr);
        save();
      }
    }
    else if (a === 'export') { exportData(); return; }
    else if (a === 'wk-prev') { repWeek = C.addDays(repWeek, -7); fixRepDay(); }
    else if (a === 'wk-next') { if (repWeek < C.weekStart(todayStr)) { repWeek = C.addDays(repWeek, 7); fixRepDay(); } }
    else if (a === 'wk-this') { repWeek = C.weekStart(todayStr); repDay = todayStr; }
    else if (a === 'pick-day') { if (b.dataset.date <= todayStr) repDay = b.dataset.date; }
    render();
  });

  app.addEventListener('change', function (e) {
    if (e.target.id !== 'importFile') return;
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = function () {
      let s = null;
      try { s = C.sanitize(JSON.parse(rd.result)); } catch (err) { /* invalid */ }
      if (!s) { toast('الملف غير صالح'); return; }
      if (!confirm('سيتم استبدال البيانات الحالية بالنسخة المستوردة (' + s.tasks.length + ' مهمة). متابعة؟')) return;
      state = s;
      if (save()) toast('تم استيراد النسخة الاحتياطية');
      render();
    };
    rd.onerror = function () { toast('تعذّرت قراءة الملف'); };
    rd.readAsText(f);
    e.target.value = '';
  });

  function exportData() {
    const data = { app: 'daily-checklist', exportedAt: new Date().toISOString(), version: 1, tasks: state.tasks, records: state.records };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'checklist-backup-' + todayStr + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    toast('تم تجهيز النسخة الاحتياطية');
  }

  // تغيّر اليوم أثناء ترك التطبيق مفتوحًا
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    const t = C.today();
    if (t === todayStr) return;
    const wasToday = viewDate === todayStr;
    todayStr = t;
    if (wasToday) viewDate = t;
    repWeek = C.weekStart(t);
    repDay = t;
    render();
  });

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  render();
})();
