/* 남한강 에스파크 라운딩 – single-page app (no build step). */
(() => {
'use strict';
const C = window.COURSE;
const $ = (id) => document.getElementById(id);
const HOLES = {}; C.holes.forEach(h => HOLES[h.id] = h);
const COURSE_IDS = ['P', 'A', 'K'];
const BG = {
  P: 'https://nhg.s-parkcc.kr/images/contents/course_info_img01.jpg',
  A: 'https://nhg.s-parkcc.kr/images/contents/course_info_img02.jpg',
  K: 'https://nhg.s-parkcc.kr/images/contents/course_info_img03.jpg',
};
const TEE_NAMES = { black: '블랙', blue: '블루', white: '화이트', yellow: '옐로', red: '레드' };
const TEE_ORDER = ['black', 'blue', 'white', 'yellow', 'red'];
const DEFAULT_CLUBS = [
  ['드라이버', 200, 220], ['유틸', 170, 180], ['4번', 160, 170], ['5번', 150, 160], ['6번', 140, 150],
  ['7번', 130, 140], ['8번', 120, 130], ['9번', 110, 120], ['P', 90, 110], ['A', 70, 90], ['S', 0, 70],
].map(([n, min, max]) => ({ n, min, max }));
const SIM = /[?&]sim=1/.test(location.search);

/* ---------------- storage ---------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('spk.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('spk.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem('spk.' + k); } catch (e) { /* ignore */ } },
};
let clubs = store.get('clubs', null);
let prefs = Object.assign({ tee: 'white', wake: false }, store.get('prefs', {}));
let fixes = store.get('greenFix', {});     // per-hole learned green center {id:[lat,lon]}
let round = store.get('round', null);

function saveRound() { store.set('round', round); }
function savePrefs() { store.set('prefs', prefs); }

/* ---------------- geometry ---------------- */
const RAD = Math.PI / 180;
function mLat(lat) { const p = lat * RAD; return 111132.954 - 559.822 * Math.cos(2 * p) + 1.175 * Math.cos(4 * p); }
function mLon(lat) { const p = lat * RAD; return 111412.84 * Math.cos(p) - 93.5 * Math.cos(3 * p) + 0.118 * Math.cos(5 * p); }
const ML = mLat(37.204), MO = mLon(37.204);
// "screen ENU": x = east (m), y = south (m) relative to origin
function xy(ll, o) { return { x: (ll[1] - o[1]) * MO, y: -(ll[0] - o[0]) * ML }; }
function ll(p, o) { return [o[0] - p.y / ML, o[1] + p.x / MO]; }
function distLL(a, b) { const d = xy(a, b); return Math.hypot(d.x, d.y); }
const len = (v) => Math.hypot(v.x, v.y);
const rot = (v, t) => ({ x: v.x * Math.cos(t) - v.y * Math.sin(t), y: v.x * Math.sin(t) + v.y * Math.cos(t) });

/* Each hole maps real positions onto its illustration with a radial (polar) mapping around the green:
   bearing relative to the green→tee axis is kept, distance is mapped through a piecewise-linear
   function fitted to the illustration's own 100/150/200 m arcs and the back-tee marker. */
function prepHole(h) {
  if (h._p) return h._p;
  const G = fixes[h.id] || h.G;
  const tv = xy(h.T, G); const a = { x: tv.x / len(tv), y: tv.y / len(tv) };
  const bv = { x: h.it[0] - h.ig[0], y: h.it[1] - h.ig[1] }; const rt = len(bv);
  const b = { x: bv.x / rt, y: bv.y / rt };
  const kd = [0], kr = [0];
  const marks = [100, 150, 200];
  h.arcs.forEach((r, i) => { if (r < rt) { kd.push(marks[i]); kr.push(r); } });
  const Dt = Math.max(h.tees.black, kd[kd.length - 1] + 30);
  kd.push(Dt); kr.push(rt);
  const p = { G, a, b, kd, kr, rt, Dt };
  p.f = (d) => interp(d, kd, kr);
  p.fi = (r) => interp(r, kr, kd);
  p.slope = (d) => { // px per meter at distance d
    let i = 1; while (i < kd.length - 1 && d > kd[i]) i++;
    return (kr[i] - kr[i - 1]) / (kd[i] - kd[i - 1]);
  };
  p.toImg = (lat, lon) => {
    const r = xy([lat, lon], G); const d = len(r);
    if (d < 1e-6) return { x: h.ig[0], y: h.ig[1], d: 0 };
    const th = Math.atan2(a.x * r.y - a.y * r.x, a.x * r.x + a.y * r.y);
    const R = p.f(d); const dir = rot(b, th);
    return { x: h.ig[0] + dir.x * R, y: h.ig[1] + dir.y * R, d };
  };
  p.fromImg = (px, py) => {
    const v = { x: px - h.ig[0], y: py - h.ig[1] }; const R = len(v);
    if (R < 1e-6) return G.slice();
    const th = Math.atan2(b.x * v.y - b.y * v.x, b.x * v.x + b.y * v.y);
    const d = p.fi(R); const r = rot(a, th);
    return ll({ x: r.x * d, y: r.y * d }, G);
  };
  // fairway centre line (tee → green) in real metres relative to G
  p.cl = h.cl.map(q => xy(p.fromImg(q[0], q[1]), G));
  const s0 = 1 / p.slope(5);
  p.front = h.gf * s0; p.back = h.gb * s0;
  h._p = p; return p;
}
function interp(x, xs, ys) {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  const n = xs.length - 1; const s = (ys[n] - ys[n - 1]) / (xs[n] - xs[n - 1]);
  return ys[n] + s * (x - xs[n]);
}

/* ---------------- GPS (filtered) ---------------- */
const ORIGIN = [37.204, 127.785];
const gps = { st: null, raw: null, err: null, sim: null };
function onFix(pos) {
  const c = pos.coords; const t = pos.timestamp || Date.now();
  gps.raw = { lat: c.latitude, lon: c.longitude, acc: c.accuracy, t, speed: c.speed };
  gps.err = null;
  const z = xy([c.latitude, c.longitude], ORIGIN); const R = Math.max(c.accuracy, 2) ** 2;
  const s = gps.st;
  if (!s || t - s.t > 30000 || c.accuracy > 80 && s.P < 400) {
    if (!s || t - s.t > 30000) gps.st = { x: z.x, y: z.y, P: R, t };
  } else {
    const dt = Math.max(0.2, (t - s.t) / 1000);
    const sp = (c.speed != null && c.speed >= 0) ? c.speed : null;
    const q = sp == null ? 1.2 : Math.max(0.04, sp * sp);
    let P = s.P + q * dt;
    const innov = Math.hypot(z.x - s.x, z.y - s.y);
    if (innov > 3 * Math.sqrt(P + R) + 12) { gps.st = { x: z.x, y: z.y, P: R, t }; }
    else {
      const K = P / (P + R);
      gps.st = { x: s.x + K * (z.x - s.x), y: s.y + K * (z.y - s.y), P: (1 - K) * P, t };
    }
  }
  render();
  if (pendingShot) tryPendingShot();
}
function onGpsErr(e) { gps.err = e; renderGps(); }
function startGps() {
  if (SIM || !('geolocation' in navigator)) { renderGps(); return; }
  navigator.geolocation.watchPosition(onFix, onGpsErr, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
}
function myPos() {
  if (gps.sim) return { lat: gps.sim[0], lon: gps.sim[1], acc: 3, fresh: true };
  if (!gps.st) return null;
  const p = ll({ x: gps.st.x, y: gps.st.y }, ORIGIN);
  const age = Date.now() - gps.raw.t;
  return { lat: p[0], lon: p[1], acc: Math.sqrt(gps.st.P), raw: gps.raw.acc, fresh: age < 4000, age };
}

/* ---------------- clubs ---------------- */
function clubList() { return (clubs || DEFAULT_CLUBS).filter(c => c.n && c.max > 0); }
function pickClub(D, allowDriver) {
  if (D <= 8) return { n: '퍼터', min: 0, max: 0, putter: true };
  let cs = clubList(); const longest = cs.reduce((m, c) => c.max > m.max ? c : m, cs[0]);
  if (!allowDriver) { const nd = cs.filter(c => c !== longest); if (nd.length) cs = nd; }
  let best = null, bs = 1e9;
  cs.forEach(c => {
    const out = D < c.min ? c.min - D : D > c.max ? D - c.max : 0;
    const sc = out * 10 + Math.abs(D - (c.min + c.max) / 2);
    if (sc < bs) { bs = sc; best = c; }
  });
  return best;
}
function longClub(allowDriver, cap) {
  let cs = clubList().slice().sort((a, b) => b.max - a.max);
  if (!allowDriver) cs = cs.slice(1);
  if (cap) { const ok = cs.filter(c => (c.min + c.max) / 2 <= cap); if (ok.length) cs = ok; }
  return cs[0];
}
const mid = (c) => (c.min + c.max) / 2;
const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* Plan the remaining shots along the fairway centre line: long clubs until the green is in reach. */
function plan(h, startXY, isTee) {
  const p = prepHole(h); const hops = []; let cur = startXY;
  const reach = longClub(false).max;
  for (let i = 0; i < 4; i++) {
    const D = len(cur);
    if (D <= reach || (h.par === 3 && i === 0 && isTee)) {
      const c = pickClub(D, isTee && i === 0 && D > reach);
      hops.push({ to: { x: 0, y: 0 }, club: c, d: D, final: true });
      break;
    }
    const drv = isTee && i === 0 && h.par >= 4;
    const c = longClub(drv, drv ? h.teeMax : null);
    const carry = mid(c);
    const tgt = alongCL(p.cl, cur, carry);
    if (!tgt || len(tgt) >= D - 5) { hops.push({ to: { x: 0, y: 0 }, club: pickClub(D, drv), d: D, final: true }); break; }
    hops.push({ to: tgt, club: c, d: Math.hypot(tgt.x - cur.x, tgt.y - cur.y) });
    cur = tgt;
  }
  return hops;
}
function alongCL(cl, cur, carry) {
  // project cur onto polyline, then walk forward until straight-line distance from cur >= carry
  let bi = 0, bt = 0, bd = 1e9;
  for (let i = 0; i < cl.length - 1; i++) {
    const A = cl[i], B = cl[i + 1]; const vx = B.x - A.x, vy = B.y - A.y; const L2 = vx * vx + vy * vy || 1;
    let t = ((cur.x - A.x) * vx + (cur.y - A.y) * vy) / L2; t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(A.x + vx * t - cur.x, A.y + vy * t - cur.y);
    if (d < bd) { bd = d; bi = i; bt = t; }
  }
  let prev = { x: cl[bi].x + (cl[bi + 1].x - cl[bi].x) * bt, y: cl[bi].y + (cl[bi + 1].y - cl[bi].y) * bt };
  for (let i = bi; i < cl.length - 1; i++) {
    const A = i === bi ? prev : cl[i], B = cl[i + 1];
    if (Math.hypot(B.x - cur.x, B.y - cur.y) >= carry) {
      // solve |A + t(B-A) - cur| = carry
      const dx = B.x - A.x, dy = B.y - A.y, fx = A.x - cur.x, fy = A.y - cur.y;
      const qa = dx * dx + dy * dy, qb = 2 * (fx * dx + fy * dy), qc = fx * fx + fy * fy - carry * carry;
      const disc = Math.max(0, qb * qb - 4 * qa * qc); const t = (-qb + Math.sqrt(disc)) / (2 * qa);
      const tt = Math.max(0, Math.min(1, t));
      return { x: A.x + dx * tt, y: A.y + dy * tt };
    }
  }
  return null;
}

/* ---------------- round state ---------------- */
function newRound(start) {
  round = { start, back: null, cur: start + '1', holes: {}, t: Date.now() };
  saveRound();
}
function hs(id) {
  if (!round.holes[id]) round.holes[id] = { shots: [], n: 0, putts: 0, done: null, pin: null };
  return round.holes[id];
}
function strokes(s) { return s.n + s.putts + (s.done === 'ok' ? 1 : 0); }
function order() {
  const o = []; for (let i = 1; i <= 9; i++) o.push(round.start + i);
  if (round.back) for (let i = 1; i <= 9; i++) o.push(round.back + i);
  return o;
}
function totals() {
  let st = 0, par = 0, n = 0;
  Object.keys(round.holes).forEach(id => { const s = round.holes[id]; if (s.done) { st += strokes(s); par += HOLES[id].par; n++; } });
  return { st, par, n, diff: st - par };
}
const fmtDiff = (d) => d === 0 ? 'E' : (d > 0 ? '+' + d : '' + d);
function scoreName(st, par) {
  if (st === 1) return '홀인원';
  const d = st - par;
  if (st >= par * 2) return '더블파';
  return ({ '-3': '알바트로스', '-2': '이글', '-1': '버디', '0': '파', '1': '보기', '2': '더블보기', '3': '트리플보기', '4': '쿼드러플' })[d] || (d > 0 ? '+' + d : d);
}
const scoreCls = (d) => d <= -2 ? 's-m2' : d === -1 ? 's-m1' : d === 0 ? 's-0' : d === 1 ? 's-p1' : 's-p2';

/* ---------------- UI: screens ---------------- */
function show(id) {
  ['start', 'setup', 'play'].forEach(s => $(s).hidden = s !== id);
  $('sheet').hidden = id !== 'play';
  if (id === 'play') wake(); else releaseWake();
}
function toast(msg, ms = 1800) {
  const t = $('toast'); t.textContent = msg; t.style.opacity = 1;
  clearTimeout(toast._t); toast._t = setTimeout(() => t.style.opacity = 0, ms);
}
function buzz() { try { navigator.vibrate && navigator.vibrate(25); } catch (e) { /* ignore */ } }

let startPick = 'P';
function renderStart() {
  const live = round && Object.keys(round.holes).length && !round.finished;
  if (live) startPick = round.start;
  $('startBg').style.backgroundImage = `url("${BG[startPick]}")`;
  const ch = $('startCourse'); ch.innerHTML = '';
  COURSE_IDS.forEach(c => {
    const b = document.createElement('button'); b.className = 'chip'; b.textContent = C.courses[c] + ' 출발';
    b.setAttribute('aria-pressed', String(c === startPick)); b.disabled = !!live;
    b.onclick = () => { startPick = c; renderStart(); };
    ch.appendChild(b);
  });
  ch.hidden = !!live;
  const btns = $('startBtns'); btns.innerHTML = '';
  if (live) {
    const t = totals();
    $('startSub').textContent = `진행 중 라운드 · ${label(round.cur)} · ${t.n}홀 ${fmtDiff(t.diff)}`;
    const a = document.createElement('button'); a.className = 'btn-main'; a.textContent = '이어서 하기';
    a.onclick = () => { show('play'); renderPlay(); };
    const b = document.createElement('button'); b.className = 'btn-ghost'; b.textContent = '새 라운드 시작';
    b.onclick = () => confirmBox('새 라운드를 시작할까요?', '지금까지 기록한 스코어가 지워집니다.', '새로 시작', () => { newRound(startPick); renderStart(); });
    btns.append(a, b);
  } else {
    $('startSub').textContent = `${C.courses[startPick]} 코스 1번홀부터 시작합니다`;
    const a = document.createElement('button'); a.className = 'btn-main'; a.textContent = '티업 시작';
    a.onclick = () => { newRound(startPick); show('play'); renderPlay(); };
    btns.append(a);
  }
}
function label(id) { const h = HOLES[id]; return `${C.courses[h.c]} ${h.n}번`; }

/* ---------------- UI: setup ---------------- */
function renderSetup(fromStart) {
  const list = $('clubList'); list.innerHTML = '';
  const cs = (clubs || DEFAULT_CLUBS).map(c => ({ ...c }));
  const draw = () => {
    list.innerHTML = '';
    cs.forEach((c, i) => {
      const row = document.createElement('div'); row.className = 'club';
      row.innerHTML = `<input class="name" id="cn${i}" value="" aria-label="클럽 이름"><input id="cmin${i}" inputmode="numeric" aria-label="최소 거리"><span class="dash">–</span><input id="cmax${i}" inputmode="numeric" aria-label="최대 거리"><button class="del" aria-label="삭제">×</button>`;
      row.querySelector('.name').value = c.n;
      row.querySelector('#cmin' + i).value = c.min;
      row.querySelector('#cmax' + i).value = c.max;
      row.querySelector('.name').oninput = (e) => c.n = e.target.value.trim();
      row.querySelector('#cmin' + i).oninput = (e) => c.min = +e.target.value || 0;
      row.querySelector('#cmax' + i).oninput = (e) => c.max = +e.target.value || 0;
      row.querySelector('.del').onclick = () => { cs.splice(i, 1); draw(); };
      list.appendChild(row);
    });
  };
  draw();
  $('addClub').onclick = () => { cs.push({ n: '', min: 0, max: 0 }); draw(); const last = list.querySelector('.club:last-child .name'); last && last.focus(); };
  $('saveClubs').onclick = () => {
    const ok = cs.filter(c => c.n && c.max > 0).map(c => ({ n: c.n, min: Math.min(c.min, c.max), max: Math.max(c.min, c.max) }));
    if (!ok.length) { toast('클럽을 하나 이상 입력해 주세요'); return; }
    clubs = ok; store.set('clubs', clubs); toast('저장했습니다');
    if (round && !$('play').hidden) { show('play'); renderPlay(); }
    else if (fromStart === 'play') { show('play'); renderPlay(); }
    else { show('start'); renderStart(); }
  };
  show('setup');
}

/* ---------------- UI: play ---------------- */
let H = null; // current hole
const NS = 'http://www.w3.org/2000/svg';
function renderPlay() {
  H = HOLES[round.cur]; prepHole(H);
  const img = $('holeImg');
  if (img.dataset.src !== H.img) { img.src = H.img; img.dataset.src = H.img; }
  $('ov').setAttribute('viewBox', `0 0 ${H.w} ${H.h}`);
  $('hNo').textContent = `${H.c}${H.n}`;
  $('hMeta').textContent = `${C.courses[H.c]} ${H.n}번 · PAR ${H.par} · ${TEE_NAMES[prefs.tee]} ${H.tees[prefs.tee]}m`;
  $('estBadge').hidden = H.conf !== 'low' || !!fixes[H.id];
  $('gthumbImg').src = H.gimg;
  renderSheet();
  render();
}
function render() {
  if (!round || $('play').hidden || !H) { renderGps(); return; }
  const p = prepHole(H); const s = hs(H.id);
  renderGps();
  const me = myPos();
  const target = s.pin ? s.pin : p.G;
  let meXY = null, dist = null, onImg = null;
  if (me) {
    meXY = xy([me.lat, me.lon], p.G);
    dist = distLL([me.lat, me.lon], target);
    onImg = p.toImg(me.lat, me.lon);
  }
  // numbers
  $('distLbl').textContent = s.pin ? ({ F: '핀까지 · 앞핀', C: '핀까지 · 중핀', B: '핀까지 · 뒷핀' }[s.pinMode] || '핀까지 · 지정') : '그린 중앙';
  [...$('pinSeg').children].forEach(b => b.setAttribute('aria-pressed', String(s.pinMode === b.dataset.m)));
  if (dist != null && dist < 2500) {
    $('distBig').innerHTML = `${Math.round(dist)}<small>m</small>`;
    const dc = distLL([me.lat, me.lon], p.G);
    $('fb').innerHTML = `<span>앞 <b>${Math.max(0, Math.round(dc - p.front))}</b></span><span>뒤 <b>${Math.round(dc + p.back)}</b></span>`;
  } else {
    $('distBig').innerHTML = `—<small>m</small>`; $('fb').innerHTML = '';
  }
  // plan
  const isTee = s.n === 0;
  let hops = [];
  if (meXY && dist < 700) {
    hops = plan(H, meXY, isTee);
    const fin = hops[hops.length - 1];
    if (s.pin && fin && fin.final) {
      const prev = hops.length > 1 ? ll(hops[hops.length - 2].to, p.G) : [me.lat, me.lon];
      fin.d = distLL(prev, s.pin); fin.club = pickClub(fin.d, isTee && hops.length === 1 && fin.d > longClub(false).max);
    }
  } else {
    hops = plan(H, xy(H.T, p.G), true);
  }
  const first = hops[0];
  if (first && me && dist != null && distLL([me.lat, me.lon], p.G) <= Math.max(p.front, p.back) + 2) first.club = { n: '퍼터', putter: true };
  if (first) {
    $('clubRec').textContent = first.club ? first.club.n : '—';
    $('clubRange').textContent = first.club && !first.club.putter ? `${first.club.min}–${first.club.max}m` : '';
  }
  $('plan').innerHTML = hops.length > 1 ? hops.map((hp, i) => `<div class="step"><span>${i + 1}. <b>${esc(hp.club.n)}</b></span><span>${Math.round(hp.d)}m</span></div>`).join('') : '';
  // last shot distance
  const sh = s.shots;
  if (sh.length) {
    const lastP = sh[sh.length - 1];
    const ref = sh.length >= 2 ? sh[sh.length - 2] : null;
    let txt = '';
    if (me && distLL([me.lat, me.lon], [lastP.lat, lastP.lon]) > 8) txt = `직전 샷 <b>${Math.round(distLL([me.lat, me.lon], [lastP.lat, lastP.lon]))}m</b> 보냄`;
    else if (ref) txt = `${sh.length - 1}번째 샷 <b>${Math.round(distLL([ref.lat, ref.lon], [lastP.lat, lastP.lon]))}m</b>`;
    $('lastShot').innerHTML = txt;
  } else $('lastShot').innerHTML = '';
  $('gthumb').hidden = !(dist != null && dist < 90);
  // counters
  $('shotN').textContent = s.n; $('puttN').textContent = s.putts;
  const st = strokes(s);
  $('curStroke').innerHTML = st ? `현재 <b>${st}</b>타` : `PAR ${H.par}`;
  const t = totals(); $('scoreBadge').textContent = t.n ? fmtDiff(t.diff) : 'E';
  // overlay
  drawOverlay(p, s, me, onImg, hops, meXY);
  // off-course message
  const off = $('offMsg');
  const inside = onImg && onImg.x > -20 && onImg.x < H.w + 20 && onImg.y > -20 && onImg.y < H.h + 20;
  if (me && !inside) { off.hidden = false; off.textContent = dist > 2000 ? `코스 밖 · ${(dist / 1000).toFixed(1)}km` : `이 홀 밖 · 그린까지 ${Math.round(dist)}m`; }
  else if (!me) { off.hidden = false; off.textContent = SIM ? '지도를 눌러 위치를 정하세요 (시뮬레이션)' : '위치 확인 중…'; }
  else off.hidden = true;
}
function renderGps() {
  const b = $('gpsBadge'); const me = myPos();
  b.className = 'badge num';
  if (SIM) { b.textContent = 'SIM'; b.classList.add('gps-mid'); return; }
  if (gps.err && !me) { b.textContent = gps.err.code === 1 ? '위치 권한 필요' : 'GPS 오류'; b.classList.add('gps-bad'); return; }
  if (!me) { b.textContent = 'GPS …'; return; }
  const a = Math.round(me.acc);
  b.textContent = me.fresh ? `GPS ±${a}m` : `GPS ±${a}m · ${Math.round(me.age / 1000)}s`;
  b.classList.add(!me.fresh ? 'gps-mid' : a <= 6 ? 'gps-good' : a <= 15 ? 'gps-mid' : 'gps-bad');
}
function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent && parent.appendChild(e); return e; }
function drawOverlay(p, s, me, onImg, hops, meXY) {
  const svg = $('ov'); svg.innerHTML = '';
  const sc = H.h / 900; // stroke scale
  // planned route
  if (hops.length) {
    let pts = [];
    const start = meXY && onImg && me ? onImg : p.toImg(H.T[0], H.T[1]);
    pts.push(start);
    hops.forEach(hp => { const q = ll(hp.to, p.G); pts.push(hp.final && s.pin ? p.toImg(s.pin[0], s.pin[1]) : p.toImg(q[0], q[1])); });
    el('polyline', { points: pts.map(q => `${q.x},${q.y}`).join(' '), fill: 'none', stroke: 'rgba(255,255,255,.95)', 'stroke-width': 2.4 * sc, 'stroke-dasharray': `${7 * sc} ${6 * sc}`, 'stroke-linecap': 'round' }, svg);
    hops.forEach((hp, i) => {
      if (hp.final) return;
      const q = pts[i + 1];
      el('circle', { cx: q.x, cy: q.y, r: 7 * sc, fill: '#0b1310', stroke: '#ffcf5c', 'stroke-width': 2.4 * sc }, svg);
      const tx = el('text', { x: q.x + 11 * sc, y: q.y + 4 * sc, fill: '#fff', 'font-size': 15 * sc, 'font-weight': 800, 'paint-order': 'stroke', stroke: 'rgba(0,0,0,.75)', 'stroke-width': 3.5 * sc, 'font-family': 'inherit' }, svg);
      tx.textContent = `${hp.club.n} ${Math.round(hp.d)}`;
    });
  }
  // recorded shots
  if (s.shots.length) {
    const sp = s.shots.map(q => p.toImg(q.lat, q.lon));
    if (sp.length > 1) el('polyline', { points: sp.map(q => `${q.x},${q.y}`).join(' '), fill: 'none', stroke: '#ffcf5c', 'stroke-width': 2 * sc, opacity: .9 }, svg);
    sp.forEach((q, i) => {
      el('circle', { cx: q.x, cy: q.y, r: 9 * sc, fill: '#ffcf5c', stroke: '#0b1310', 'stroke-width': 2 * sc }, svg);
      const t = el('text', { x: q.x, y: q.y + 4.2 * sc, 'text-anchor': 'middle', fill: '#0b1310', 'font-size': 12 * sc, 'font-weight': 900, 'font-family': 'inherit' }, svg);
      t.textContent = i + 1;
    });
  }
  // pin
  if (s.pin) {
    const q = p.toImg(s.pin[0], s.pin[1]);
    el('line', { x1: q.x, y1: q.y, x2: q.x, y2: q.y - 30 * sc, stroke: '#fff', 'stroke-width': 2.4 * sc }, svg);
    el('path', { d: `M${q.x} ${q.y - 30 * sc} l${18 * sc} ${6 * sc} l${-18 * sc} ${6 * sc}z`, fill: '#ff5a4f' }, svg);
    el('circle', { cx: q.x, cy: q.y, r: 3 * sc, fill: '#fff' }, svg);
  }
  // me
  if (me && onImg) {
    const acc = Math.min(me.acc, 40) * p.slope(onImg.d);
    el('circle', { cx: onImg.x, cy: onImg.y, r: Math.max(acc, 8 * sc), fill: 'rgba(74,168,255,.18)', stroke: 'rgba(74,168,255,.5)', 'stroke-width': 1 * sc }, svg);
    el('circle', { cx: onImg.x, cy: onImg.y, r: 8 * sc, fill: '#4aa8ff', stroke: '#fff', 'stroke-width': 3 * sc }, svg);
  }
}

/* ---------------- shots ---------------- */
let pendingShot = null;
function recordShot() {
  const s = hs(H.id); const me = myPos();
  if (!me) { toast(SIM ? '먼저 지도를 눌러 위치를 정하세요' : '위치를 아직 못 잡았습니다'); return; }
  if (!me.fresh) {
    pendingShot = { t: Date.now() }; $('shotBtn').classList.add('wait'); toast('위치 갱신 중…');
    try { navigator.geolocation.getCurrentPosition(onFix, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 6000 }); } catch (e) { /* ignore */ }
    setTimeout(() => { if (pendingShot) commitShot(myPos()); }, 6000);
    return;
  }
  commitShot(me);
}
function tryPendingShot() { const me = myPos(); if (me && me.fresh) commitShot(me); }
function commitShot(me) {
  pendingShot = null; $('shotBtn').classList.remove('wait');
  if (!me) return;
  const s = hs(H.id);
  s.shots.push({ lat: +me.lat.toFixed(7), lon: +me.lon.toFixed(7), acc: Math.round(me.acc), t: Date.now() });
  s.n += 1; saveRound(); buzz();
  const d = distLL([me.lat, me.lon], s.pin || prepHole(H).G);
  toast(`${s.n}번째 샷 기록 · 남은 ${Math.round(d)}m`);
  render(); renderSheetLite();
}
function step(kind, d) {
  const s = hs(H.id);
  if (kind === 'shot') {
    if (d < 0 && s.n > 0) { if (s.shots.length >= s.n) s.shots.pop(); s.n--; }
    else if (d > 0) s.n++;
  } else s.putts = Math.max(0, s.putts + d);
  if (s.done) s.done = null;
  saveRound(); render(); renderSheetLite();
}
function finishHole(kind) {
  const s = hs(H.id);
  if (s.n + s.putts === 0 && kind === 'in') { toast('샷을 먼저 기록하세요'); return; }
  s.done = kind;
  // learn green position from the cup when holing out near the green (helps estimated holes next time)
  const me = myPos();
  if (kind === 'in' && me && me.fresh && me.acc <= 10) {
    const p = prepHole(H); const off = distLL([me.lat, me.lon], p.G);
    if (off < 45) s.cup = [+me.lat.toFixed(7), +me.lon.toFixed(7)];
    if (H.conf !== 'high' && off > 12 && off < 45 && !fixes[H.id]) { fixes[H.id] = s.cup; store.set('greenFix', fixes); H._p = null; }
  }
  saveRound(); buzz();
  const st = strokes(s); const t = totals();
  const ord = order(); const idx = ord.indexOf(H.id);
  const isTurn = idx === 8 && !round.back;
  const isEnd = idx === 17;
  const box = $('modalBox');
  box.innerHTML = `<div class="result"><div class="k">${label(H.id)} · PAR ${H.par}</div>
    <div class="rname ${scoreCls(st - H.par)}">${scoreName(st, H.par)}</div>
    <div class="rsub num">${st}타 (샷 ${s.n} · 퍼트 ${s.putts}${kind === 'ok' ? ' · OK +1' : ''}) · 누적 ${fmtDiff(t.diff)} / ${t.n}홀</div></div>
    <div id="resultActions" class="setup-actions"></div>`;
  const acts = box.querySelector('#resultActions');
  if (isTurn) {
    const k = document.createElement('div'); k.className = 'k'; k.textContent = '후반 코스'; acts.appendChild(k);
    const row = document.createElement('div'); row.className = 'rowbtns';
    COURSE_IDS.filter(c => c !== round.start).forEach(c => {
      const b = document.createElement('button'); b.className = 'btn-main'; b.textContent = C.courses[c];
      b.onclick = () => { round.back = c; saveRound(); closeModal(); goHole(c + '1'); };
      row.appendChild(b);
    });
    acts.appendChild(row);
  } else if (!isEnd && idx >= 0) {
    const b = document.createElement('button'); b.className = 'btn-main'; b.textContent = `다음 홀 · ${label(ord[idx + 1])}`;
    b.onclick = () => { closeModal(); goHole(ord[idx + 1]); }; acts.appendChild(b);
  } else if (isEnd) {
    const k = document.createElement('div'); k.className = 'k'; k.textContent = `라운드 종료 · ${t.st}타 (${fmtDiff(t.diff)})`; acts.appendChild(k);
  }
  const c = document.createElement('button'); c.className = 'btn-ghost'; c.textContent = '이 홀 계속 보기'; c.onclick = closeModal; acts.appendChild(c);
  openModal();
  render(); renderSheetLite();
}
/* Pin of the day: front / middle / back third of the green along the hole axis (or a tapped spot). */
function setPinMode(m) {
  const s = hs(H.id); const p = prepHole(H);
  if (s.pinMode === m) { s.pin = null; s.pinMode = null; saveRound(); toast('그린 중앙 기준으로 돌아갑니다'); render(); return; }
  const off = m === 'F' ? 0.6 * p.front : m === 'B' ? -0.6 * p.back : 0;
  const tv = xy(H.T, p.G); const L = len(tv) || 1;
  s.pin = ll({ x: tv.x / L * off, y: tv.y / L * off }, p.G); s.pinMode = m;
  saveRound(); render();
}
function goHole(id) {
  if (HOLES[id].c !== round.start && !round.back) round.back = HOLES[id].c;
  round.cur = id; saveRound(); closeSheet(); renderPlay();
}

/* ---------------- map taps (pin / sim) ---------------- */
function svgPoint(evt) {
  const svg = $('ov'); const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
function onMapTap(evt) {
  if (!H) return;
  const q = svgPoint(evt); const p = prepHole(H); const s = hs(H.id);
  const dG = Math.hypot(q.x - H.ig[0], q.y - H.ig[1]);
  const gR = Math.max(H.gf, H.gb) * 1.6;
  if (dG <= gR) {
    if (s.pin) { const pq = p.toImg(s.pin[0], s.pin[1]); if (Math.hypot(q.x - pq.x, q.y - pq.y) < 22) { s.pin = null; s.pinMode = null; saveRound(); toast('핀 위치 해제'); render(); return; } }
    s.pin = p.fromImg(q.x, q.y); s.pinMode = 'T'; saveRound(); toast('핀 위치 지정 · 다시 누르면 해제'); render(); return;
  }
  if (SIM) { gps.sim = p.fromImg(q.x, q.y); render(); }
}

/* ---------------- sheet ---------------- */
let sheetTab = null;
function openSheet() { $('sheet').classList.add('open'); }
function closeSheet() { $('sheet').classList.remove('open'); }
function renderSheetLite() {
  const t = totals();
  $('peekL').innerHTML = `<b>${label(H.id)}</b> · PAR ${H.par} · ${H.tees[prefs.tee]}m`;
  $('peekR').innerHTML = `${t.n ? `${t.st}타 <b>${fmtDiff(t.diff)}</b> · ${t.n}홀` : '홀 선택 ▴'}`;
  renderScorecard(); renderCards();
}
function renderSheet() {
  sheetTab = H.c;
  const tabs = $('tabs'); tabs.innerHTML = '';
  COURSE_IDS.forEach(c => {
    const b = document.createElement('button'); b.className = 'chip'; b.textContent = C.courses[c];
    b.setAttribute('aria-pressed', String(c === sheetTab));
    b.onclick = () => { sheetTab = c; [...tabs.children].forEach((x, i) => x.setAttribute('aria-pressed', String(COURSE_IDS[i] === c))); renderCards(true); };
    tabs.appendChild(b);
  });
  $('setTee').textContent = `거리 표기: ${TEE_NAMES[prefs.tee]}`;
  $('setWake').setAttribute('aria-pressed', String(!!prefs.wake));
  $('sheetNote').textContent = H.conf === 'high' ? '' : '좌표가 추정인 홀은 홀인을 누를 때 현재 위치(컵)를 기준으로 그린 위치를 자동 보정합니다. 그린 위에서 지도를 누르면 핀 위치를 지정할 수 있습니다.';
  renderSheetLite(); renderCards(true);
}
function miniSvg(h) {
  const pts = h.cl.map(q => q.join(',')).join(' ');
  return `<svg viewBox="0 0 ${h.w} ${h.h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="#2f6a3c" stroke-width="150" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${pts}" fill="none" stroke="#79b873" stroke-width="80" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${h.ig[0]}" cy="${h.ig[1]}" r="70" fill="#c9efc1"/><circle cx="${h.ig[0]}" cy="${h.ig[1]}" r="16" fill="#ff5a4f"/><rect x="${h.it[0] - 36}" y="${h.it[1] - 22}" width="72" height="44" rx="12" fill="#eef3ee"/></svg>`;
}
function renderCards(scroll) {
  const wrap = $('cards'); wrap.innerHTML = '';
  for (let i = 1; i <= 9; i++) {
    const h = HOLES[sheetTab + i]; const s = round.holes[h.id];
    const b = document.createElement('button'); b.className = 'card' + (h.id === H.id ? ' cur' : '');
    let badge = '';
    if (s && s.done) { const d = strokes(s) - h.par; badge = `<span class="sc ${scoreCls(d)}">${strokes(s)}</span>`; }
    b.innerHTML = `${badge}${miniSvg(h)}<div class="t"><b>${i}번</b><span>PAR ${h.par}</span></div><div class="m num">${h.tees[prefs.tee]}m</div>`;
    b.onclick = () => goHole(h.id);
    wrap.appendChild(b);
  }
  if (scroll) { const cur = sheetTab === H.c ? wrap.children[H.n - 1] : wrap.children[0]; if (cur) wrap.scrollLeft = Math.max(0, cur.offsetLeft - (wrap.clientWidth - cur.offsetWidth) / 2); }
}
function renderScorecard() {
  const ord = order(); const box = $('scorecard');
  const nines = [ord.slice(0, 9), ord.slice(9)].filter(a => a.length);
  let html = '';
  nines.forEach(n9 => {
    let par = 0, st = 0, played = 0;
    const cells = n9.map(id => { const h = HOLES[id]; const s = round.holes[id]; par += h.par; if (s && s.done) { st += strokes(s); played++; } return { h, s }; });
    html += `<table class="sc"><tr><th style="text-align:left">${C.courses[n9[0][0]]}</th>${cells.map(c => `<th>${c.h.n}</th>`).join('')}<th>계</th></tr>`;
    html += `<tr><td class="lab">PAR</td>${cells.map(c => `<td>${c.h.par}</td>`).join('')}<td>${par}</td></tr>`;
    html += `<tr><td class="lab">타수</td>${cells.map(c => c.s && c.s.done ? `<td class="${scoreCls(strokes(c.s) - c.h.par)}">${strokes(c.s)}</td>` : '<td>·</td>').join('')}<td><b>${played ? st : '·'}</b></td></tr>`;
    html += `<tr><td class="lab">퍼트</td>${cells.map(c => c.s && c.s.done ? `<td>${c.s.putts}</td>` : '<td></td>').join('')}<td></td></tr></table>`;
  });
  if (!round.back) html += `<div class="note" style="margin-top:6px">후반 코스는 ${C.courses[round.start]} 9번홀을 마치면 고릅니다. 위 탭에서 다른 코스 홀을 바로 열 수도 있습니다.</div>`;
  box.innerHTML = html;
}
function setupSheetDrag() {
  const sh = $('sheet'); const pk = $('peek');
  let y0 = null, t0 = 0, open0 = false, moved = false;
  const H0 = () => sh.getBoundingClientRect().height;
  pk.addEventListener('pointerdown', (e) => { y0 = e.clientY; t0 = Date.now(); open0 = sh.classList.contains('open'); moved = false; sh.classList.add('drag'); pk.setPointerCapture(e.pointerId); });
  pk.addEventListener('pointermove', (e) => {
    if (y0 == null) return; const dy = e.clientY - y0; if (Math.abs(dy) > 4) moved = true;
    const closedY = H0() - pk.offsetHeight; let y = (open0 ? 0 : closedY) + dy; y = Math.max(0, Math.min(closedY, y));
    sh.style.transform = `translateY(${y}px)`;
  });
  const end = (e) => {
    if (y0 == null) return; const dy = e.clientY - y0; const v = dy / Math.max(1, Date.now() - t0);
    sh.classList.remove('drag'); sh.style.transform = ''; y0 = null;
    if (!moved) { sh.classList.toggle('open'); return; }
    if (v < -0.3 || dy < -60) openSheet(); else if (v > 0.3 || dy > 60) closeSheet(); else sh.classList.toggle('open', open0);
  };
  pk.addEventListener('pointerup', end); pk.addEventListener('pointercancel', end);
}

/* ---------------- modals ---------------- */
function openModal() { $('modal').hidden = false; }
function closeModal() { $('modal').hidden = true; }
function confirmBox(title, body, okText, onOk) {
  $('modalBox').innerHTML = `<h4>${title}</h4><p>${body}</p><div class="rowbtns"><button class="btn-ghost" id="mCancel">취소</button><button class="btn-main" id="mOk">${okText}</button></div>`;
  $('mCancel').onclick = closeModal; $('mOk').onclick = () => { closeModal(); onOk(); };
  openModal();
}
function showTips() {
  const h = H; const p = prepHole(h);
  const tees = TEE_ORDER.map(k => `${TEE_NAMES[k]} ${h.tees[k]}`).join(' · ');
  let html = `<h4>${label(h.id)} · PAR ${h.par} · HDCP ${h.hdcp}</h4><div class="k num">${tees}</div><p>${esc(h.desc)}</p>`;
  if (h.tips.length) html += `<div class="k">공략 포인트</div><ul>${h.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
  if (h.warn.length) html += `<div class="k">주의</div><ul>${h.warn.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
  const conf = { high: '위성사진 대조 확인', mid: '위성사진 기반 (대체로 일치)', low: '위성사진 기반 추정 – 오차 가능' }[h.conf];
  html += `<div class="k">위치 데이터</div><p class="note">${fixes[h.id] ? '라운드 중 보정된 그린 위치 사용 중' : conf}. 그린 앞/뒤 거리는 홀 그림 비율로 계산한 근사값입니다.</p>`;
  html += `<div class="setup-actions"><button class="btn-ghost" id="fixHere">지금 위치를 이 홀 그린 중앙으로 보정</button>${fixes[h.id] ? '<button class="btn-ghost" id="fixReset">보정 되돌리기</button>' : ''}<button class="btn-main" id="mClose">닫기</button></div>`;
  $('modalBox').innerHTML = html; openModal();
  $('mClose').onclick = closeModal;
  $('fixHere').onclick = () => {
    const me = myPos(); if (!me) { toast('위치를 아직 못 잡았습니다'); return; }
    if (distLL([me.lat, me.lon], p.G) > 120) { toast('그린에서 120m 이상 떨어져 있어 보정하지 않았습니다'); return; }
    fixes[h.id] = [+me.lat.toFixed(7), +me.lon.toFixed(7)]; store.set('greenFix', fixes); h._p = null; closeModal(); toast('그린 위치를 보정했습니다'); renderPlay();
  };
  const fr = $('fixReset'); if (fr) fr.onclick = () => { delete fixes[h.id]; store.set('greenFix', fixes); h._p = null; closeModal(); toast('원래 좌표로 되돌렸습니다'); renderPlay(); };
}

/* ---------------- wake lock ---------------- */
let wl = null;
async function wake() { if (!prefs.wake || !('wakeLock' in navigator)) return; try { wl = await navigator.wakeLock.request('screen'); } catch (e) { wl = null; } }
function releaseWake() { try { wl && wl.release(); } catch (e) { /* ignore */ } wl = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !$('play').hidden) { wake(); render(); } });

/* ---------------- wiring ---------------- */
function wire() {
  $('toSetup').onclick = () => renderSetup('start');
  $('shotBtn').onclick = recordShot;
  $('stepShot').addEventListener('click', (e) => { const d = e.target.closest('button'); d && step('shot', +d.dataset.d); });
  $('stepPutt').addEventListener('click', (e) => { const d = e.target.closest('button'); d && step('putt', +d.dataset.d); });
  $('holeIn').onclick = () => finishHole('in');
  $('okBtn').onclick = () => finishHole('ok');
  $('ov').addEventListener('click', onMapTap);
  $('tipBtn').onclick = showTips;
  $('pinSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); b && setPinMode(b.dataset.m); });
  $('gthumb').onclick = () => { $('modalBox').innerHTML = `<h4>${label(H.id)} 그린 경사</h4><img class="bigslope" src="${H.gimg}" alt="그린 경사도"><p class="note">빨강이 높고 파랑이 낮습니다. 홀 그림과 같은 방향(아래쪽이 티)입니다.</p><button class="btn-main" id="mClose">닫기</button>`; openModal(); $('mClose').onclick = closeModal; };
  $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
  $('setClubs').onclick = () => { closeSheet(); renderSetup('play'); };
  $('setTee').onclick = () => { const i = TEE_ORDER.indexOf(prefs.tee); prefs.tee = TEE_ORDER[(i + 1) % 5]; savePrefs(); renderPlay(); };
  $('setWake').onclick = () => { prefs.wake = !prefs.wake; savePrefs(); $('setWake').setAttribute('aria-pressed', String(prefs.wake)); if (prefs.wake) { wake(); toast('화면이 꺼지지 않게 유지합니다 (배터리 소모 증가)'); } else releaseWake(); };
  $('setHome').onclick = () => { closeSheet(); show('start'); renderStart(); };
  setupSheetDrag();
}

/* ---------------- boot ---------------- */
function boot() {
  wire();
  startGps();
  if (!clubs) { renderSetup('start'); }
  else if (round && Object.keys(round.holes).length) { show('start'); renderStart(); }
  else { show('start'); renderStart(); }
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').then(() => {
      // warm the image cache for all holes in the background
      setTimeout(() => {
        const urls = C.holes.flatMap(h => [h.img, h.gimg]).concat(Object.values(BG));
        urls.forEach((u, i) => setTimeout(() => { fetch(u, { mode: 'no-cors' }).catch(() => {}); }, i * 150));
      }, 4000);
    }).catch(() => {});
  }
}
boot();
// debug hook for testing
window.__spk = { HOLES, prepHole, plan, myPos, gps, render, goHole: (id) => goHole(id) };
})();
