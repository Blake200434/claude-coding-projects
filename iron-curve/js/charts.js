// Lightweight, dependency-free SVG chart builders. Return HTML strings.
import { escapeHtml } from './utils.js';

const PAD = { top: 16, right: 16, bottom: 28, left: 42 };

function niceMax(v) {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const norm = v / mag;
  let step;
  if (norm <= 1) step = 1;
  else if (norm <= 2) step = 2;
  else if (norm <= 5) step = 5;
  else step = 10;
  return step * mag;
}

/**
 * series: [{ name, color, points: [{x, y}], dashed?, area? }]
 * bands: [{ x0, x1, color, label }]  -- background shading, x in same units as points
 * width/height: pixel size of the SVG viewBox
 * xTickFormat, yTickFormat: functions(value) -> string
 */
export function lineChart({ width = 640, height = 260, series, bands = [], xMin, xMax, yMin = 0, yMax, xTickFormat = (v) => v, yTickFormat = (v) => v, xTicks = 5, yTicks = 4 }) {
  const allX = series.flatMap((s) => s.points.map((p) => p.x));
  const allY = series.flatMap((s) => s.points.map((p) => p.y));
  if (!allX.length) return `<div class="chart-empty">Not enough data yet</div>`;

  const x0 = xMin ?? Math.min(...allX);
  const x1 = xMax ?? Math.max(...allX);
  const y1raw = yMax ?? Math.max(...allY, 1);
  const y1 = niceMax(y1raw * 1.08);
  const y0 = yMin;

  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const sx = (x) => PAD.left + (x1 === x0 ? innerW / 2 : ((x - x0) / (x1 - x0)) * innerW);
  const sy = (y) => PAD.top + innerH - ((y - y0) / (y1 - y0 || 1)) * innerH;

  let svg = `<svg viewBox="0 0 ${width} ${height}" class="chart-svg" preserveAspectRatio="none">`;

  // Phase bands
  for (const b of bands) {
    const bx0 = sx(Math.max(b.x0, x0));
    const bx1 = sx(Math.min(b.x1, x1));
    if (bx1 <= bx0) continue;
    svg += `<rect x="${bx0}" y="${PAD.top}" width="${bx1 - bx0}" height="${innerH}" fill="${b.color}" opacity="0.12"></rect>`;
  }

  // Gridlines + y labels
  for (let i = 0; i <= yTicks; i++) {
    const v = y0 + ((y1 - y0) * i) / yTicks;
    const gy = sy(v);
    svg += `<line x1="${PAD.left}" y1="${gy}" x2="${width - PAD.right}" y2="${gy}" class="chart-grid"></line>`;
    svg += `<text x="${PAD.left - 8}" y="${gy + 4}" class="chart-ylabel" text-anchor="end">${escapeHtml(yTickFormat(v))}</text>`;
  }

  // X labels
  for (let i = 0; i <= xTicks; i++) {
    const v = x0 + ((x1 - x0) * i) / xTicks;
    const gx = sx(v);
    svg += `<text x="${gx}" y="${height - PAD.bottom + 18}" class="chart-xlabel" text-anchor="middle">${escapeHtml(xTickFormat(v))}</text>`;
  }

  // Band labels
  for (const b of bands) {
    if (!b.label) continue;
    const bx0 = sx(Math.max(b.x0, x0));
    const bx1 = sx(Math.min(b.x1, x1));
    if (bx1 <= bx0) continue;
    svg += `<text x="${(bx0 + bx1) / 2}" y="${PAD.top + 12}" class="chart-bandlabel" text-anchor="middle" fill="${b.color}">${escapeHtml(b.label)}</text>`;
  }

  // Series
  for (const s of series) {
    const pts = s.points.filter((p) => p.y !== null && p.y !== undefined);
    if (!pts.length) continue;
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
    if (s.area) {
      const areaPath = `${path} L ${sx(pts[pts.length - 1].x).toFixed(1)} ${sy(y0).toFixed(1)} L ${sx(pts[0].x).toFixed(1)} ${sy(y0).toFixed(1)} Z`;
      svg += `<path d="${areaPath}" fill="${s.color}" opacity="0.08"></path>`;
    }
    svg += `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2.5" ${s.dashed ? 'stroke-dasharray="6,5"' : ''} stroke-linecap="round" stroke-linejoin="round"></path>`;
    if (!s.dashed) {
      for (const p of pts) {
        svg += `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="3.2" fill="${s.color}"><title>${escapeHtml(xTickFormat(p.x))}: ${escapeHtml(yTickFormat(p.y))}</title></circle>`;
      }
    }
  }

  svg += `</svg>`;

  const legend = series.length > 1 || series.some((s) => s.dashed)
    ? `<div class="chart-legend">${series.map((s) => `<span class="legend-item"><span class="legend-swatch" style="background:${s.color};${s.dashed ? 'opacity:.55' : ''}"></span>${escapeHtml(s.name)}</span>`).join('')}</div>`
    : '';

  return `<div class="chart-wrap">${svg}${legend}</div>`;
}

/**
 * groups: [{ label, segments: [{ value, color, name }] }]  stacked bar per group
 */
export function stackedBarChart({ width = 640, height = 220, groups, yTickFormat = (v) => v, yTicks = 4 }) {
  if (!groups.length) return `<div class="chart-empty">Not enough data yet</div>`;
  const totals = groups.map((g) => g.segments.reduce((s, seg) => s + seg.value, 0));
  const yMax = niceMax(Math.max(...totals, 1) * 1.1);
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const bw = innerW / groups.length;
  const barW = Math.min(bw * 0.6, 46);

  const sy = (v) => PAD.top + innerH - (v / yMax) * innerH;

  let svg = `<svg viewBox="0 0 ${width} ${height}" class="chart-svg" preserveAspectRatio="none">`;
  for (let i = 0; i <= yTicks; i++) {
    const v = (yMax * i) / yTicks;
    const gy = sy(v);
    svg += `<line x1="${PAD.left}" y1="${gy}" x2="${width - PAD.right}" y2="${gy}" class="chart-grid"></line>`;
    svg += `<text x="${PAD.left - 8}" y="${gy + 4}" class="chart-ylabel" text-anchor="end">${escapeHtml(yTickFormat(v))}</text>`;
  }

  groups.forEach((g, i) => {
    const cx = PAD.left + bw * i + bw / 2;
    let yCursor = PAD.top + innerH;
    for (const seg of g.segments) {
      if (seg.value <= 0) continue;
      const segH = (seg.value / yMax) * innerH;
      yCursor -= segH;
      svg += `<rect x="${cx - barW / 2}" y="${yCursor}" width="${barW}" height="${segH}" fill="${seg.color}" rx="3"><title>${escapeHtml(g.label)} — ${escapeHtml(seg.name)}: ${escapeHtml(String(Math.round(seg.value)))}</title></rect>`;
    }
    svg += `<text x="${cx}" y="${height - PAD.bottom + 18}" class="chart-xlabel" text-anchor="middle">${escapeHtml(g.label)}</text>`;
  });

  svg += `</svg>`;
  return `<div class="chart-wrap">${svg}</div>`;
}

export function ring({ size = 120, stroke = 10, pct, color = 'var(--accent)', track = 'var(--ring-track)', label = '', sub = '' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct));
  const offset = c * (1 - clamped);
  return `
    <div class="ring" style="width:${size}px;height:${size}px">
      <svg viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"></circle>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
          stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"></circle>
      </svg>
      <div class="ring-center">
        <div class="ring-label">${escapeHtml(label)}</div>
        <div class="ring-sub">${escapeHtml(sub)}</div>
      </div>
    </div>`;
}

export function barMeter({ label, value, max, unit = '', color = 'var(--accent)' }) {
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const over = value > max;
  return `
    <div class="meter">
      <div class="meter-head">
        <span>${escapeHtml(label)}</span>
        <span class="meter-value">${Math.round(value)}${escapeHtml(unit)} / ${Math.round(max)}${escapeHtml(unit)}</span>
      </div>
      <div class="meter-track">
        <div class="meter-fill" style="width:${pct * 100}%;background:${over ? 'var(--danger)' : color}"></div>
      </div>
    </div>`;
}
