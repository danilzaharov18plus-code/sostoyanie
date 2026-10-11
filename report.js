'use strict';
// PDF-отчёт: страницы рисуются на canvas (кириллица — системным шрифтом), затем упаковываются в PDF как JPEG.
const Report = (() => {
  const W = 1240, H = 1754, M = 96, CW = W - 2 * M;
  const FONT = '-apple-system, system-ui, "Helvetica Neue", Arial, sans-serif';
  const C = { ink: '#1d1c1a', ink2: '#55534e', muted: '#8a877f', line: '#e3dfd6', accent: '#2f7d6d', soft: '#eef5f2', danger: '#b23a3a', dangerSoft: '#fbe9e7' };
  const PAL = { mood: '#2a78d6', anxiety: '#eb6834', energy: '#1baf7a', interest: '#eda100', sleep: '#5598e7', hx: '#6250d6', PHQ9: '#2a78d6', GAD7: '#eb6834' };
  const CHART = { grid: '#e8e5dd', axis: '#c3c2b7', muted: '#8a877f', ink2: '#55534e', surface: '#ffffff' };

  class Doc {
    constructor() { this.pages = []; this.newPage(); }
    newPage() {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
      this.pages.push(c); this.ctx = x; this.y = M;
    }
    ensure(h) { if (this.y + h > H - M - 20) { this.newPage(); return true; } return false; }
    font(size, bold) { this.ctx.font = `${bold ? '600 ' : ''}${size}px ${FONT}`; }
    wrap(text, size, bold, maxW) {
      this.font(size, bold);
      const out = [];
      for (const para of String(text).split('\n')) {
        let cur = '';
        for (const word of para.split(' ')) {
          const t = cur ? cur + ' ' + word : word;
          if (this.ctx.measureText(t).width <= maxW || !cur) cur = t; else { out.push(cur); cur = word; }
        }
        out.push(cur);
      }
      return out;
    }
    text(text, o = {}) {
      const size = o.size || 23, lh = size * 1.38, x = o.x || M;
      for (const l of this.wrap(text, size, o.bold, o.maxW || CW - (x - M))) {
        this.ensure(lh);
        this.font(size, o.bold); this.ctx.fillStyle = o.color || C.ink; this.ctx.fillText(l, x, this.y + size);
        this.y += lh;
      }
      this.y += o.gap ?? 6;
    }
    h2(t) {
      this.ensure(130); this.y += 22;
      this.font(31, true); this.ctx.fillStyle = C.ink; this.ctx.fillText(t, M, this.y + 31);
      this.y += 44; this.ctx.fillStyle = C.accent; this.ctx.fillRect(M, this.y, 56, 4); this.y += 18;
    }
    box(lines, color, bg) {
      const size = 22, lh = size * 1.38, pad = 18;
      const wrapped = lines.flatMap((l) => this.wrap(l, size, false, CW - 2 * pad));
      const h = wrapped.length * lh + 2 * pad;
      this.ensure(h);
      this.ctx.fillStyle = bg; roundRect(this.ctx, M, this.y, CW, h, 14); this.ctx.fill();
      this.font(size, false); this.ctx.fillStyle = color;
      wrapped.forEach((l, i) => this.ctx.fillText(l, M + pad, this.y + pad + i * lh + size));
      this.y += h + 12;
    }
    table(cols, rows, o = {}) {
      const size = o.size || 20, lh = size * 1.32, padY = 9, padX = 8;
      const widths = cols.map((c) => c.w * CW);
      const drawHeader = () => {
        this.font(size - 2, true);
        const hh = lh + 2 * padY;
        this.ctx.fillStyle = C.soft; this.ctx.fillRect(M, this.y, CW, hh);
        let x = M;
        cols.forEach((c, i) => { this.ctx.fillStyle = C.ink2; this.font(size - 2, true); this.ctx.fillText(c.t, x + padX, this.y + padY + size - 2); x += widths[i]; });
        this.y += hh;
      };
      this.ensure(lh * 2 + 2 * padY + Math.max(lh * 3, 120)); drawHeader();
      for (const row of rows) {
        const cells = row.cells || row;
        const wrapped = cells.map((v, i) => this.wrap(v ?? '', size, cols[i].bold, widths[i] - 2 * padX));
        const rh = Math.max(...wrapped.map((w) => w.length)) * lh + 2 * padY;
        if (this.ensure(rh)) drawHeader();
        if (row.bg) { this.ctx.fillStyle = row.bg; this.ctx.fillRect(M, this.y, CW, rh); }
        let x = M;
        wrapped.forEach((ls, i) => {
          this.font(size, cols[i].bold); this.ctx.fillStyle = row.color || C.ink;
          ls.forEach((l, j) => {
            const tw = this.ctx.measureText(l).width;
            const tx = cols[i].right ? x + widths[i] - padX - tw : x + padX;
            this.ctx.fillText(l, tx, this.y + padY + j * lh + size);
          });
          x += widths[i];
        });
        this.y += rh;
        this.ctx.fillStyle = C.line; this.ctx.fillRect(M, this.y - 1, CW, 1);
      }
      this.y += 14;
    }
    image(img, h) { this.ensure(h + 10); this.ctx.drawImage(img, M, this.y, CW, h); this.y += h + 8; }
    legend(items) {
      this.ensure(40); let x = M; this.font(20, false);
      for (const [name, color] of items) {
        this.ctx.fillStyle = color; roundRect(this.ctx, x, this.y + 10, 28, 6, 3); this.ctx.fill();
        this.ctx.fillStyle = C.ink2; this.ctx.fillText(name, x + 36, this.y + 20);
        x += 36 + this.ctx.measureText(name).width + 34;
      }
      this.y += 40;
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  const svgImg = (svg) => new Promise((res, rej) => {
    const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error('график не отрисовался'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  const chartOpts = (spec, h) => ({ ...spec, w: CW, h, scale: 2.1, pxW: CW * 2, pxH: h * 2, font: FONT });

  async function build({ from, to, allNotes, daily }) {
    const st = S.settings;
    const keys = daysRange(from, to);
    const doc = new Doc();
    const today = todayKey();

    // Заголовок
    doc.text('Дневник состояния — отчёт для врача', { size: 42, bold: true, gap: 10 });
    const meta = [];
    if (st.name) meta.push(`Пациент: ${st.name}`);
    meta.push(`Период: ${fmtFull(from)} — ${fmtFull(to)} (${keys.length} ${plural(keys.length, 'день', 'дня', 'дней')})`);
    meta.push(`Сформировано: ${fmtFull(today)}. Данные внесены пациентом самостоятельно.`);
    meta.forEach((m) => doc.text(m, { size: 22, color: C.ink2, gap: 2 }));

    // Терапия
    doc.h2('Терапия');
    const sched = [...st.schedule].sort((a, b) => a.day - b.day);
    doc.text(`${st.medName}${st.tabletMg ? `, таблетки по ${st.tabletMg} мг` : ''}. Начало приёма: ${fmtFull(st.start)}, вечером.`, { size: 23 });
    doc.table([{ t: 'Период', w: 0.45 }, { t: 'Доза', w: 0.55 }], sched.map((s, i) => {
      const s0 = stepStart(s), nx = sched[i + 1];
      return [nx ? `${fmtFull(s0)} — ${fmtFull(addDays(stepStart(nx), -1))}` : `с ${fmtFull(s0)}`, doseText(s.dose)];
    }));
    const ad = adherence(from, to);
    if (ad.total) doc.text(`Отмечен приём в ${ad.taken} из ${ad.total} дней лечения за период (${Math.round((ad.taken / ad.total) * 100)}%).`, { size: 23 });
    const hxs = S.hx.filter((h) => keys.includes(h.ts.slice(0, 10))).sort((a, b) => a.ts.localeCompare(b.ts));
    const hxRated = hxs.filter((h) => h.after != null);
    doc.text(`${st.hxName}${st.hxDose ? ' ' + st.hxDose : ''} по необходимости: ${hxs.length} ${plural(hxs.length, 'приём', 'приёма', 'приёмов')} за период` +
      (hxRated.length ? `; тревога в среднем ${r1(mean(hxRated.map((h) => h.before)))} → ${r1(mean(hxRated.map((h) => h.after)))} через ~1 ч (шкала 0–10).` : '.'), { size: 23 });

    // Опросники
    const sc = S.scales.filter((s) => s.date >= from && s.date <= to).sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
    if (sc.length) {
      doc.h2('Опросники (PHQ-9, GAD-7)');
      doc.table([{ t: 'Дата', w: 0.18 }, { t: 'Шкала', w: 0.16 }, { t: 'Балл', w: 0.12, bold: true }, { t: 'Выраженность', w: 0.2 }, { t: 'Ответы по пунктам', w: 0.34 }],
        sc.map((s) => [fmtFull(s.date), SCALES[s.type].short, `${s.total} / ${SCALES[s.type].max}`, scaleLevel(s.type, s.total), s.answers.join(' · ')]));
      const risk = sc.filter((s) => s.type === 'PHQ9' && s.answers[8] > 0);
      if (risk.length) {
        doc.box(risk.map((s) => `⚠ PHQ-9 от ${fmtFull(s.date)}: пункт 9 (мысли о смерти или самоповреждении) — «${SCALE_OPTS[s.answers[8]]}».`), C.danger, C.dangerSoft);
      }
      const first = {}, last = {};
      sc.forEach((s) => { first[s.type] = first[s.type] || s; last[s.type] = s; });
      const ch = Object.keys(first).filter((t) => first[t] !== last[t]).map((t) => `${SCALES[t].short}: ${first[t].total} → ${last[t].total}`);
      if (ch.length) doc.text('Динамика: ' + ch.join('; ') + '.', { size: 23 });
    }

    // Самочувствие
    doc.h2('Самочувствие (самооценка 0–10)');
    const rows = [];
    for (const [f, m] of Object.entries(METRICS)) {
      const c = compare(keys, f), all = mean(keys.map((k) => day(k)[f]));
      if (all == null) continue;
      rows.push([m.name + (m.up ? '' : ' (меньше — лучше)'), r1(all), c ? r1(c.a) : '—', c ? r1(c.b) : '—', c ? (c.delta > 0 ? '+' : c.delta < 0 ? '−' : '') + r1(Math.abs(c.delta)) : '—']);
    }
    const sAll = mean(keys.map((k) => day(k).sleepHours)), sc2 = compare(keys, 'sleepHours');
    if (sAll != null) rows.push(['Сон, часов', r1(sAll), sc2 ? r1(sc2.a) : '—', sc2 ? r1(sc2.b) : '—', sc2 ? (sc2.delta > 0 ? '+' : sc2.delta < 0 ? '−' : '') + r1(Math.abs(sc2.delta)) : '—']);
    if (rows.length) {
      doc.table([{ t: 'Показатель', w: 0.36 }, { t: 'Среднее', w: 0.15, right: true }, { t: 'Первые 7 дн.', w: 0.17, right: true }, { t: 'Последние 7 дн.', w: 0.18, right: true }, { t: 'Изменение', w: 0.14, right: true }], rows);
    } else doc.text('Нет записей за период.', { color: C.muted });

    if (keys.length >= 2 && rows.length) {
      const spec = moodChartSpec(keys, CHART, { all: true, smooth: keys.length >= 10, palette: PAL });
      doc.ensure(470);
      doc.text(keys.length >= 10 ? 'Динамика: линия — среднее за 7 дней, точки — отдельные дни. Пунктир — смена дозы.' : 'Динамика по дням. Пунктир — смена дозы.', { size: 20, color: C.ink2, gap: 2 });
      doc.image(await svgImg(Charts.line(chartOpts(spec, 380))), 380);
      doc.legend(spec.series.map((s) => [s.name, s.color]));

      if (keys.some((k) => day(k).sleepHours != null)) {
        doc.ensure(330); doc.text('Сон, часов', { size: 22, bold: true, gap: 2 });
        doc.image(await svgImg(Charts.bars(chartOpts(sleepChartSpec(keys, CHART, PAL.sleep), 260))), 260);
      }
    }
    if (sc.length >= 2) {
      doc.ensure(400); doc.text('Опросники: баллы', { size: 22, bold: true, gap: 2 });
      const spec = scalesChartSpec(keys, CHART, PAL);
      doc.image(await svgImg(Charts.line(chartOpts(spec, 300))), 300);
      doc.legend([['PHQ-9 (депрессия)', PAL.PHQ9], ['GAD-7 (тревога)', PAL.GAD7]]);
    }

    // Побочные эффекты
    const se = sideEffectStats(keys);
    doc.h2('Побочные эффекты');
    if (se.length) doc.table([{ t: 'Симптом', w: 0.4 }, { t: 'Дней', w: 0.15, right: true }, { t: 'Первый — последний раз', w: 0.45 }],
      se.map((s) => [s.name, String(s.count), s.first === s.last ? fmtFull(s.first) : `${fmtFull(s.first)} — ${fmtFull(s.last)}`]));
    else doc.text('Не отмечались.', { color: C.muted });

    // Гидроксизин
    if (hxs.length) {
      doc.h2(`${st.hxName}: журнал приёмов`);
      doc.table([{ t: 'Дата, время', w: 0.24 }, { t: 'Тревога до', w: 0.14, right: true }, { t: 'Через ~1 ч', w: 0.14, right: true }, { t: 'Повод, заметка', w: 0.48 }],
        hxs.map((h) => [`${fmtFull(h.ts.slice(0, 10))} ${h.ts.slice(11)}`, String(h.before), h.after == null ? '—' : String(h.after) + (h.sleepy ? ' (сонл.)' : ''), [h.reason, h.note].filter(Boolean).join('. ')]));
    }

    // Наблюдения
    const ins = insights(keys);
    if (ins.length) {
      doc.h2('Наблюдения по записям');
      ins.forEach((i) => doc.text('• ' + i, { size: 22, gap: 4 }));
      doc.text('Совпадения в данных самонаблюдения, не выводы.', { size: 19, color: C.muted });
    }

    // Заметки
    const notes = keys.filter((k) => day(k).note && (allNotes || day(k).forDoctor));
    doc.h2(allNotes ? 'Заметки' : 'Заметки «обсудить с врачом»');
    if (notes.length) doc.table([{ t: 'Дата', w: 0.18 }, { t: 'Заметка', w: 0.82 }], notes.map((k) => ({ cells: [fmtFull(k), day(k).note], bg: allNotes && day(k).forDoctor ? C.soft : null })));
    else doc.text('Нет.', { color: C.muted });

    // По дням
    if (daily) {
      doc.h2('Записи по дням');
      const list = keys.filter((k) => Object.keys(day(k)).length || hxOn(k).length);
      if (list.length) {
        doc.table([{ t: 'Дата', w: 0.11 }, { t: 'Доза', w: 0.1 }, { t: 'Наст.', w: 0.08, right: true }, { t: 'Трев.', w: 0.08, right: true }, { t: 'Энерг.', w: 0.09, right: true }, { t: 'Инт.', w: 0.07, right: true }, { t: 'Сон', w: 0.08, right: true }, { t: 'Гидр.', w: 0.08, right: true }, { t: 'Метки, побочные', w: 0.31 }],
          list.map((k) => {
            const d = day(k), dz = doseFor(k);
            return [fmtShort(k), dz == null ? '—' : (DOSE_TXT[dz] || dz) + (d.med ? ' ✓' : ' ✗'), d.mood ?? '', d.anxiety ?? '', d.energy ?? '', d.interest ?? '', d.sleepHours != null ? r1(d.sleepHours) : '', hxOn(k).length || '',
              [...(d.tags || []), ...(d.side || []).map((s) => '⚠ ' + s)].join(', ')].map(String);
          }), { size: 18 });
        doc.text('✓ — приём отмечен, ✗ — не отмечен. Шкалы 0–10: чем выше настроение, энергия и интерес, тем лучше; чем выше тревога, тем хуже.', { size: 18, color: C.muted });
      } else doc.text('Нет записей.', { color: C.muted });
    }

    // Колонтитулы
    doc.pages.forEach((c, i) => {
      const x = c.getContext('2d'); x.font = `18px ${FONT}`; x.fillStyle = C.muted;
      x.fillText('Дневник состояния · данные самонаблюдения, не заменяют клиническую оценку', M, H - 50);
      const t = `${i + 1} / ${doc.pages.length}`; x.fillText(t, W - M - x.measureText(t).width, H - 50);
    });

    const jpegs = [];
    for (const c of doc.pages) {
      const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.88));
      jpegs.push(new Uint8Array(await blob.arrayBuffer()));
    }
    return pdf(jpegs);
  }

  function pdf(jpegs) {
    const enc = new TextEncoder(), parts = [], offs = [];
    let len = 0;
    const put = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const n = jpegs.length, total = 2 + n * 3;
    put('%PDF-1.4\n%âãÏÓ\n');
    offs[1] = len; put('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    offs[2] = len; put(`2 0 obj\n<< /Type /Pages /Count ${n} /Kids [${jpegs.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>\nendobj\n`);
    jpegs.forEach((jp, i) => {
      const p = 3 + i * 3, cId = p + 1, imId = p + 2;
      const content = 'q 595.28 0 0 841.89 0 0 cm /Im0 Do Q\n';
      offs[p] = len; put(`${p} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imId} 0 R >> >> /Contents ${cId} 0 R >>\nendobj\n`);
      offs[cId] = len; put(`${cId} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);
      offs[imId] = len; put(`${imId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jp.length} >>\nstream\n`);
      put(jp); put('\nendstream\nendobj\n');
    });
    const xref = len;
    let x = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= total; i++) x += `${String(offs[i]).padStart(10, '0')} 00000 n \n`;
    put(x + `trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: 'application/pdf' });
  }

  return { build };
})();
