'use strict';

/* ================= Константы ================= */
const STORE = 'sostoyanie.v1';
const DOSES = [0.25, 0.5, 0.75, 1, 1.5, 2];
const DOSE_TXT = { 0.25: '¼', 0.5: '½', 0.75: '¾', 1: '1', 1.5: '1½', 2: '2' };
const TAGS_DEFAULT = ['Работа', 'Выходной', 'Прогулка', 'Спорт', 'Общение', 'Конфликт', 'Месячные', 'Болезнь', 'Алкоголь', 'Кофе'];
const SIDE_EFFECTS = ['Тошнота', 'Головная боль', 'Сонливость', 'Бессонница', 'Головокружение', 'Потливость', 'Сухость во рту', 'Взвинченность', 'Снижение либидо', 'Нет аппетита'];
const HX_REASONS = ['Без видимой причины', 'Работа', 'Отношения', 'Здоровье', 'Перед сном', 'Люди / общение'];
const SLEEP_Q = ['Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'];
const APPETITE = ['Снижен', 'Обычный', 'Повышен'];

const METRICS = {
  mood: { name: 'Настроение', low: 'очень плохо', high: 'отлично', up: true, color: '--s-mood' },
  anxiety: { name: 'Тревога', low: 'нет', high: 'очень сильная', up: false, color: '--s-anxiety' },
  energy: { name: 'Энергия', low: 'нет сил', high: 'много сил', up: true, color: '--s-energy' },
  interest: { name: 'Интерес к делам', low: 'ничего не радует', high: 'всё в радость', up: true, color: '--s-interest' },
};

const SCALE_OPTS = ['Ни разу', 'Несколько дней', 'Больше половины дней', 'Почти каждый день'];
const SCALES = {
  PHQ9: {
    title: 'PHQ-9 · депрессия',
    short: 'PHQ-9',
    intro: 'Как часто за последние 2 недели вас беспокоило следующее?',
    max: 27,
    items: [
      'Мало интереса или удовольствия от занятий',
      'Плохое настроение, подавленность или чувство безнадёжности',
      'Трудно заснуть, прерывистый сон или, наоборот, слишком много сна',
      'Усталость, мало сил',
      'Плохой аппетит или переедание',
      'Плохо думали о себе: что вы неудачница, разочарованы в себе или подвели семью',
      'Трудно сосредоточиться (например, на чтении или просмотре фильма)',
      'Двигались или говорили так медленно, что это замечали другие, или, наоборот, были так суетливы, что двигались больше обычного',
      'Мысли о том, что лучше было бы умереть, или о том, чтобы причинить себе вред',
    ],
    levels: [[4, 'минимальная'], [9, 'лёгкая'], [14, 'умеренная'], [19, 'выраженная'], [27, 'тяжёлая']],
  },
  GAD7: {
    title: 'GAD-7 · тревога',
    short: 'GAD-7',
    intro: 'Как часто за последние 2 недели вас беспокоило следующее?',
    max: 21,
    items: [
      'Нервозность, тревога или сильный стресс',
      'Не получалось успокоиться или контролировать беспокойство',
      'Слишком сильно волновались по разным поводам',
      'Трудно было расслабиться',
      'Такое беспокойство, что трудно усидеть на месте',
      'Легко раздражались или злились',
      'Страх, будто может случиться что-то ужасное',
    ],
    levels: [[4, 'минимальная'], [9, 'лёгкая'], [14, 'умеренная'], [21, 'выраженная']],
  },
};
const scaleLevel = (type, total) => SCALES[type].levels.find(([m]) => total <= m)[1];

/* ================= Даты ================= */
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// «День» заканчивается в 4 утра: таблетка перед сном после полуночи относится к вечеру.
const DAY_SHIFT_H = 4;
const todayKey = () => keyOf(new Date(Date.now() - DAY_SHIFT_H * 3600000));
const realTodayKey = () => keyOf(new Date());
const hxDay = (h) => keyOf(new Date(new Date(h.ts).getTime() - DAY_SHIFT_H * 3600000));
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
const diffDays = (a, b) => Math.round((parseKey(a) - parseKey(b)) / 86400000);
const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const nowStamp = () => `${realTodayKey()}T${nowTime()}`;
const fmtShort = (k) => { const d = parseKey(k); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`; };
const fmtFull = (k) => { const d = parseKey(k); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; };
const fmtLong = (k) => parseKey(k).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const fmtWeekday = (k) => parseKey(k).toLocaleDateString('ru-RU', { weekday: 'short' });
const daysRange = (from, to) => { const out = []; for (let k = from; k <= to; k = addDays(k, 1)) out.push(k); return out; };
const minutesSince = (stamp) => (Date.now() - new Date(stamp).getTime()) / 60000;
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };

/* ================= Состояние ================= */
function defaultState() {
  return {
    v: 1,
    onboarded: false,
    settings: {
      start: todayKey(),
      medName: 'Эсциталопрам (Элицея Ку-таб)',
      tabletMg: null,
      schedule: [{ day: 1, dose: 0.25 }, { day: 5, dose: 0.5 }, { day: 9, dose: 0.75 }, { day: 13, dose: 1 }],
      hxName: 'Гидроксизин Канон',
      hxDose: '',
      name: '',
      medTime: '22:00',
      checkinTime: '21:30',
      push: { enabled: false, med: true, checkin: true, scales: true, hxFollowup: true },
      tags: [...TAGS_DEFAULT],
      lastBackup: null,
    },
    days: {},
    hx: [],
    scales: [],
  };
}

let S;
try { S = JSON.parse(localStorage.getItem(STORE)) || defaultState(); } catch { S = defaultState(); }
S.settings = { ...defaultState().settings, ...S.settings };
S.settings.push = { ...defaultState().settings.push, ...S.settings.push };
if (!S.deviceId) S.deviceId = Math.random().toString(36).slice(2) + Date.now().toString(36);

function save() {
  try { localStorage.setItem(STORE, JSON.stringify(S)); }
  catch { toast('Не удалось сохранить — память переполнена'); }
  if (typeof schedulePushSync === 'function') schedulePushSync();
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

const ui = {
  tab: 'today',
  date: todayKey(),
  period: 30,
  series: { mood: true, anxiety: true, energy: true, interest: false },
  smooth: true,
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const $ = (sel) => document.querySelector(sel);

/* ================= Предметная логика ================= */
function stepStart(step) { return addDays(S.settings.start, step.day - 1); }
function doseFor(k) {
  if (k < S.settings.start) return null;
  const sched = [...S.settings.schedule].sort((a, b) => a.day - b.day);
  let dose = null;
  for (const st of sched) if (stepStart(st) <= k) dose = st.dose;
  return dose;
}
function isDoseChangeDay(k) {
  return S.settings.schedule.some((st) => st.day > 1 && stepStart(st) === k);
}
function doseText(dose, withMg = true) {
  if (dose == null) return '—';
  const t = `${DOSE_TXT[dose] || dose} табл.`;
  const mg = S.settings.tabletMg;
  return withMg && mg ? `${t} (${String(+(dose * mg).toFixed(2)).replace('.', ',')} мг)` : t;
}
const treatDay = (k) => diffDays(k, S.settings.start) + 1;
const day = (k) => S.days[k] || {};
function setDay(k, patch) {
  const d = { ...(S.days[k] || {}), ...patch };
  for (const f in d) if (d[f] == null || (Array.isArray(d[f]) && !d[f].length) || d[f] === '') delete d[f];
  if (Object.keys(d).length) S.days[k] = d; else delete S.days[k];
  save();
}
const hxOn = (k) => S.hx.filter((h) => hxDay(h) === k).sort((a, b) => a.ts.localeCompare(b.ts));
const lastScale = (type) => S.scales.filter((s) => s.type === type).sort((a, b) => b.date.localeCompare(a.date))[0];

function earliestKey() {
  const keys = [S.settings.start, ...Object.keys(S.days), ...S.hx.map((h) => hxDay(h)), ...S.scales.map((s) => s.date)];
  return keys.sort()[0];
}

function mean(arr) { const v = arr.filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }
const r1 = (x) => (x == null ? '—' : String(Math.round(x * 10) / 10).replace('.', ','));

function rolling(keys, field, win = 7) {
  return keys.map((k, i) => {
    const vals = [];
    for (let j = Math.max(0, i - win + 1); j <= i; j++) { const v = day(keys[j])[field]; if (v != null) vals.push(v); }
    return vals.length >= Math.min(3, i + 1) ? mean(vals) : null;
  });
}

// Сравнение первой и последней недели периода
function compare(keys, field) {
  if (keys.length < 10) return null;
  const a = mean(keys.slice(0, 7).map((k) => day(k)[field]));
  const b = mean(keys.slice(-7).map((k) => day(k)[field]));
  const na = keys.slice(0, 7).filter((k) => day(k)[field] != null).length;
  const nb = keys.slice(-7).filter((k) => day(k)[field] != null).length;
  if (na < 3 || nb < 3) return null;
  return { a, b, delta: b - a };
}

function adherence(from, to) {
  const s = from < S.settings.start ? S.settings.start : from;
  const keys = s <= to ? daysRange(s, to) : [];
  const taken = keys.filter((k) => day(k).med).length;
  return { taken, total: keys.length };
}

function sideEffectStats(keys) {
  const m = {};
  for (const k of keys) for (const se of day(k).side || []) {
    m[se] = m[se] || { name: se, count: 0, first: k, last: k };
    m[se].count++; m[se].last = k;
  }
  return Object.values(m).sort((a, b) => b.count - a.count);
}

function insights(keys) {
  const out = [];
  const withSleep = keys.filter((k) => day(k).sleepHours != null);
  const short = withSleep.filter((k) => day(k).sleepHours < 6.5), long = withSleep.filter((k) => day(k).sleepHours >= 7);
  if (short.length >= 3 && long.length >= 3) {
    const ms = mean(short.map((k) => day(k).mood)), ml = mean(long.map((k) => day(k).mood));
    const as = mean(short.map((k) => day(k).anxiety)), al = mean(long.map((k) => day(k).anxiety));
    if (ms != null && ml != null) out.push(`После короткого сна (меньше 6,5 ч) настроение в среднем ${r1(ms)}, после 7 ч и больше — ${r1(ml)}.`);
    if (as != null && al != null && Math.abs(as - al) >= 0.5) out.push(`Тревога после короткого сна — ${r1(as)}, после нормального — ${r1(al)}.`);
  }
  const tagEffects = [];
  for (const tag of S.settings.tags) {
    const yes = keys.filter((k) => (day(k).tags || []).includes(tag) && day(k).mood != null);
    const no = keys.filter((k) => !(day(k).tags || []).includes(tag) && day(k).mood != null);
    if (yes.length >= 3 && no.length >= 3) {
      const d = mean(yes.map((k) => day(k).mood)) - mean(no.map((k) => day(k).mood));
      if (Math.abs(d) >= 0.8) tagEffects.push({ tag, d, n: yes.length });
    }
  }
  tagEffects.sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3).forEach((t) => {
    out.push(`В дни с меткой «${t.tag}» (${t.n} ${plural(t.n, 'день', 'дня', 'дней')}) настроение ${t.d > 0 ? 'выше' : 'ниже'} в среднем на ${r1(Math.abs(t.d))}.`);
  });
  const hx = S.hx.filter((h) => h.after != null && keys.includes(hxDay(h)));
  if (hx.length >= 2) {
    out.push(`Гидроксизин: тревога в среднем снижалась с ${r1(mean(hx.map((h) => h.before)))} до ${r1(mean(hx.map((h) => h.after)))} (${hx.length} ${plural(hx.length, 'случай', 'случая', 'случаев')} с оценкой после).`);
  }
  return out;
}

/* ================= UI-помощники ================= */
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

function segRow(field, value, low, high, act = 'set') {
  let b = '';
  for (let i = 0; i <= 10; i++) b += `<button class="seg ${value === i ? 'on' : ''}" data-act="${act}" data-field="${field}" data-val="${i}" aria-label="${i}">${i}</button>`;
  return `<div class="segs">${b}</div><div class="seg-legend"><span>0 — ${esc(low)}</span><span>10 — ${esc(high)}</span></div>`;
}

function openSheet(html, onClose) {
  closeSheet();
  const root = $('#sheet-root');
  root.innerHTML = `<div class="overlay" data-act="overlay"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`;
  root._onClose = onClose;
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  const root = $('#sheet-root');
  if (!root.innerHTML) return;
  root.innerHTML = '';
  document.body.style.overflow = '';
  const cb = root._onClose; root._onClose = null;
  if (cb) cb();
}
const sheetHead = (title) => `<div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-act="close" aria-label="Закрыть">×</button></div>`;

/* ================= Экран «Сегодня» ================= */
function renderToday() {
  const k = ui.date, t = todayKey(), d = day(k), isToday = k === t;
  const td = treatDay(k), dose = doseFor(k);
  let h = '';

  h += `<div class="datenav">
    <button class="icon-btn" data-act="day" data-delta="-1" aria-label="Предыдущий день">‹</button>
    <div class="mid"><div class="d">${isToday ? 'Сегодня' : esc(fmtWeekday(k))}, ${esc(fmtLong(k))}</div>
      <div style="margin-top:4px">${td >= 1 ? `<span class="pill">День лечения ${td}</span>` : `<span class="muted">до начала лечения</span>`}</div></div>
    <button class="icon-btn" data-act="day" data-delta="1" ${isToday ? 'disabled' : ''} aria-label="Следующий день">›</button>
  </div>`;
  if (!isToday) h += `<div style="text-align:center"><button class="link" data-act="day" data-delta="0">Вернуться к сегодня</button></div>`;

  // Подсказки
  if (isToday) {
    if (!S.scales.length) {
      h += `<div class="card soft"><h2>Исходная точка</h2>
        <p class="sub">Перед первой таблеткой заполните два коротких опросника, это займёт 3–4 минуты. С ними будем сравнивать, как меняется состояние.</p>
        <div class="row" style="margin-top:10px"><button class="btn sm" data-act="scale" data-type="PHQ9">PHQ-9</button><button class="btn sm" data-act="scale" data-type="GAD7">GAD-7</button></div></div>`;
    } else {
      const due = Object.keys(SCALES).filter((type) => { const l = lastScale(type); return !l || diffDays(t, l.date) >= 14; });
      if (due.length) {
        h += `<div class="card soft"><h2>Пора заполнить опросник</h2><p class="sub">Прошло 2 недели — это нужно, чтобы видеть динамику.</p>
          <div class="row" style="margin-top:10px">${due.map((type) => `<button class="btn sm" data-act="scale" data-type="${type}">${SCALES[type].short}</button>`).join('')}</div></div>`;
      }
    }
    for (const hx of S.hx.filter((x) => x.after == null && minutesSince(x.ts) >= 40 && minutesSince(x.ts) < 24 * 60)) {
      h += `<div class="card warm"><h2>Как вы сейчас?</h2><p class="sub">В ${esc(hx.ts.slice(11))} вы приняли гидроксизин, тревога была ${hx.before}. Отметьте, как сейчас.</p>
        <button class="btn sm" style="margin-top:8px" data-act="hx-after" data-id="${hx.id}">Отметить</button></div>`;
    }
  }
  if (isDoseChangeDay(k)) {
    h += `<div class="card warm"><b>С ${isToday ? 'сегодняшнего дня' : 'этого дня'} новая доза: ${esc(doseText(dose))}</b></div>`;
  }

  // Таблетка
  if (dose != null) {
    h += `<div class="card"><div class="med">
      <div class="dose">${esc(DOSE_TXT[dose] || dose)}<small>${S.settings.tabletMg ? esc(String(+(dose * S.settings.tabletMg).toFixed(2)).replace('.', ',')) + ' мг' : 'табл.'}</small></div>
      <div class="grow"><b>${esc(S.settings.medName)}</b><div class="muted">вечером, перед сном</div>
      ${d.med ? `<div class="taken" style="margin-top:4px">✓ Принято в <input type="time" class="input" style="display:inline-block;width:auto;min-height:0;padding:2px 6px;font-weight:600" data-input="medtime" value="${esc(d.med.t)}"></div>` : ''}</div>
      ${d.med ? `<button class="btn ghost sm" data-act="med-undo">Отменить</button>` : `<button class="btn" data-act="med">Приняла</button>`}
    </div></div>`;
  }

  // Гидроксизин
  const hxs = hxOn(k);
  h += `<div class="card"><div class="card-head"><h2>${esc(S.settings.hxName)}</h2><button class="btn quiet sm" data-act="hx-new">+ Приняла</button></div>
    <div class="muted">При тревоге. Отметьте, насколько было тревожно, а через час — помогло ли.</div>
    ${hxs.length ? `<ul class="list" style="margin-top:6px">${hxs.map((x) => `<li class="row between"><div><b>${esc(x.ts.slice(11))}</b> · тревога ${x.before}${x.after != null ? ` → ${x.after}` : ''}${x.reason ? `<div class="muted">${esc(x.reason)}</div>` : ''}</div>
      <div class="row">${x.after == null ? `<button class="btn quiet sm" data-act="hx-after" data-id="${x.id}">После</button>` : ''}<button class="link small" data-act="hx-edit" data-id="${x.id}">Изм.</button></div></li>`).join('')}</ul>` : ''}
  </div>`;

  // Самочувствие
  h += `<div class="card"><h2>Самочувствие за день</h2><div class="muted">Достаточно отметить то, что хочется. Всё сохраняется сразу.</div>`;
  for (const [f, m] of Object.entries(METRICS)) {
    h += `<div class="field"><div class="field-label"><b>${m.name}</b><span class="val">${d[f] ?? ''}</span></div>${segRow(f, d[f], m.low, m.high)}</div>`;
  }
  h += `<div class="field"><div class="field-label"><b>Сон прошлой ночью</b></div>
    <div class="row between"><div class="stepper">
      <button class="icon-btn" data-act="sleep" data-delta="-0.5" aria-label="Меньше">−</button>
      <div class="v">${d.sleepHours != null ? r1(d.sleepHours) + ' ч' : '—'}</div>
      <button class="icon-btn" data-act="sleep" data-delta="0.5" aria-label="Больше">+</button></div></div>
    <div class="chips" style="margin-top:10px">${SLEEP_Q.map((q, i) => `<button class="chip ${d.sleepQ === i + 1 ? 'on' : ''}" data-act="pick" data-field="sleepQ" data-val="${i + 1}">${q}</button>`).join('')}</div></div>`;
  h += `<div class="field"><div class="field-label"><b>Аппетит</b></div><div class="chips">${APPETITE.map((q, i) => `<button class="chip ${d.appetite === i + 1 ? 'on' : ''}" data-act="pick" data-field="appetite" data-val="${i + 1}">${q}</button>`).join('')}</div></div>`;
  h += `</div>`;

  // Метки
  h += `<div class="card"><h2>Что было в этот день</h2><div class="chips">
    ${S.settings.tags.map((tg) => `<button class="chip ${(d.tags || []).includes(tg) ? 'on' : ''}" data-act="toggle" data-field="tags" data-val="${esc(tg)}">${esc(tg)}</button>`).join('')}
    <button class="chip add" data-act="tag-add">+ своя</button></div></div>`;

  // Побочные эффекты
  if (td >= 1) {
    h += `<div class="card"><h2>Побочные эффекты</h2><div class="muted" style="margin-bottom:8px">Если что-то было. Особенно важно в первые недели.</div><div class="chips">
      ${SIDE_EFFECTS.map((se) => `<button class="chip ${(d.side || []).includes(se) ? 'on' : ''}" data-act="toggle" data-field="side" data-val="${esc(se)}">${esc(se)}</button>`).join('')}</div></div>`;
  }

  // Заметка
  h += `<div class="card"><h2>Заметка</h2>
    <textarea class="input" data-input="note" placeholder="Что происходило, о чём думалось, что помогло…">${esc(d.note || '')}</textarea>
    <label class="check"><input type="checkbox" data-input="forDoctor" ${d.forDoctor ? 'checked' : ''}> Обсудить с врачом (попадёт в отчёт)</label></div>`;

  return h;
}

/* ================= Дневник ================= */
function renderDiary() {
  const t = todayKey(), from = earliestKey() < t ? earliestKey() : t;
  const keys = daysRange(from, t).reverse();
  let h = `<h1>Дневник</h1><p class="sub">Нажмите на день, чтобы открыть или дополнить.</p><div class="card"><ul class="list">`;
  for (const k of keys) {
    const d = day(k), hx = hxOn(k), sc = S.scales.filter((s) => s.date === k), dose = doseFor(k);
    const bits = [];
    for (const [f, m] of Object.entries(METRICS)) if (d[f] != null) bits.push(`<span><i class="dot" style="background:var(${m.color})"></i>${m.name.split(' ')[0]} ${d[f]}</span>`);
    if (d.sleepHours != null) bits.push(`<span>Сон ${r1(d.sleepHours)} ч</span>`);
    if (hx.length) bits.push(`<span>Гидроксизин ×${hx.length}</span>`);
    for (const s of sc) bits.push(`<span>${SCALES[s.type].short}: ${s.total}</span>`);
    h += `<li><button class="dayrow" data-act="open-day" data-k="${k}">
      <div class="date"><b>${esc(fmtShort(k))}</b><span class="muted">${esc(fmtWeekday(k))}</span></div>
      <div class="grow">
        <div class="small">${dose != null ? (d.med ? `<span class="taken">✓</span> ${esc(doseText(dose, false))}` : `<span class="muted">${k === t ? 'таблетка ещё не отмечена' : 'приём не отмечен'}</span>`) : '<span class="muted">до начала лечения</span>'}</div>
        ${bits.length ? `<div class="metrics" style="margin-top:4px">${bits.join('')}</div>` : ''}
        ${(d.tags || []).length || (d.side || []).length ? `<div class="muted" style="margin-top:4px">${esc([...(d.tags || []), ...(d.side || []).map((s) => '⚠︎ ' + s)].join(' · '))}</div>` : ''}
        ${d.note ? `<div class="small" style="margin-top:4px;color:var(--ink2)">${d.forDoctor ? '🩺 ' : ''}${esc(d.note.length > 120 ? d.note.slice(0, 120) + '…' : d.note)}</div>` : ''}
      </div></button></li>`;
  }
  h += `</ul></div>`;
  return h;
}

/* ================= Анализ ================= */
const charts = new Map();
function chartColors() {
  return { grid: cssVar('--grid'), axis: cssVar('--axis'), muted: cssVar('--muted'), ink2: cssVar('--ink2'), surface: cssVar('--card') };
}
function periodKeys() {
  const t = todayKey();
  const from = ui.period === 'all' ? earliestKey() : addDays(t, -(ui.period - 1));
  return daysRange(from < t ? from : t, t);
}
function doseMarkers(keys) {
  return S.settings.schedule.map((st) => ({ i: keys.indexOf(stepStart(st)), label: DOSE_TXT[st.dose] || st.dose })).filter((m) => m.i >= 0);
}

function moodChartSpec(keys, colors, opts = {}) {
  const series = Object.entries(METRICS).filter(([f]) => (opts.all ? f !== 'interest' : ui.series[f])).map(([f, m]) => {
    const raw = keys.map((k) => day(k)[f] ?? null);
    const smooth = opts.smooth ?? ui.smooth;
    return { key: f, name: m.name, color: opts.palette ? opts.palette[f] : cssVar(m.color), values: smooth ? rolling(keys, f) : raw, dots: smooth ? raw : null };
  });
  return { labels: keys, series, yMin: 0, yMax: 10, yTicks: [0, 5, 10], markers: doseMarkers(keys), xFmt: fmtShort, colors };
}
function sleepChartSpec(keys, colors, color) {
  const vals = keys.map((k) => day(k).sleepHours ?? null);
  const max = Math.max(10, ...vals.filter((v) => v != null));
  return { labels: keys, values: vals, color, yMin: 0, yMax: Math.ceil(max / 2) * 2, yTicks: [0, 4, 8].concat(max > 10 ? [12] : []), xFmt: fmtShort, colors };
}
function scalesChartSpec(keys, colors, palette) {
  const series = ['PHQ9', 'GAD7'].map((type) => ({
    key: type, name: SCALES[type].short, color: palette[type], connect: true, points: true,
    values: keys.map((k) => { const s = S.scales.filter((x) => x.type === type && x.date === k).pop(); return s ? s.total : null; }),
  }));
  return { labels: keys, series, yMin: 0, yMax: 27, yTicks: [0, 5, 10, 15, 20, 27], markers: doseMarkers(keys), xFmt: fmtShort, colors };
}
function hxWeeks(keys) {
  const weeks = [];
  for (let i = 0; i < keys.length; i += 7) {
    const wk = keys.slice(i, i + 7);
    weeks.push({ k: wk[0], end: wk[wk.length - 1], n: S.hx.filter((h) => wk.includes(hxDay(h))).length });
  }
  return weeks;
}

function renderStats() {
  const keys = periodKeys(), colors = chartColors();
  charts.clear();
  let h = `<div class="row between"><h1>Анализ</h1><button class="btn sm" data-act="report">PDF для врача</button></div>`;
  h += `<div class="periods" style="margin-top:8px">${[[14, '2 недели'], [30, 'Месяц'], [90, '3 месяца'], ['all', 'Всё время']].map(([v, l]) => `<button class="chip ${ui.period === v ? 'on' : ''}" data-act="period" data-val="${v}">${l}</button>`).join('')}</div>`;

  const filled = keys.filter((k) => Object.keys(day(k)).length).length;
  if (filled < 2 && !S.scales.length) {
    h += `<div class="card empty">Здесь появятся графики, когда наберётся хотя бы несколько дней записей.<br><br>Отмечайте самочувствие каждый вечер, на это нужно меньше минуты.</div>`;
    return h;
  }

  // Плитки
  const tiles = [];
  for (const f of ['mood', 'anxiety', 'energy']) {
    const m = METRICS[f], last = mean(keys.slice(-7).map((k) => day(k)[f])), c = compare(keys, f);
    let dTxt = 'среднее за 7 дней';
    let cls = '';
    if (c && Math.abs(c.delta) >= 0.3) {
      const better = m.up ? c.delta > 0 : c.delta < 0;
      cls = better ? 'good' : 'bad';
      dTxt = `${c.delta > 0 ? '↑' : '↓'} ${r1(Math.abs(c.delta))} к первой неделе`;
    } else if (c) dTxt = 'без заметных изменений';
    tiles.push(`<div class="tile"><div class="k">${m.name}</div><div class="v">${r1(last)}</div><div class="d ${cls}">${dTxt}</div></div>`);
  }
  const sl = mean(keys.slice(-7).map((k) => day(k).sleepHours));
  tiles.push(`<div class="tile"><div class="k">Сон</div><div class="v">${sl == null ? '—' : r1(sl) + ' ч'}</div><div class="d">среднее за 7 дней</div></div>`);
  const ad = adherence(keys[0], keys[keys.length - 1]);
  tiles.push(`<div class="tile"><div class="k">Таблетки</div><div class="v">${ad.taken}/${ad.total}</div><div class="d">дней с отметкой о приёме</div></div>`);
  const hxN = S.hx.filter((x) => keys.includes(hxDay(x))).length;
  tiles.push(`<div class="tile"><div class="k">Гидроксизин</div><div class="v">${hxN}</div><div class="d">${plural(hxN, 'раз', 'раза', 'раз')} за период</div></div>`);
  h += `<div class="tiles">${tiles.join('')}</div>`;

  // Настроение
  const ms = moodChartSpec(keys, colors);
  charts.set('mood', { spec: ms, kind: 'line', fmt: (v) => r1(v) });
  h += `<div class="card"><div class="card-head"><h2>Самочувствие</h2></div>
    <div class="chips">${Object.entries(METRICS).map(([f, m]) => `<button class="chip ${ui.series[f] ? 'on' : ''}" data-act="series" data-val="${f}">${m.name.split(' ')[0]}</button>`).join('')}</div>
    <div class="chart" data-chart="mood">${Charts.line(ms)}<div class="tip"></div></div>
    <div class="legend">${ms.series.map((s) => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div>
    <label class="check small"><input type="checkbox" data-input="smooth" ${ui.smooth ? 'checked' : ''}> Сглаживание: среднее за 7 дней (точки — отдельные дни)</label>
    <div class="muted" style="margin-top:6px">Пунктир — смена дозы. Эсциталопрам обычно начинает действовать через 2–4 недели.</div></div>`;

  // Сон
  const ss = sleepChartSpec(keys, colors, cssVar('--s-sleep'));
  charts.set('sleep', { spec: ss, kind: 'bars', fmt: (v) => r1(v) + ' ч', name: 'Сон' });
  h += `<div class="card"><h2>Сон, часов</h2><div class="chart" data-chart="sleep">${Charts.bars(ss)}<div class="tip"></div></div></div>`;

  // Опросники
  if (S.scales.length) {
    const sc = scalesChartSpec(keys, colors, { PHQ9: cssVar('--s-mood'), GAD7: cssVar('--s-anxiety') });
    charts.set('scales', { spec: sc, kind: 'line', fmt: (v) => v });
    const rows = [...S.scales].filter((s) => keys.includes(s.date)).sort((a, b) => a.date.localeCompare(b.date));
    h += `<div class="card"><h2>Опросники</h2><div class="chart" data-chart="scales">${Charts.line(sc)}<div class="tip"></div></div>
      <div class="legend"><span><i style="background:${sc.series[0].color}"></i>PHQ-9 (депрессия, 0–27)</span><span><i style="background:${sc.series[1].color}"></i>GAD-7 (тревога, 0–21)</span></div>
      ${rows.length ? `<table class="mini" style="margin-top:8px"><tr><th>Дата</th><th>Шкала</th><th>Балл</th><th>Уровень</th></tr>${rows.map((s) => `<tr><td>${fmtShort(s.date)}</td><td>${SCALES[s.type].short}</td><td class="num"><b>${s.total}</b></td><td>${scaleLevel(s.type, s.total)}</td></tr>`).join('')}</table>` : ''}
      <div class="muted" style="margin-top:6px">Ниже балл — лучше. Снижение на 5 и больше пунктов обычно считается заметным улучшением.</div></div>`;
  }

  // Гидроксизин
  if (hxN) {
    const wk = hxWeeks(keys);
    const hs = { labels: wk.map((w) => w.k), values: wk.map((w) => w.n), color: cssVar('--s-hx'), yMin: 0, yMax: Math.max(4, ...wk.map((w) => w.n)) + 1, yTicks: [0, Math.max(4, ...wk.map((w) => w.n)) + 1], xFmt: fmtShort, colors, valueLabels: (v) => v };
    charts.set('hx', { spec: hs, kind: 'bars', fmt: (v) => `${v} ${plural(v, 'раз', 'раза', 'раз')}`, name: 'Гидроксизин', week: true });
    h += `<div class="card"><h2>Гидроксизин по неделям</h2><div class="chart" data-chart="hx">${Charts.bars(hs)}<div class="tip"></div></div>
      <div class="muted">Если приёмов становится меньше, значит, тревога реже требует помощи.</div></div>`;
  }

  // Побочки
  const se = sideEffectStats(keys);
  if (se.length) {
    const max = se[0].count;
    h += `<div class="card"><h2>Побочные эффекты</h2>${se.map((s) => `<div class="bar-row"><span>${esc(s.name)}</span><span class="muted">${s.count} ${plural(s.count, 'день', 'дня', 'дней')} · ${fmtShort(s.first)}${s.first !== s.last ? '–' + fmtShort(s.last) : ''}</span><div class="track"><div class="fill" style="width:${(s.count / max) * 100}%"></div></div></div>`).join('')}</div>`;
  }

  // Наблюдения
  const ins = insights(keys);
  h += `<div class="card"><h2>Наблюдения</h2>${ins.length ? ins.map((x) => `<div class="insight">${esc(x)}</div>`).join('') + '<div class="muted" style="margin-top:8px">Это совпадения в ваших данных, а не выводы. Их стоит обсудить с врачом.</div>' : '<div class="muted">Появятся, когда наберётся 1–2 недели записей со сном и метками.</div>'}</div>`;
  return h;
}

function bindCharts() {
  document.querySelectorAll('[data-chart]').forEach((el) => {
    const c = charts.get(el.dataset.chart); if (!c) return;
    const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), cross = svg.querySelector('.cross');
    const n = +svg.dataset.n, padL = +svg.dataset.padl, step = +svg.dataset.step, w = +svg.dataset.w;
    const show = (clientX) => {
      const r = svg.getBoundingClientRect();
      const vx = ((clientX - r.left) / r.width) * w;
      const i = Math.floor((vx - padL) / step);
      if (i < 0 || i >= n) { hide(); return; }
      const k = c.spec.labels[i];
      let body = `<b>${c.week ? 'Неделя с ' + fmtShort(k) : fmtShort(k) + ', ' + fmtWeekday(k)}</b>`;
      if (c.kind === 'line') {
        for (const s of c.spec.series) {
          const raw = s.dots ? s.dots[i] : s.values[i], avg = s.dots ? s.values[i] : null;
          if (raw == null && avg == null) continue;
          body += `<br><i class="dot" style="background:${s.color}"></i>${esc(s.name)}: ${raw != null ? raw : '—'}${avg != null ? ` <span style="opacity:.6">(ср. за 7 дн. ${r1(avg)})</span>` : ''}`;
        }
        const dz = doseFor(k); if (dz != null) body += `<br><span style="opacity:.7">Доза ${DOSE_TXT[dz]}${day(k).med ? ' ✓' : ''}</span>`;
      } else {
        const v = c.spec.values[i];
        body += `<br>${esc(c.name)}: ${v == null ? '—' : c.fmt(v)}`;
      }
      tip.innerHTML = body; tip.style.display = 'block';
      const cx = padL + (i + 0.5) * step;
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('opacity', '.35');
      const px = (cx / w) * r.width, tw = tip.offsetWidth;
      tip.style.left = Math.min(Math.max(px - tw / 2, 0), r.width - tw) + 'px';
      tip.style.transform = `translateY(-${tip.offsetHeight + 6}px)`;
    };
    const hide = () => { tip.style.display = 'none'; cross.setAttribute('opacity', '0'); };
    el.addEventListener('pointermove', (e) => show(e.clientX));
    el.addEventListener('pointerdown', (e) => show(e.clientX));
    el.addEventListener('pointerleave', hide);
    el.addEventListener('touchmove', (e) => { if (e.touches[0]) show(e.touches[0].clientX); }, { passive: true });
  });
}

/* ================= Ещё / настройки ================= */
function renderMore() {
  const st = S.settings;
  let h = `<h1>Ещё</h1>`;

  h += `<div class="card"><h2>Отчёт для врача</h2><p class="sub">PDF с графиками, опросниками, приёмом лекарств, побочными эффектами и заметками.</p><button class="btn block" data-act="report">Сформировать PDF</button></div>`;

  const scRows = [...S.scales].sort((a, b) => b.date.localeCompare(a.date));
  h += `<div class="card"><h2>Опросники</h2><p class="sub">Заполняйте раз в 2 недели. Это стандартные шкалы, понятные любому специалисту.</p>
    <div class="row" style="margin:10px 0"><button class="btn sm" data-act="scale" data-type="PHQ9">PHQ-9 · депрессия</button><button class="btn sm" data-act="scale" data-type="GAD7">GAD-7 · тревога</button></div>
    ${scRows.length ? `<table class="mini"><tr><th>Дата</th><th>Шкала</th><th>Балл</th><th>Уровень</th><th></th></tr>${scRows.map((s) => `<tr><td>${fmtShort(s.date)}</td><td>${SCALES[s.type].short}</td><td class="num"><b>${s.total}</b></td><td>${scaleLevel(s.type, s.total)}</td><td><button class="link small" data-act="scale-del" data-id="${s.id}">Удалить</button></td></tr>`).join('')}</table>` : ''}</div>`;

  const ps = st.push;
  h += `<div class="card"><h2>Напоминания</h2>`;
  if (!ps.enabled) {
    h += `<p class="sub">Уведомления приходят на телефон, даже когда приложение закрыто. Если таблетка уже отмечена, напоминание о ней не придёт.</p>
      ${isStandalone() ? '' : '<div class="card warm small" style="margin:8px 0">Откройте приложение с иконки на экране «Домой». В Safari уведомления не работают.</div>'}
      <button class="btn block" style="margin-top:8px" data-act="push-on">Включить уведомления</button>`;
  } else {
    h += `<div class="row"><div class="grow"><label class="lbl">Таблетка</label><input type="time" class="input" data-input="set:medTime" value="${esc(st.medTime)}"></div>
      <div class="grow"><label class="lbl">Отметить день</label><input type="time" class="input" data-input="set:checkinTime" value="${esc(st.checkinTime)}"></div></div>
      <label class="check"><input type="checkbox" data-input="push:med" ${ps.med ? 'checked' : ''}> Таблетка (с дозой на этот день)</label>
      <label class="check"><input type="checkbox" data-input="push:checkin" ${ps.checkin ? 'checked' : ''}> «Как прошёл день?»</label>
      <label class="check"><input type="checkbox" data-input="push:scales" ${ps.scales ? 'checked' : ''}> Опросники раз в 2 недели</label>
      <label class="check"><input type="checkbox" data-input="push:hxFollowup" ${ps.hxFollowup ? 'checked' : ''}> Через час после гидроксизина спросить, помог ли</label>
      <p class="muted" style="margin-top:10px">Если таблетка уже отмечена или день уже заполнен, напоминание не придёт.</p>
      <div class="row" style="margin-top:10px"><button class="btn quiet sm" data-act="push-test">Проверить</button><button class="btn ghost sm" data-act="push-off">Выключить</button></div>`;
  }
  h += `</div>`;

  const sched = [...st.schedule].sort((a, b) => a.day - b.day);
  h += `<div class="card"><h2>Лечение</h2>
    <label class="lbl">Дата первого приёма</label><input type="date" class="input" data-input="set:start" value="${esc(st.start)}">
    <label class="lbl">Препарат</label><input class="input" data-input="set:medName" value="${esc(st.medName)}">
    <label class="lbl">Дозировка одной таблетки</label>
    <div class="chips">${[5, 10, 15, 20].map((mg) => `<button class="chip ${st.tabletMg === mg ? 'on' : ''}" data-act="mg" data-val="${mg}">${mg} мг</button>`).join('')}</div>
    <div class="muted" style="margin-top:4px">Указано на упаковке. Нужна, чтобы в отчёте была доза в мг.</div>
    <label class="lbl">Схема</label>
    ${sched.map((s, i) => {
      const next = sched[i + 1];
      const range = next ? `${fmtShort(stepStart(s))}–${fmtShort(addDays(stepStart(next), -1))}` : `с ${fmtShort(stepStart(s))}`;
      return `<div class="sched-row"><span>с дня</span><input type="number" min="1" class="input" data-input="sched-day" data-i="${i}" value="${s.day}">
        <select class="input" data-input="sched-dose" data-i="${i}">${DOSES.map((d) => `<option value="${d}" ${d === s.dose ? 'selected' : ''}>${DOSE_TXT[d]} табл.</option>`).join('')}</select>
        <span class="muted">${range}</span><button class="link" data-act="sched-del" data-i="${i}" aria-label="Удалить">×</button></div>`;
    }).join('')}
    <button class="link" data-act="sched-add">+ Добавить шаг</button>
    <hr><label class="lbl">Препарат «по необходимости»</label><input class="input" data-input="set:hxName" value="${esc(st.hxName)}">
    <label class="lbl">Его доза (для отчёта)</label><input class="input" data-input="set:hxDose" placeholder="например, 25 мг" value="${esc(st.hxDose)}">
    <label class="lbl">Имя в отчёте (необязательно)</label><input class="input" data-input="set:name" value="${esc(st.name)}"></div>`;

  h += `<div class="card"><h2>Метки</h2><div class="chips">${st.tags.map((tg) => `<button class="chip x" data-act="tag-del" data-val="${esc(tg)}">${esc(tg)}</button>`).join('')}<button class="chip add" data-act="tag-add">+ добавить</button></div>
    <div class="muted" style="margin-top:6px">Нажмите на метку, чтобы удалить её.</div></div>`;

  h += `<div class="card"><h2>Данные</h2><p class="sub">Всё хранится только на этом телефоне. Раз в пару недель сохраняйте копию, например в «Файлы» или iCloud.</p>
    <div class="muted">${st.lastBackup ? 'Последняя копия: ' + fmtFull(st.lastBackup) : 'Копий ещё не было'}</div>
    <div class="row wrap" style="margin-top:10px"><button class="btn quiet sm" data-act="backup">Сохранить копию</button>
    <label class="btn ghost sm">Восстановить<input type="file" accept="application/json,.json" data-input="restore" hidden></label></div>
    <hr><button class="btn danger sm" data-act="wipe">Удалить все данные</button></div>`;

  h += `<div class="card warm"><h2>Если очень тяжело</h2><p class="sub">Если появляются мысли о том, чтобы причинить себе вред, не оставайтесь с этим одна. Позвоните врачу или близкому человеку.</p>
    <p><b>112</b> — экстренная помощь<br><b>8 495 989-50-50</b> — экстренная психологическая помощь МЧС, круглосуточно</p></div>`;
  h += `<p class="muted" style="text-align:center;margin-top:16px">Приложение не заменяет консультацию врача.<br>Не меняйте дозировку и не отменяйте препарат без врача.</p>`;
  return h;
}

/* ================= Листы: опросник, гидроксизин ================= */
function openScale(type) {
  const sc = SCALES[type];
  const answers = new Array(sc.items.length).fill(null);
  const draw = () => {
    const done = answers.every((a) => a != null);
    let h = sheetHead(sc.title) + `<p class="sub">${esc(sc.intro)}</p>`;
    sc.items.forEach((q, i) => {
      h += `<div class="q"><p><b>${i + 1}.</b> ${esc(q)}</p><div class="opts">${SCALE_OPTS.map((o, v) => `<button class="opt ${answers[i] === v ? 'on' : ''}" data-act="q" data-i="${i}" data-v="${v}">${o}</button>`).join('')}</div></div>`;
    });
    h += `<button class="btn block" style="margin-top:16px" data-act="q-save" ${done ? '' : 'disabled'}>${done ? 'Сохранить' : `Ответьте на все вопросы (${answers.filter((a) => a != null).length}/${sc.items.length})`}</button>`;
    return h;
  };
  sheetCtx = {
    q: (el) => {
      answers[+el.dataset.i] = +el.dataset.v;
      const sh = $('.sheet'), top = sh.scrollTop;
      sh.innerHTML = '<div class="grab"></div>' + draw(); sh.scrollTop = top;
    },
    'q-save': () => {
      const total = answers.reduce((a, b) => a + b, 0);
      S.scales.push({ id: uid(), type, date: todayKey(), answers: [...answers], total });
      save();
      const risk = type === 'PHQ9' && answers[8] > 0;
      let h = sheetHead(sc.title) + `<div class="result"><div class="score">${total}</div><div class="sub">из ${sc.max} · выраженность: ${scaleLevel(type, total)}</div></div>`;
      if (risk) {
        h += `<div class="card danger"><h2>Спасибо, что ответили честно</h2><p>Мысли о смерти или о том, чтобы навредить себе, бывают при депрессии. Это важно обсудить с врачом: напишите или позвоните ему, не дожидаясь следующего приёма.</p>
          <p>Если такие мысли сильные прямо сейчас, позвоните <b>112</b> или на линию экстренной психологической помощи <b>8 495 989-50-50</b> (круглосуточно), а также скажите близкому человеку.</p></div>`;
      }
      h += `<p class="muted">Результат сохранён и попадёт в отчёт для врача. Это не диагноз, а способ отслеживать динамику.</p><button class="btn block" data-act="close">Готово</button>`;
      $('.sheet').innerHTML = '<div class="grab"></div>' + h; $('.sheet').scrollTop = 0;
    },
  };
  openSheet(draw(), () => { sheetCtx = null; render(); });
}

function openHx(existing) {
  const x = existing ? { ...existing } : { id: uid(), ts: nowStamp(), before: null, reason: '', note: '', after: null };
  if (!existing && ui.date !== todayKey()) x.ts = `${ui.date}T${nowTime()}`;
  const draw = () => sheetHead(existing ? 'Приём гидроксизина' : 'Приняла гидроксизин') + `
    <label class="lbl">Когда</label><input type="datetime-local" class="input" data-sheet-input="ts" value="${esc(x.ts)}">
    <div class="field"><div class="field-label"><b>Насколько тревожно было</b><span class="val">${x.before ?? ''}</span></div>${segRow('before', x.before, 'спокойно', 'паника', 'hx-set')}</div>
    ${existing ? `<div class="field"><div class="field-label"><b>Тревога после</b><span class="val">${x.after ?? ''}</span></div>${segRow('after', x.after, 'спокойно', 'паника', 'hx-set')}</div>` : ''}
    <label class="lbl">Повод</label><div class="chips">${HX_REASONS.map((r) => `<button class="chip ${x.reason === r ? 'on' : ''}" data-act="hx-reason" data-val="${esc(r)}">${esc(r)}</button>`).join('')}</div>
    <label class="lbl">Заметка</label><textarea class="input" data-sheet-input="note" placeholder="Что вызвало тревогу?">${esc(x.note)}</textarea>
    <button class="btn block" style="margin-top:14px" data-act="hx-save" ${x.before == null ? 'disabled' : ''}>Сохранить</button>
    ${existing ? `<button class="btn danger block" style="margin-top:8px" data-act="hx-del">Удалить запись</button>` : `<p class="muted" style="margin-top:8px">Примерно через час на экране «Сегодня» появится вопрос, помогло ли.</p>`}`;
  const redraw = () => { const sh = $('.sheet'), top = sh.scrollTop; sh.innerHTML = '<div class="grab"></div>' + draw(); sh.scrollTop = top; };
  sheetCtx = {
    'hx-set': (el) => { x[el.dataset.field] = x[el.dataset.field] === +el.dataset.val ? null : +el.dataset.val; redraw(); },
    'hx-reason': (el) => { x.reason = x.reason === el.dataset.val ? '' : el.dataset.val; redraw(); },
    input: (el) => { x[el.dataset.sheetInput] = el.value; },
    'hx-save': () => {
      if (!x.ts) return;
      S.hx = S.hx.filter((h) => h.id !== x.id); S.hx.push(x); save(); pushLater(x); closeSheet(); toast('Сохранено');
    },
    'hx-del': () => { if (confirm('Удалить запись?')) { S.hx = S.hx.filter((h) => h.id !== x.id); save(); pushLater({ ...x, after: 0 }); closeSheet(); } },
  };
  openSheet(draw(), () => { sheetCtx = null; render(); });
}

function openHxAfter(x) {
  let after = null, sleepy = false;
  const draw = () => sheetHead('Как вы сейчас?') + `<p class="sub">Гидроксизин в ${esc(x.ts.slice(11))}, тревога была ${x.before}.</p>
    <div class="field"><div class="field-label"><b>Тревога сейчас</b><span class="val">${after ?? ''}</span></div>${segRow('after', after, 'спокойно', 'паника', 'hxa-set')}</div>
    <label class="check"><input type="checkbox" data-sheet-input="sleepy" ${sleepy ? 'checked' : ''}> Появилась сонливость</label>
    <button class="btn block" style="margin-top:14px" data-act="hxa-save" ${after == null ? 'disabled' : ''}>Сохранить</button>`;
  sheetCtx = {
    'hxa-set': (el) => { after = +el.dataset.val; const sh = $('.sheet'), top = sh.scrollTop; sh.innerHTML = '<div class="grab"></div>' + draw(); sh.scrollTop = top; },
    input: (el) => { sleepy = el.checked; },
    'hxa-save': () => { x.after = after; x.afterTs = nowStamp(); x.sleepy = sleepy; save(); pushLater(x); closeSheet(); toast('Сохранено'); },
  };
  openSheet(draw(), () => { sheetCtx = null; render(); });
}

function openReportSheet() {
  const t = todayKey();
  let from = S.settings.start < t ? earliestKey() : addDays(t, -13), to = t, all = false, daily = true;
  const draw = () => sheetHead('Отчёт для врача') + `
    <p class="sub">PDF можно отправить врачу в мессенджере или по почте или показать с телефона на приёме.</p>
    <div class="row"><div class="grow"><label class="lbl">С</label><input type="date" class="input" data-sheet-input="from" value="${from}"></div>
    <div class="grow"><label class="lbl">По</label><input type="date" class="input" data-sheet-input="to" value="${to}"></div></div>
    <label class="check"><input type="checkbox" data-sheet-input="daily" ${daily ? 'checked' : ''}> Таблица по дням</label>
    <label class="check"><input type="checkbox" data-sheet-input="all" ${all ? 'checked' : ''}> Все заметки, а не только отмеченные «обсудить с врачом»</label>
    <button class="btn block" style="margin-top:16px" data-act="pdf">Сформировать PDF</button>
    <p class="muted" style="margin-top:8px">В отчёт попадают только данные за выбранный период.</p>`;
  sheetCtx = {
    input: (el) => {
      const f = el.dataset.sheetInput;
      if (f === 'from') from = el.value; else if (f === 'to') to = el.value; else if (f === 'daily') daily = el.checked; else if (f === 'all') all = el.checked;
    },
    pdf: async (el) => {
      if (!from || !to || from > to) { toast('Проверьте даты'); return; }
      el.disabled = true; el.textContent = 'Готовлю…';
      try {
        const blob = await Report.build({ from, to, allNotes: all, daily });
        await shareFile(blob, `Отчёт ${fmtFull(from)}–${fmtFull(to)}.pdf`, 'application/pdf');
      } catch (e) { console.error(e); toast('Не получилось: ' + e.message); }
      el.disabled = false; el.textContent = 'Сформировать PDF';
    },
  };
  openSheet(draw(), () => { sheetCtx = null; });
}

function openOnboarding() {
  const st = S.settings;
  const draw = () => `<h1 style="margin-top:4px">Здравствуйте 🌿</h1>
    <p class="sub">Это личный дневник состояния на время лечения. Каждый день меньше минуты: таблетка, самочувствие, сон. Раз в 2 недели — короткий опросник. Из этого получаются графики и отчёт для врача.</p>
    <p class="sub">Все данные хранятся только на этом телефоне.</p>
    <label class="lbl">Дата первого приёма эсциталопрама</label><input type="date" class="input" data-sheet-input="start" value="${esc(st.start)}">
    <label class="lbl">Дозировка таблетки (на упаковке)</label>
    <div class="chips">${[5, 10, 15, 20].map((mg) => `<button class="chip ${st.tabletMg === mg ? 'on' : ''}" data-act="ob-mg" data-val="${mg}">${mg} мг</button>`).join('')}</div>
    <div class="card" style="margin-top:14px"><b>Схема</b><div class="small" style="margin-top:6px">
    ${[...st.schedule].sort((a, b) => a.day - b.day).map((s, i, arr) => `<div>${arr[i + 1] ? `Дни ${s.day}–${arr[i + 1].day - 1}` : `С ${s.day}-го дня`}: <b>${DOSE_TXT[s.dose]} ${s.dose === 1 ? 'таблетка' : 'таблетки'}</b></div>`).join('')}
    </div><div class="muted" style="margin-top:6px">Можно изменить потом в «Ещё → Лечение».</div></div>
    <button class="btn block" data-act="ob-done">Начать</button>`;
  sheetCtx = {
    input: (el) => { st[el.dataset.sheetInput] = el.value; },
    'ob-mg': (el) => { st.tabletMg = st.tabletMg === +el.dataset.val ? null : +el.dataset.val; $('.sheet').innerHTML = '<div class="grab"></div>' + draw(); },
    'ob-done': () => { S.onboarded = true; save(); closeSheet(); },
  };
  openSheet(draw(), () => { sheetCtx = null; S.onboarded = true; save(); render(); });
}

/* ================= Файлы ================= */
async function shareFile(blob, name, type) {
  const file = new File([blob], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/* ================= Уведомления ================= */
const PUSH_URL = 'https://sostoyanie-push.sostoyanie-app.workers.dev';
const VAPID_PUBLIC = 'BKDXuYhPjCH9BX51mV1v3awgcDBB7BeEcQDEezzHJ1Up1pk-2LdVRSS7GSRmuXcHeIijj6PcOMAKgGCtsP4G91c';
const isStandalone = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const b64uToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const pushPost = (path, body) => fetch(PUSH_URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: S.deviceId, ...body }) }).then((r) => r.json());

function pushState() {
  const st = S.settings, t = todayKey(), d = day(t);
  const lasts = Object.keys(SCALES).map((ty) => lastScale(ty)?.date).filter(Boolean).sort();
  return {
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    med: st.push.med, checkin: st.push.checkin, scales: st.push.scales, hxFollowup: st.push.hxFollowup,
    medTime: st.medTime, checkinTime: st.checkinTime, start: st.start, schedule: st.schedule, tabletMg: st.tabletMg,
    medName: st.medName.split(' (')[0],
    lastMedDay: d.med ? t : null,
    lastCheckinDay: Object.keys(METRICS).some((f) => d[f] != null) ? t : null,
    nextScaleDate: lasts.length ? addDays(lasts[0], 14) : addDays(st.start, 14),
  };
}
let pushTimer;
function schedulePushSync() {
  if (!S.settings.push.enabled) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushPost('/sync', pushState()).catch(() => {}), 1200);
}
async function pushSubscribe() {
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(VAPID_PUBLIC) }));
  const r = await pushPost('/sync', { ...pushState(), sub: sub.toJSON() });
  if (!r.ok) throw new Error(r.error || 'сервер не ответил');
}
async function pushEnable() {
  if (!isStandalone()) { alert('Откройте приложение с иконки на экране «Домой» — в Safari уведомления не работают.'); return; }
  if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) { alert('Уведомления требуют iOS 16.4 или новее.'); return; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { alert('Уведомления запрещены. Разрешить можно в Настройках iPhone → Уведомления → Состояние.'); return; }
  try {
    await pushSubscribe();
    S.settings.push.enabled = true; save(); render(); toast('Уведомления включены');
  } catch (e) { alert('Не получилось включить: ' + e.message); }
}
// При каждом открытии обновляем подписку (iOS иногда её меняет)
async function pushRefresh() {
  if (!S.settings.push.enabled || !('serviceWorker' in navigator) || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try { await pushSubscribe(); } catch {}
}
function pushLater(x) {
  if (!S.settings.push.enabled) return;
  const at = x.after == null && S.settings.push.hxFollowup ? new Date(x.ts).getTime() + 60 * 60000 : null;
  pushPost('/later', at && at > Date.now()
    ? { key: x.id, at, title: 'Как вы сейчас?', body: 'Прошёл час после гидроксизина. Отметьте, помог ли.' }
    : { key: x.id }).catch(() => {});
}

/* ================= Рендер и события ================= */
let sheetCtx = null;
function render() {
  const v = $('#view');
  v.innerHTML = ui.tab === 'today' ? renderToday() : ui.tab === 'diary' ? renderDiary() : ui.tab === 'stats' ? renderStats() : renderMore();
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
  if (ui.tab === 'stats') bindCharts();
}

const actions = {
  tab: (el) => { ui.tab = el.dataset.tab; if (ui.tab === 'today') ui.date = todayKey(); render(); window.scrollTo(0, 0); },
  day: (el) => {
    const dlt = +el.dataset.delta;
    ui.date = dlt === 0 ? todayKey() : addDays(ui.date, dlt);
    if (ui.date > todayKey()) ui.date = todayKey();
    render(); window.scrollTo(0, 0);
  },
  'open-day': (el) => { ui.tab = 'today'; ui.date = el.dataset.k; render(); window.scrollTo(0, 0); },
  set: (el) => {
    const f = el.dataset.field, v = +el.dataset.val;
    setDay(ui.date, { [f]: day(ui.date)[f] === v ? null : v }); render();
  },
  pick: (el) => {
    const f = el.dataset.field, v = +el.dataset.val;
    setDay(ui.date, { [f]: day(ui.date)[f] === v ? null : v }); render();
  },
  toggle: (el) => {
    const f = el.dataset.field, v = el.dataset.val, arr = [...(day(ui.date)[f] || [])];
    const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v);
    setDay(ui.date, { [f]: arr }); render();
  },
  sleep: (el) => {
    const cur = day(ui.date).sleepHours;
    const v = cur == null ? 7 : Math.min(16, Math.max(0, cur + +el.dataset.delta));
    setDay(ui.date, { sleepHours: v }); render();
  },
  med: () => { setDay(ui.date, { med: { t: ui.date === todayKey() ? nowTime() : S.settings.medTime, dose: doseFor(ui.date) } }); render(); toast('Отмечено ✓'); },
  'med-undo': () => { setDay(ui.date, { med: null }); render(); },
  'hx-new': () => openHx(null),
  'hx-edit': (el) => openHx(S.hx.find((h) => h.id === el.dataset.id)),
  'hx-after': (el) => openHxAfter(S.hx.find((h) => h.id === el.dataset.id)),
  'tag-add': () => {
    const v = (prompt('Новая метка') || '').trim();
    if (v && !S.settings.tags.includes(v)) { S.settings.tags.push(v); save(); render(); }
  },
  'tag-del': (el) => {
    if (confirm(`Удалить метку «${el.dataset.val}»? В уже сделанных записях она останется.`)) {
      S.settings.tags = S.settings.tags.filter((t) => t !== el.dataset.val); save(); render();
    }
  },
  scale: (el) => openScale(el.dataset.type),
  'scale-del': (el) => { if (confirm('Удалить результат опросника?')) { S.scales = S.scales.filter((s) => s.id !== el.dataset.id); save(); render(); } },
  period: (el) => { ui.period = el.dataset.val === 'all' ? 'all' : +el.dataset.val; render(); },
  series: (el) => { ui.series[el.dataset.val] = !ui.series[el.dataset.val]; render(); },
  report: () => openReportSheet(),
  mg: (el) => { S.settings.tabletMg = S.settings.tabletMg === +el.dataset.val ? null : +el.dataset.val; save(); render(); },
  'sched-add': () => {
    const last = [...S.settings.schedule].sort((a, b) => b.day - a.day)[0];
    S.settings.schedule.push({ day: (last ? last.day : 0) + 7, dose: last ? last.dose : 1 }); save(); render();
  },
  'sched-del': (el) => {
    const sorted = [...S.settings.schedule].sort((a, b) => a.day - b.day);
    if (sorted.length <= 1) return;
    sorted.splice(+el.dataset.i, 1); S.settings.schedule = sorted; save(); render();
  },
  'push-on': () => pushEnable(),
  'push-test': (el) => {
    el.disabled = true;
    pushPost('/test', {}).then((r) => toast(r.ok ? 'Отправлено — проверьте уведомление' : 'Не дошло, код ' + (r.status || r.error)))
      .catch(() => toast('Нет связи с сервером')).finally(() => { el.disabled = false; });
  },
  'push-off': async () => {
    S.settings.push.enabled = false; save(); render();
    pushPost('/unsubscribe', {}).catch(() => {});
    try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch {}
    toast('Уведомления выключены');
  },
  backup: async () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    await shareFile(blob, `Состояние-копия-${todayKey()}.json`, 'application/json');
    S.settings.lastBackup = todayKey(); save(); render();
  },
  wipe: () => {
    if (confirm('Удалить ВСЕ записи без возможности восстановления?') && confirm('Точно? Лучше сначала сохраните копию.')) {
      S = defaultState(); save(); ui.tab = 'today'; ui.date = todayKey(); render(); openOnboarding();
    }
  },
  close: () => closeSheet(),
  overlay: (el, e) => { if (e.target === el) closeSheet(); },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act;
  if (sheetCtx && sheetCtx[a]) return sheetCtx[a](el, e);
  if (actions[a]) actions[a](el, e);
});

let noteTimer;
function onInput(e) {
  const el = e.target;
  if (el.dataset.sheetInput && sheetCtx && sheetCtx.input) return sheetCtx.input(el);
  const f = el.dataset.input; if (!f) return;
  if (f === 'note') { clearTimeout(noteTimer); const k = ui.date; noteTimer = setTimeout(() => setDay(k, { note: el.value }), 400); return; }
  if (e.type !== 'change') return;
  if (f === 'forDoctor') { setDay(ui.date, { forDoctor: el.checked || null }); toast('Сохранено'); }
  else if (f === 'medtime') { const m = day(ui.date).med; if (m && el.value) setDay(ui.date, { med: { ...m, t: el.value } }); }
  else if (f === 'smooth') { ui.smooth = el.checked; render(); }
  else if (f.startsWith('push:')) { S.settings.push[f.slice(5)] = el.checked; save(); toast('Сохранено'); }
  else if (f.startsWith('set:')) {
    const key = f.slice(4);
    if (el.type === 'checkbox') S.settings[key] = el.checked;
    else if (key === 'start' && !el.value) return;
    else S.settings[key] = el.value;
    save(); if (key === 'start') render(); toast('Сохранено');
  } else if (f === 'sched-day' || f === 'sched-dose') {
    const sorted = [...S.settings.schedule].sort((a, b) => a.day - b.day), i = +el.dataset.i;
    if (f === 'sched-day') sorted[i].day = Math.max(1, parseInt(el.value, 10) || 1); else sorted[i].dose = +el.value;
    S.settings.schedule = sorted; save(); render();
  } else if (f === 'restore') {
    const file = el.files[0]; if (!file) return;
    file.text().then((txt) => {
      const data = JSON.parse(txt);
      if (!data || !data.settings || !data.days) throw new Error('bad');
      if (!confirm('Заменить текущие данные данными из копии?')) return;
      S = data; S.settings = { ...defaultState().settings, ...S.settings };
S.settings.push = { ...defaultState().settings.push, ...S.settings.push };
if (!S.deviceId) S.deviceId = Math.random().toString(36).slice(2) + Date.now().toString(36); save(); render(); toast('Восстановлено');
    }).catch(() => toast('Это не похоже на файл копии'));
  }
}
document.addEventListener('input', onInput);
document.addEventListener('change', onInput);
document.addEventListener('visibilitychange', () => {
  // при возвращении в приложение на следующий день показываем новый день
  if (document.visibilityState === 'visible' && !$('#sheet-root').innerHTML && document.activeElement?.tagName !== 'TEXTAREA') {
    if (ui.tab === 'today' && ui.date < todayKey() && sessionDate !== todayKey()) { ui.date = todayKey(); }
    sessionDate = todayKey(); render();
  }
});
let sessionDate = todayKey();

render();
if (!S.onboarded) openOnboarding();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').then(pushRefresh).catch(() => {});
