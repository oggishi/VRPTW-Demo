'use strict';
// ══════════════════════════════════════════════════════════════════════
//  NEXUS — app.js
//  Reads nexus_demo.json schema exactly as produced by logistics_v3.ipynb
//  Keys: meta, nodes, alns, rl_alns, op_matrix, destroy_ops, repair_ops,
//        summary, transfer
//  rl_alns.algo = "DDQN-ALNS"
// ══════════════════════════════════════════════════════════════════════

// ── PALETTE (must match CSS) ──────────────────────────────────────────
const C = {
  sky:'#38bdf8', green:'#10e89e', amber:'#fbbf24', red:'#f87171',
  purple:'#c084fc', t1:'#d8ecf8', t2:'#5c8fad', t3:'#254560', t4:'#102030',
  bg:'#060e18', bg2:'#09141f', bg3:'#0d1c2d', bg4:'#132438',
};
const ROUTE_COLORS = [
  '#38bdf8','#10e89e','#fbbf24','#c084fc','#f87171','#34d399','#fb923c',
  '#a78bfa','#f472b6','#60a5fa','#4ade80','#facc15','#e879f9','#2dd4bf',
  '#818cf8','#fb7185','#86efac','#fde047',
];

// ── GLOBAL STATE ──────────────────────────────────────────────────────
let DATA = null;
let map = null;
let layersRoutes = [], layersStops = [], layersTW = [];
let layerCtrl = { routes: true, stops: true, tw: false };
let activeAlgo = 'rl'; // 'rl' | 'alns'
let replayT = 0, replayPlaying = false, replayRaf = null;
let vehMarkers = [];
let simRaf = null, simLast = null;

// ── COORD MAPPING ─────────────────────────────────────────────────────
// Solomon coords (0–100) → HCMC lat/lng
function toLL(x, y) {
  return [
    +(10.680 + (y / 100) * 0.16).toFixed(6),
    +(106.620 + (x / 100) * 0.18).toFixed(6),
  ];
}

// ── FILE HANDLING ─────────────────────────────────────────────────────
const dropZone  = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const ucStatus  = document.getElementById('uc-status');

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('over');
  loadFile(e.dataTransfer.files[0]);
});
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => loadFile(e.target.files[0]));

function loadFile(file) {
  if (!file) return;
  if (!file.name.endsWith('.json')) {
    setStatus('err', '✗ Only .json files accepted');
    return;
  }
  setStatus('loading', '◌ Parsing…');
  const r = new FileReader();
  r.onload = e => {
    try {
      DATA = JSON.parse(e.target.result);
      validateData(DATA);
      dropZone.classList.add('loaded');
      setStatus('ok', `✓ ${file.name} — ${DATA.meta.n_customers} customers, ${DATA.nodes.length - 1} nodes loaded`);
      setTimeout(launchDash, 350);
    } catch (err) {
      setStatus('err', '✗ ' + err.message);
    }
  };
  r.readAsText(file);
}

function validateData(d) {
  if (!d.nodes || d.nodes.length < 2) throw new Error('nodes array missing or too short');
  if (!d.alns && !d.rl_alns) throw new Error('Need at least one solution (alns or rl_alns)');
}

function setStatus(cls, msg) {
  ucStatus.className = 'uc-status ' + cls;
  ucStatus.textContent = msg;
}

// ── LAUNCH ────────────────────────────────────────────────────────────
function launchDash() {
  document.getElementById('screen-upload').classList.add('hidden');
  document.getElementById('screen-dash').classList.remove('hidden');
  setTimeout(() => {
    initMap();
    renderAll();
  }, 60);
}

function renderAll() {
  const sol = activeSolution();
  renderTopbar();
  renderKPIs(sol);
  renderBarCompare();
  renderRouteList(sol);
  renderMap(sol);
  renderMapStat(sol);
  renderConvergence();
  renderHeatmap();
  renderGapChart();
  renderTransfer();
  renderSummary();
}

function activeSolution() {
  return activeAlgo === 'rl' ? DATA.rl_alns : DATA.alns;
}

// ── TOPBAR ────────────────────────────────────────────────────────────
function renderTopbar() {
  const m = DATA.meta;
  document.getElementById('tb-instance').textContent = m.instance || '—';
  document.getElementById('tb-meta').textContent =
    `${m.n_customers} customers · Cap ${m.capacity} · Horizon ${m.horizon} · ${m.dataset || 'Solomon'}`;
}

document.querySelectorAll('.algo-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.algo-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeAlgo = btn.dataset.algo;
    const sol = activeSolution();
    renderKPIs(sol);
    renderRouteList(sol);
    renderMap(sol);
    renderMapStat(sol);
    renderConvergence();
    const label = activeAlgo === 'rl' ? 'DDQN-ALNS' : 'ALNS';
    document.getElementById('route-label').textContent = label;
    document.getElementById('map-badge').textContent = label;
    document.getElementById('map-badge').className = 'map-badge' + (activeAlgo === 'alns' ? ' alns' : '');
  });
});

document.getElementById('btn-reset').addEventListener('click', () => {
  location.reload();
});

// ── KPIs ──────────────────────────────────────────────────────────────
function renderKPIs(sol) {
  if (!sol) return;
  const bks_td = sol.bks_td || DATA.alns?.bks_td || 0;
  const bks_nv = sol.bks_nv || DATA.alns?.bks_nv || 0;
  const alns = DATA.alns;

  const kpis = [
    {
      v: sol.nv,
      label: 'Vehicles',
      sub: `BKS: ${bks_nv}`,
      color: sol.nv <= bks_nv ? C.green : C.amber,
    },
    {
      v: (sol.gap_pct > 0 ? '+' : '') + sol.gap_pct.toFixed(2) + '%',
      label: 'Gap vs BKS',
      sub: `ALNS: ${alns ? (alns.gap_pct > 0 ? '+' : '') + alns.gap_pct.toFixed(2) + '%' : '—'}`,
      color: sol.gap_pct <= 0 ? C.green : sol.gap_pct < 5 ? C.amber : C.red,
    },
    {
      v: sol.td.toFixed(1),
      label: 'Total Dist',
      sub: `BKS: ${bks_td}`,
      color: C.sky,
    },
    {
      v: '100%',
      label: 'On-time Rate',
      sub: 'All TW valid',
      color: C.green,
    },
  ];

  document.getElementById('kpi-row').innerHTML = kpis.map(k => `
    <div class="kpi">
      <div class="kpi-v" style="color:${k.color}">${k.v}</div>
      <div class="kpi-l">${k.label}</div>
      <div class="kpi-s">${k.sub}</div>
    </div>`).join('');
}

// ── BAR COMPARE ───────────────────────────────────────────────────────
function renderBarCompare() {
  const a = DATA.alns, b = DATA.rl_alns;
  if (!a || !b) return;
  const bks = b.bks_td || a.bks_td;
  const maxV = Math.max(a.td, b.td, bks) * 1.06;

  document.getElementById('bar-compare').innerHTML = `
    <div class="bc-row">
      <span class="bc-name" style="color:${C.t3}">BKS</span>
      <div class="bc-bar-wrap"><div class="bc-bar" style="width:${(bks/maxV*100).toFixed(1)}%;background:${C.t3}"></div></div>
      <span class="bc-val" style="color:${C.t3}">${bks}</span>
    </div>
    <div class="bc-row">
      <span class="bc-name" style="color:${C.amber}">ALNS</span>
      <div class="bc-bar-wrap"><div class="bc-bar" style="width:${(a.td/maxV*100).toFixed(1)}%;background:${C.amber}"></div></div>
      <span class="bc-val" style="color:${C.amber}">${a.td}</span>
    </div>
    <div class="bc-row">
      <span class="bc-name" style="color:${C.green}">DDQN-ALNS</span>
      <div class="bc-bar-wrap"><div class="bc-bar" style="width:${(b.td/maxV*100).toFixed(1)}%;background:${C.green}"></div></div>
      <span class="bc-val" style="color:${C.green}">${b.td}</span>
    </div>
    <div class="bc-note">
      DDQN-ALNS saves <strong style="color:${C.green}">${(a.td - b.td).toFixed(1)}</strong> vs ALNS
      &nbsp;·&nbsp; Gap <strong style="color:${b.gap_pct<=0?C.green:C.amber}">${b.gap_pct>0?'+':''}${b.gap_pct.toFixed(2)}%</strong>
    </div>`;
}

// ── ROUTE LIST ────────────────────────────────────────────────────────
function renderRouteList(sol) {
  if (!sol?.routes) return;
  const el = document.getElementById('route-list');
  document.getElementById('route-count').textContent = `(${sol.routes.length})`;
  el.innerHTML = sol.routes.map((r, i) => {
    const c = ROUTE_COLORS[i % ROUTE_COLORS.length];
    return `<div class="r-row" data-ri="${i}">
      <span class="r-dot" style="background:${c}"></span>
      <span class="r-vid">V${r.id}</span>
      <span class="r-stops">${r.nodes.length} stops</span>
      <span class="r-dist">${r.dist.toFixed(1)}</span>
    </div>`;
  }).join('');

  el.querySelectorAll('.r-row').forEach(row => {
    row.addEventListener('click', () => {
      el.querySelectorAll('.r-row').forEach(r => r.classList.remove('active'));
      row.classList.add('active');
      const ri = +row.dataset.ri;
      const pl = layersRoutes[ri];
      if (pl) map.fitBounds(pl.getBounds(), { padding: [40, 40] });
    });
  });
}

// ── MAP ───────────────────────────────────────────────────────────────
function initMap() {
  const ctr = toLL(50, 50);
  map = L.map('map', { center: ctr, zoom: 13, zoomControl: true, attributionControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  setTimeout(() => map.invalidateSize(), 100);
}

function clearMapLayers() {
  [...layersRoutes, ...layersStops, ...layersTW].forEach(l => { try { l.remove(); } catch {} });
  vehMarkers.forEach(v => { try { v.marker.remove(); } catch {} });
  layersRoutes = []; layersStops = []; layersTW = []; vehMarkers = [];
}

function depotIcon() {
  return L.divIcon({
    className: '',
    html: `<svg width="16" height="16" viewBox="0 0 16 16">
      <rect x="1" y="1" width="14" height="14" rx="3" fill="#060e18" stroke="#c084fc" stroke-width="1.8"/>
      <circle cx="8" cy="8" r="3.5" fill="#c084fc"/>
    </svg>`,
    iconSize: [16, 16], iconAnchor: [8, 8],
  });
}

function stopIcon(color) {
  return L.divIcon({
    className: '',
    html: `<svg width="10" height="10" viewBox="0 0 10 10">
      <circle cx="5" cy="5" r="3.5" fill="${color}" opacity=".85" stroke="rgba(0,0,0,.5)" stroke-width=".8"/>
    </svg>`,
    iconSize: [10, 10], iconAnchor: [5, 5],
  });
}

function vehIcon(color, angle) {
  return L.divIcon({
    className: '',
    html: `<svg width="14" height="14" viewBox="0 0 14 14" style="transform:rotate(${angle}deg)">
      <polygon points="7,1 13,13 7,10 1,13" fill="${color}" stroke="rgba(0,0,0,.7)" stroke-width="1"/>
    </svg>`,
    iconSize: [14, 14], iconAnchor: [7, 7],
  });
}

function renderMap(sol) {
  if (!map || !sol) return;
  clearMapLayers();

  const nodes = DATA.nodes;
  const depot = nodes[0];
  const depLL = toLL(depot.x, depot.y);

  // Depot marker
  L.marker(depLL, { icon: depotIcon(), zIndexOffset: 1000 })
    .bindTooltip('<b style="color:#c084fc">DEPOT</b><br>Node 0', { sticky: true })
    .addTo(map);

  // Stop markers
  nodes.slice(1).forEach(nd => {
    const ll = toLL(nd.x, nd.y);
    const tight = (nd.due - nd.ready) < 45;
    const m = L.marker(ll, { icon: stopIcon(tight ? C.red : C.t2), zIndexOffset: 10 })
      .bindTooltip(
        `<b style="color:${C.sky}">Stop #${nd.id}</b><br>Demand: ${nd.demand}<br>TW: [${nd.ready}, ${nd.due}]<br>Service: ${nd.svc} min`,
        { sticky: true }
      );
    layersStops.push(m);
    if (layerCtrl.stops) m.addTo(map);

    // TW heatmap circle
    if (tight) {
      const c = L.circle(ll, { radius: 110, color: C.red, fillColor: C.red, fillOpacity: .22, weight: 0 });
      layersTW.push(c);
      if (layerCtrl.tw) c.addTo(map);
    }
  });

  // Routes
  sol.routes.forEach((route, ri) => {
    const color = ROUTE_COLORS[ri % ROUTE_COLORS.length];
    const pts = [depLL, ...route.nodes.map(id => toLL(nodes[id].x, nodes[id].y)), depLL];

    const pl = L.polyline(pts, {
      color, weight: 2.5, opacity: .75, dashArray: '8,5',
    }).bindPopup(
      `<b style="color:${color}">Vehicle ${route.id}</b><br>
       Stops: ${route.nodes.length}<br>
       Distance: ${route.dist.toFixed(1)}<br>
       Nodes: ${route.nodes.slice(0, 5).join(', ')}${route.nodes.length > 5 ? '…' : ''}`
    );
    layersRoutes.push(pl);
    if (layerCtrl.routes) pl.addTo(map);

    // Animated vehicle marker
    const vm = L.marker(pts[0], { icon: vehIcon(color, 0), zIndexOffset: 500 });
    if (layerCtrl.routes) vm.addTo(map);
    vehMarkers.push({ marker: vm, path: pts, t: ri / sol.routes.length * 0.8, speed: 0.0006 + Math.random() * 0.0003, color });
  });

  // Fit bounds
  if (layersRoutes.length) {
    const group = L.featureGroup(layersRoutes);
    map.fitBounds(group.getBounds(), { padding: [30, 30] });
  }

  startVehicleSim();
}

function renderMapStat(sol) {
  if (!sol) return;
  const c = sol.gap_pct <= 0 ? C.green : C.amber;
  document.getElementById('map-stat').innerHTML = `
    <div><span class="ms-k">NV</span><span class="ms-v" style="color:${C.sky}">${sol.nv}</span></div>
    <div><span class="ms-k">TD</span><span class="ms-v" style="color:${C.sky}">${sol.td.toFixed(1)}</span></div>
    <div><span class="ms-k">Gap</span><span class="ms-v" style="color:${c}">${sol.gap_pct > 0 ? '+' : ''}${sol.gap_pct.toFixed(2)}%</span></div>`;
}

// ── MAP LAYER CONTROLS ────────────────────────────────────────────────
document.querySelectorAll('.mc').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    const on = btn.classList.contains('active');
    const layer = btn.dataset.layer;
    layerCtrl[layer] = on;
    const arr = layer === 'routes' ? layersRoutes : layer === 'stops' ? layersStops : layersTW;
    arr.forEach(l => { try { on ? l.addTo(map) : l.remove(); } catch {} });
    // vehicles follow route toggle
    if (layer === 'routes') {
      vehMarkers.forEach(v => { try { on ? v.marker.addTo(map) : v.marker.remove(); } catch {} });
    }
  });
});

// ── VEHICLE ANIMATION ─────────────────────────────────────────────────
function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }

function interpPath(path, t) {
  if (!path || path.length < 2) return path?.[0] ?? [0, 0];
  const n = path.length - 1;
  const p = Math.max(0, Math.min(1, t)) * n;
  const s = Math.min(Math.floor(p), n - 1);
  return lerp(path[s], path[s + 1], p - s);
}

function bearing(a, b) {
  return Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI + 90;
}

function startVehicleSim() {
  if (simRaf) cancelAnimationFrame(simRaf);
  simLast = null;
  function frame(ts) {
    if (!simLast) simLast = ts;
    const dt = Math.min((ts - simLast) / 1000, 0.05);
    simLast = ts;
    vehMarkers.forEach(v => {
      v.t = (v.t + dt * v.speed * 60) % 1;
      const pos  = interpPath(v.path, v.t);
      const pos2 = interpPath(v.path, Math.min(v.t + 0.004, 0.999));
      try {
        v.marker.setLatLng(pos);
        v.marker.setIcon(vehIcon(v.color, bearing(pos, pos2)));
      } catch {}
    });
    simRaf = requestAnimationFrame(frame);
  }
  simRaf = requestAnimationFrame(frame);
}

// ── CANVAS HELPERS ────────────────────────────────────────────────────
function setupCanvas(id) {
  const c = document.getElementById(id);
  const box = c.parentElement;
  const w = Math.max(box.clientWidth - 16, 100);
  // height is css-driven; read it
  const h = Math.max(box.clientHeight - (id === 'conv-canvas' ? 46 : 16), 80);
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = C.bg3; ctx.fillRect(0, 0, w, h);
  return { c, ctx, W: w, H: h };
}

function drawGridLines(ctx, W, H, pad, minV, maxV, steps = 4) {
  ctx.save();
  ctx.strokeStyle = C.t4; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
  for (let i = 0; i <= steps; i++) {
    const y = pad.t + (H - pad.t - pad.b) * i / steps;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    const val = maxV - (maxV - minV) * i / steps;
    ctx.fillStyle = C.t3; ctx.font = '9px IBM Plex Mono,monospace'; ctx.textAlign = 'right';
    ctx.fillText(val.toFixed(0), pad.l - 3, y + 3);
  }
  ctx.setLineDash([]); ctx.restore();
}

// ── CONVERGENCE ───────────────────────────────────────────────────────
function renderConvergence(pct = 1) {
  const box = document.getElementById('conv-box');
  const c = document.getElementById('conv-canvas');
  const W = Math.max(box.clientWidth - 16, 100);
  const H = Math.max(box.clientHeight - 56, 70);
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = C.bg3; ctx.fillRect(0, 0, W, H);

  const series = [];
  if (DATA.alns?.history?.length > 2)    series.push({ h: DATA.alns.history,    color: C.amber, label: 'ALNS' });
  if (DATA.rl_alns?.history?.length > 2) series.push({ h: DATA.rl_alns.history, color: C.green, label: 'DDQN-ALNS' });
  if (!series.length) return;

  const allVals = series.flatMap(s => s.h);
  const minV = Math.min(...allVals) * 0.996;
  const maxV = Math.max(...allVals) * 1.003;
  const pad = { l: 48, r: 10, t: 14, b: 22 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;

  drawGridLines(ctx, W, H, pad, minV, maxV);

  series.forEach(({ h, color, label }) => {
    const cut = Math.max(2, Math.floor(h.length * pct));
    const step = Math.max(1, Math.floor(cut / 400));
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.6;
    for (let i = 0; i < cut; i += step) {
      const xi = pad.l + (i / (h.length - 1)) * cW;
      const yi = pad.t + cH - ((h[i] - minV) / (maxV - minV)) * cH;
      i === 0 ? ctx.moveTo(xi, yi) : ctx.lineTo(xi, yi);
    }
    ctx.stroke();

    // endpoint dot
    const li = cut - 1;
    const lx = pad.l + (li / (h.length - 1)) * cW;
    const ly = pad.t + cH - ((h[li] - minV) / (maxV - minV)) * cH;
    ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();

    // label
    ctx.fillStyle = color; ctx.font = '9px IBM Plex Mono,monospace'; ctx.textAlign = 'left';
  });

  // BKS line
  const bks = DATA.rl_alns?.bks_td ?? DATA.alns?.bks_td;
  if (bks) {
    const y = pad.t + cH - ((bks - minV) / (maxV - minV)) * cH;
    ctx.save(); ctx.strokeStyle = 'rgba(192,132,252,.45)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = C.purple; ctx.font = '8px IBM Plex Mono,monospace'; ctx.textAlign = 'left';
    ctx.fillText('BKS', pad.l + 4, y - 3);
  }

  // Legend
  series.forEach(({ color, label }, i) => {
    ctx.fillStyle = color; ctx.fillRect(pad.l + i * 80, 2, 7, 7);
    ctx.fillStyle = C.t2; ctx.font = '9px IBM Plex Mono,monospace'; ctx.textAlign = 'left';
    ctx.fillText(label, pad.l + i * 80 + 9, 9);
  });

  ctx.fillStyle = C.t3; ctx.font = '9px IBM Plex Mono,monospace'; ctx.textAlign = 'center';
  ctx.fillText('iterations →', pad.l + cW / 2, H - 4);
}

// Replay
const rbPlay  = document.getElementById('rb-play');
const rbFill  = document.getElementById('rb-fill');
const rbPct   = document.getElementById('rb-pct');
const rbTrack = document.getElementById('rb-track');

rbPlay.addEventListener('click', () => {
  replayPlaying = !replayPlaying;
  rbPlay.textContent = replayPlaying ? '⏸' : '▶';
  rbPlay.classList.toggle('playing', replayPlaying);
  if (replayPlaying) stepReplay();
});

function stepReplay() {
  if (!replayPlaying) return;
  replayT = Math.min(replayT + 0.0025, 1);
  renderConvergence(replayT);
  rbFill.style.width = (replayT * 100) + '%';
  rbPct.textContent = Math.round(replayT * 100) + '%';
  if (replayT >= 1) {
    replayPlaying = false; rbPlay.textContent = '▶'; rbPlay.classList.remove('playing'); return;
  }
  replayRaf = requestAnimationFrame(stepReplay);
}

rbTrack.addEventListener('click', e => {
  const rect = rbTrack.getBoundingClientRect();
  replayT = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  rbFill.style.width = (replayT * 100) + '%';
  rbPct.textContent = Math.round(replayT * 100) + '%';
  renderConvergence(replayT);
});

// ── OPERATOR HEATMAP ──────────────────────────────────────────────────
function renderHeatmap() {
  if (!DATA.op_matrix) return;
  const mat = DATA.op_matrix;
  const dOps = DATA.destroy_ops ?? ['Random','Worst','Shaw','Route','TW-Urgent'];
  const rOps = DATA.repair_ops  ?? ['Greedy','Regret-2','Regret-3','TW-Greedy'];

  const box = document.getElementById('heat-box');
  const c   = document.getElementById('heat-canvas');
  const W   = Math.max(box.clientWidth - 16, 100);
  const H   = Math.max(W * 0.55, 80);
  c.width = W; c.height = H;
  box.style.height = H + 16 + 'px';
  const ctx = c.getContext('2d');
  ctx.fillStyle = C.bg3; ctx.fillRect(0, 0, W, H);

  const flat = mat.flat();
  const maxV = Math.max(...flat) || 1;
  const pad = { l: 64, r: 8, t: 18, b: 28 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  const cellW = cW / rOps.length, cellH = cH / dOps.length;

  mat.forEach((row, di) => row.forEach((val, ri) => {
    const t = val / maxV;
    // Sky → amber gradient based on intensity
    const r_ = Math.round(56  + (251 - 56)  * t);
    const g_ = Math.round(189 + (191 - 189) * t * 0.3);
    const b_ = Math.round(248 + (36  - 248) * t);
    ctx.fillStyle = `rgba(${r_},${g_},${b_},${0.1 + t * 0.85})`;
    ctx.fillRect(pad.l + ri * cellW + 1, pad.t + di * cellH + 1, cellW - 2, cellH - 2);

    if (val > 0) {
      ctx.fillStyle = t > 0.6 ? C.bg : C.t1;
      ctx.font = `${Math.max(8, Math.min(11, cellW * 0.3))}px IBM Plex Mono,monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(val, pad.l + ri * cellW + cellW / 2, pad.t + di * cellH + cellH / 2 + 3);
    }
  }));

  ctx.fillStyle = C.t3; ctx.font = '8px IBM Plex Mono,monospace'; ctx.textAlign = 'center';
  rOps.forEach((op, i) => ctx.fillText(op.slice(0, 8), pad.l + i * cellW + cellW / 2, pad.t - 5));
  ctx.textAlign = 'right';
  dOps.forEach((op, i) => ctx.fillText(op.slice(0, 9), pad.l - 3, pad.t + i * cellH + cellH / 2 + 3));
}

// ── GAP CHART ─────────────────────────────────────────────────────────
function renderGapChart() {
  if (!DATA.summary?.length) return;

  const summary = DATA.summary;
  const algos = ['ALNS', 'DDQN-ALNS'];
  const colors = { 'ALNS': C.amber, 'DDQN-ALNS': C.green };
  const insts  = [...new Set(summary.map(r => r.instance))].sort();

  const box = document.getElementById('gap-box');
  const c   = document.getElementById('gap-canvas');
  const W   = Math.max(box.clientWidth - 16, 100);
  const H   = 110;
  c.width = W; c.height = H;
  box.style.height = H + 16 + 'px';
  const ctx = c.getContext('2d');
  ctx.fillStyle = C.bg3; ctx.fillRect(0, 0, W, H);

  const gaps = summary.map(r => parseFloat(r.gap_pct)).filter(v => !isNaN(v));
  const maxG = Math.max(...gaps, 0), minG = Math.min(...gaps, 0);
  const range = maxG - minG || 1;
  const pad = { l: 28, r: 8, t: 16, b: 26 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  const zeroY = pad.t + cH * (maxG / range);

  // zero line
  ctx.save(); ctx.strokeStyle = C.t4; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
  ctx.beginPath(); ctx.moveTo(pad.l, zeroY); ctx.lineTo(W - pad.r, zeroY); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = C.t3; ctx.font = '8px IBM Plex Mono,monospace'; ctx.textAlign = 'right';
  ctx.fillText('0%', pad.l - 2, zeroY + 3);

  const bw = cW / insts.length;
  insts.forEach((inst, ii) => {
    algos.forEach((algo, ai) => {
      const row = summary.find(r => r.instance === inst && r.algo === algo);
      if (!row) return;
      const g = parseFloat(row.gap_pct);
      const bH = Math.max(Math.abs(g) / range * cH, 1);
      const y  = g >= 0 ? zeroY : zeroY - bH;
      ctx.fillStyle = (colors[algo] ?? C.sky) + 'bb';
      ctx.fillRect(pad.l + ii * bw + ai * (bw / 2 - 1) + 1, y, bw / 2 - 2, bH);
    });
    ctx.fillStyle = C.t3; ctx.font = '7px IBM Plex Mono,monospace'; ctx.textAlign = 'center';
    const shortLabel = inst.replace('RC', '').replace(/^0/, '');
    ctx.fillText(shortLabel, pad.l + ii * bw + bw / 2, H - 5);
  });

  // Legend
  algos.forEach((a, i) => {
    ctx.fillStyle = colors[a]; ctx.fillRect(pad.l + i * 70, 3, 6, 6);
    ctx.fillStyle = C.t2; ctx.font = '8px IBM Plex Mono,monospace'; ctx.textAlign = 'left';
    ctx.fillText(a === 'DDQN-ALNS' ? 'DDQN' : a, pad.l + i * 70 + 8, 10);
  });
}

// ── TRANSFER ──────────────────────────────────────────────────────────
function renderTransfer() {
  const el = document.getElementById('transfer-panel');
  const rows = DATA.transfer;
  if (!rows?.length) {
    el.innerHTML = '<span style="color:var(--t3);font-size:10px">No transfer data in this JSON</span>';
    return;
  }

  const avg = rows.reduce((s, r) => s + r.gap_pct, 0) / rows.length;
  const wins = rows.filter(r => r.gap_pct < 0).length;

  el.innerHTML = rows.map(r => {
    const c = r.gap_pct < 0 ? C.green : r.gap_pct < 6 ? C.amber : C.red;
    const w = Math.min(Math.abs(r.gap_pct) / 12 * 100, 100).toFixed(0);
    return `<div class="tr-row">
      <span class="tr-inst">${r.instance}</span>
      <div class="tr-bar-wrap"><div class="tr-bar" style="width:${w}%;background:${c}"></div></div>
      <span class="tr-val" style="color:${c}">${r.gap_pct > 0 ? '+' : ''}${r.gap_pct.toFixed(2)}%</span>
    </div>`;
  }).join('') + `
    <div class="tr-footer">
      Avg: <strong style="color:${avg<0?C.green:C.amber}">${avg>0?'+':''}${avg.toFixed(2)}%</strong>
      &nbsp;·&nbsp;
      <span style="color:${C.green}">${wins}/${rows.length}</span> beat ALNS baseline
    </div>`;
}

// ── SUMMARY TABLE ─────────────────────────────────────────────────────
function renderSummary() {
  const rows = DATA.summary;
  if (!rows?.length) return;

  const algoColor = { 'ALNS': C.amber, 'DDQN-ALNS': C.green };

  const html = `<table class="sum-table">
    <tr>
      <th>Instance</th><th>Algo</th><th>NV</th><th>Gap%</th><th>CV%</th><th>Time(s)</th>
    </tr>` +
    rows.map(r => {
      const c = algoColor[r.algo] ?? C.sky;
      const gap = parseFloat(r.gap_pct);
      const badgeCls = gap <= 0 ? 'badge-g' : gap < 5 ? 'badge-a' : 'badge-r';
      return `<tr>
        <td style="color:${C.t2}">${r.instance}</td>
        <td><span style="color:${c};font-weight:600">${r.algo}</span></td>
        <td>${r.nv}</td>
        <td><span class="badge ${badgeCls}">${gap>0?'+':''}${gap.toFixed(2)}%</span></td>
        <td style="color:${C.sky}">${r.cv_nv?.toFixed(1) ?? '—'}%</td>
        <td style="color:${C.t3}">${r.time_s?.toFixed(0) ?? '—'}</td>
      </tr>`;
    }).join('') +
    '</table>';

  document.getElementById('summary-wrap').innerHTML = html;
}

// ── RESIZE ────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  if (!DATA) return;
  renderConvergence(replayT || 1);
  renderHeatmap();
  renderGapChart();
  map?.invalidateSize();
});
