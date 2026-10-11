'use strict';
// SVG-графики без зависимостей. Один и тот же код рисует графики в приложении и в PDF.
const Charts = (() => {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function frame(o) {
    const s = o.scale || 1;
    const w = o.w || 340, h = o.h || 190;
    const padL = 26 * s, padR = 8 * s, padT = (o.markers && o.markers.length ? 20 : 10) * s, padB = 22 * s;
    const n = o.labels.length;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const step = plotW / Math.max(n, 1);
    const x = (i) => padL + (i + 0.5) * step;
    const yMin = o.yMin || 0, yMax = o.yMax;
    const y = (v) => padT + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;
    return { s, w, h, padL, padR, padT, padB, n, plotW, plotH, step, x, y, yMin, yMax };
  }

  function axes(f, o) {
    const c = o.colors, s = f.s, fs = 10.5 * s;
    let out = '';
    for (const t of o.yTicks) {
      const yy = f.y(t);
      out += `<line x1="${f.padL}" x2="${f.w - f.padR}" y1="${yy}" y2="${yy}" stroke="${t === f.yMin ? c.axis : c.grid}" stroke-width="${s}"/>`;
      out += `<text x="${f.padL - 6 * s}" y="${yy + 3.5 * s}" text-anchor="end" font-size="${fs}" fill="${c.muted}">${esc(o.yFmt ? o.yFmt(t) : t)}</text>`;
    }
    // подписи оси X: не больше ~6
    const n = f.n, maxLabels = Math.max(2, Math.floor(f.plotW / (48 * s)));
    const every = Math.max(1, Math.ceil(n / maxLabels));
    for (let i = 0; i < n; i += every) {
      out += `<text x="${f.x(i)}" y="${f.h - 6 * s}" text-anchor="middle" font-size="${fs}" fill="${c.muted}">${esc(o.xFmt ? o.xFmt(o.labels[i]) : o.labels[i])}</text>`;
    }
    for (const m of o.markers || []) {
      if (m.i < 0 || m.i >= n) continue;
      const xx = f.x(m.i) - f.step / 2;
      out += `<line x1="${xx}" x2="${xx}" y1="${f.padT - 4 * s}" y2="${f.padT + f.plotH}" stroke="${c.muted}" stroke-width="${s}" stroke-dasharray="${3 * s} ${3 * s}"/>`;
      out += `<text x="${xx + 3 * s}" y="${f.padT - 8 * s}" font-size="${fs}" fill="${c.ink2}" font-weight="600">${esc(m.label)}</text>`;
    }
    return out;
  }

  function wrap(f, inner, o) {
    const font = o.font || '-apple-system, system-ui, sans-serif';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f.w} ${f.h}" width="${o.pxW || f.w}" height="${o.pxH || f.h}" font-family="${esc(font)}"` +
      ` data-n="${f.n}" data-padl="${f.padL}" data-step="${f.step}" data-w="${f.w}">${inner}` +
      `<line class="cross" x1="0" x2="0" y1="${f.padT}" y2="${f.padT + f.plotH}" stroke="${o.colors.ink2}" stroke-width="${f.s}" opacity="0"/></svg>`;
  }

  // Линии. series: [{name, color, values:[num|null], dots:[num|null]?, connect?:bool, points?:bool}]
  function line(o) {
    const f = frame(o), s = f.s;
    let inner = axes(f, o);
    for (const se of o.series) {
      if (se.dots) {
        se.dots.forEach((v, i) => {
          if (v == null) return;
          inner += `<circle cx="${f.x(i)}" cy="${f.y(v)}" r="${2.2 * s}" fill="${se.color}" opacity=".3"/>`;
        });
      }
      let d = '', pen = false;
      se.values.forEach((v, i) => {
        if (v == null) { if (!se.connect) pen = false; return; }
        d += `${pen ? 'L' : 'M'}${f.x(i).toFixed(1)} ${f.y(v).toFixed(1)}`;
        pen = true;
      });
      if (d) inner += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="${2 * s}" stroke-linejoin="round" stroke-linecap="round"/>`;
      // одиночные точки и маркеры
      se.values.forEach((v, i) => {
        if (v == null) return;
        const prev = se.values[i - 1], next = se.values[i + 1];
        const lonely = !se.connect && prev == null && next == null;
        if (se.points || lonely) {
          inner += `<circle cx="${f.x(i)}" cy="${f.y(v)}" r="${4 * s}" fill="${se.color}" stroke="${o.colors.surface}" stroke-width="${2 * s}"/>`;
        }
      });
    }
    return wrap(f, inner, o);
  }

  // Столбики. values: [num|null]
  function bars(o) {
    const f = frame(o), s = f.s;
    let inner = axes(f, o);
    const gap = 2 * s;
    const bw = Math.max(1, Math.min(f.step - gap, 26 * s));
    const base = f.y(f.yMin);
    o.values.forEach((v, i) => {
      if (v == null || v <= 0) return;
      const top = f.y(v), hgt = base - top;
      const r = Math.min(4 * s, bw / 2, hgt);
      const x0 = f.x(i) - bw / 2, x1 = x0 + bw;
      inner += `<path d="M${x0} ${base}V${top + r}Q${x0} ${top} ${x0 + r} ${top}H${x1 - r}Q${x1} ${top} ${x1} ${top + r}V${base}Z" fill="${o.color}"/>`;
      if (o.valueLabels) {
        inner += `<text x="${f.x(i)}" y="${top - 4 * s}" text-anchor="middle" font-size="${10.5 * s}" fill="${o.colors.ink2}">${esc(o.valueLabels(v))}</text>`;
      }
    });
    return wrap(f, inner, o);
  }

  return { line, bars };
})();
