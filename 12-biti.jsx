import React, { useEffect, useMemo, useRef, useState } from "react";

/* ================================================================
   12 BITI · Bara Tehni · Baro Guti — v3
   A chalk-drawn village courtyard game for one phone — or two
   phones far apart.
   v3: stones are little characters now — grab them and drag,
   they blink, smile, and spin out when captured. Layered organic
   sounds with combo pitch for chain jumps.
   Board: 5×5 points — grid + both diagonals + midpoint diamond
   (classic Alquerque-family layout). 12 stones each, centre empty.
   ================================================================ */

/* ---------- Geometry ---------- */
const P = (r, c) => r * 5 + c;
const RC = (i) => [Math.floor(i / 5), i % 5];

const DIAG_EDGES = [
  [0, 0, 1, 1], [1, 1, 2, 2], [2, 2, 3, 3], [3, 3, 4, 4],
  [0, 4, 1, 3], [1, 3, 2, 2], [2, 2, 3, 1], [3, 1, 4, 0],
  [0, 2, 1, 3], [1, 3, 2, 4], [2, 4, 3, 3], [3, 3, 4, 2],
  [4, 2, 3, 1], [3, 1, 2, 0], [2, 0, 1, 1], [1, 1, 0, 2],
];

const EDGE = new Set();
const ek = (a, b) => (a < b ? a + "-" + b : b + "-" + a);
for (let r = 0; r < 5; r++) {
  for (let c = 0; c < 5; c++) {
    if (c < 4) EDGE.add(ek(P(r, c), P(r, c + 1)));
    if (r < 4) EDGE.add(ek(P(r, c), P(r + 1, c)));
  }
}
DIAG_EDGES.forEach(([r1, c1, r2, c2]) => EDGE.add(ek(P(r1, c1), P(r2, c2))));
const conn = (a, b) => EDGE.has(ek(a, b));

const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

const GEO = Array.from({ length: 25 }, () => ({ steps: [], jumps: [] }));
for (let r = 0; r < 5; r++) {
  for (let c = 0; c < 5; c++) {
    const p = P(r, c);
    for (const [dr, dc] of DIRS) {
      const r1 = r + dr, c1 = c + dc;
      if (r1 < 0 || r1 > 4 || c1 < 0 || c1 > 4) continue;
      const s = P(r1, c1);
      if (!conn(p, s)) continue;
      GEO[p].steps.push(s);
      const r2 = r + 2 * dr, c2 = c + 2 * dc;
      if (r2 < 0 || r2 > 4 || c2 < 0 || c2 > 4) continue;
      const j = P(r2, c2);
      if (conn(s, j)) GEO[p].jumps.push({ over: s, to: j });
    }
  }
}

/* ---------- Rules (pure) ---------- */
function initialBoard() {
  const b = Array(25).fill(0); // 0 empty · 1 marigold (host/bottom) · 2 peacock (top)
  for (let c = 0; c < 5; c++) { b[P(0, c)] = 2; b[P(1, c)] = 2; b[P(3, c)] = 1; b[P(4, c)] = 1; }
  b[P(2, 0)] = 2; b[P(2, 1)] = 2; b[P(2, 3)] = 1; b[P(2, 4)] = 1;
  return b;
}
function freshPieces(board) {
  const pieces = [];
  board.forEach((v, i) => { if (v) pieces.push({ id: "s" + i, player: v, pos: i, alive: true }); });
  return pieces;
}
function pieceMoves(board, p) {
  const me = board[p], res = [];
  if (!me) return res;
  for (const s of GEO[p].steps) if (board[s] === 0) res.push({ from: p, to: s });
  for (const { over, to } of GEO[p].jumps)
    if (board[over] !== 0 && board[over] !== me && board[to] === 0)
      res.push({ from: p, to, captured: over });
  return res;
}
function allMoves(board, player, mustCapture) {
  let res = [];
  for (let p = 0; p < 25; p++) if (board[p] === player) res = res.concat(pieceMoves(board, p));
  if (mustCapture) {
    const caps = res.filter((m) => m.captured != null);
    if (caps.length) return caps;
  }
  return res;
}
function applyBoard(board, m) {
  const b = board.slice();
  b[m.to] = b[m.from]; b[m.from] = 0;
  if (m.captured != null) b[m.captured] = 0;
  return b;
}
const countOf = (board, pl) => board.reduce((a, v) => a + (v === pl ? 1 : 0), 0);

/* ---------- AI ---------- */
function evaluate(board, ai) {
  const my = countOf(board, ai), op = countOf(board, 3 - ai);
  if (op === 0) return 9999;
  if (my === 0) return -9999;
  const mob = allMoves(board, ai, false).length - allMoves(board, 3 - ai, false).length;
  return 24 * (my - op) + mob;
}
function minimax(board, player, ai, depth, alpha, beta, mc) {
  const moves = allMoves(board, player, mc);
  if (!moves.length) return player === ai ? -9000 - depth : 9000 + depth;
  if (depth <= 0) return evaluate(board, ai);
  moves.sort((a, b) => (b.captured != null) - (a.captured != null));
  if (player === ai) {
    let best = -Infinity;
    for (const m of moves) {
      const v = minimax(applyBoard(board, m), 3 - player, ai, depth - 1, alpha, beta, mc);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const v = minimax(applyBoard(board, m), 3 - player, ai, depth - 1, alpha, beta, mc);
      if (v < best) best = v;
      if (v < beta) beta = v;
      if (beta <= alpha) break;
    }
    return best;
  }
}
function bestAiMove(board, moves, depth, mc, noise) {
  let best = -Infinity, pick = moves[0];
  const ordered = moves.slice().sort((a, b) => (b.captured != null) - (a.captured != null));
  for (const m of ordered) {
    let v = minimax(applyBoard(board, m), 1, 2, depth - 1, -Infinity, Infinity, mc);
    v += (Math.random() - 0.5) * noise;
    if (v > best) { best = v; pick = m; }
  }
  return pick;
}
function planAiTurn(board, level, mc) {
  const moves = allMoves(board, 2, mc);
  if (!moves.length) return [];
  let first;
  if (level === "easy") {
    first = Math.random() < 0.4
      ? moves[Math.floor(Math.random() * moves.length)]
      : bestAiMove(board, moves, 1, mc, 6);
  } else if (level === "medium") {
    first = bestAiMove(board, moves, 3, mc, 1.5);
  } else {
    first = bestAiMove(board, moves, 4, mc, 0.4);
  }
  const seq = [first];
  if (first.captured != null) {
    let b = applyBoard(board, first), p = first.to;
    for (let guard = 0; guard < 12; guard++) {
      const js = pieceMoves(b, p).filter((x) => x.captured != null);
      if (!js.length) break;
      let bj = js[0], bs = -Infinity;
      for (const j of js) {
        const nb = applyBoard(b, j);
        const onward = pieceMoves(nb, j.to).filter((x) => x.captured != null).length;
        const s = onward * 50 + evaluate(nb, 2);
        if (s > bs) { bs = s; bj = j; }
      }
      seq.push(bj); b = applyBoard(b, bj); p = bj.to;
    }
  }
  return seq;
}

/* ---------- Online rooms (Claude shared storage) ---------- */
const hasStorage =
  typeof window !== "undefined" && window.storage &&
  typeof window.storage.get === "function" && typeof window.storage.set === "function";

const ROOM_ALPHA = "ABCDEFGHJKLMNPRSTUVWXYZ"; // no I, O, Q — easier to read aloud
const makeCode = () => Array.from({ length: 4 }, () => ROOM_ALPHA[Math.floor(Math.random() * ROOM_ALPHA.length)]).join("");
const roomKey = (code) => "biti:room:" + code;

async function roomGet(code) {
  try {
    const r = await window.storage.get(roomKey(code), true);
    return r && r.value ? JSON.parse(r.value) : null;
  } catch (e) { return null; }
}
async function roomSet(code, obj) {
  try {
    const r = await window.storage.set(roomKey(code), JSON.stringify(obj), true);
    return !!r;
  } catch (e) { return false; }
}
function serializeRoom(g) {
  return {
    v: 1, seq: g.seq, phase: g.phase, t: Date.now(),
    hostAv: g.avatars[1], guestAv: g.avatars[2] || null, guestJoined: !!g.avatars[2],
    board: g.board, pieces: g.pieces, current: g.current, chain: g.chain,
    msc: g.msc, winner: g.winner, reason: g.reason,
  };
}

/* ---------- Flavour ---------- */
const AVATARS = ["🐯", "🦚", "🐘", "🦋", "🐒", "⭐"];
const NAME_OF = { "🐯": "Tiger", "🦚": "Peacock", "🐘": "Elephant", "🦋": "Butterfly", "🐒": "Monkey", "⭐": "Star", "🤖": "Computer" };
const CHALK = "#FFF3DC";
const MARIGOLD = "#FFC24B";
const PEACOCK = "#2DD4BF";
const ROSE = "#F973B6";

/* ---------- Painted character stones (SVG) ---------- */
function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <radialGradient id="bitiStone1" cx="34%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#FFF4CB" />
          <stop offset="34%" stopColor="#FFCF6B" />
          <stop offset="68%" stopColor="#EE9A22" />
          <stop offset="100%" stopColor="#8A4A07" />
        </radialGradient>
        <radialGradient id="bitiStone2" cx="34%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#DFFFF8" />
          <stop offset="34%" stopColor="#4FE3CD" />
          <stop offset="68%" stopColor="#0F9184" />
          <stop offset="100%" stopColor="#043B36" />
        </radialGradient>
        <radialGradient id="bitiSheen" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <filter id="bitiSoft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
        <filter id="bitiChalk" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.055" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.9" />
        </filter>
      </defs>
    </svg>
  );
}

const SPECKS = [[30, 64], [62, 74], [72, 52], [26, 46], [68, 30]];

/*
  face: null → painted motif (UI chips)
        "idle" → blinking friendly face
        "wide" → excited (picked up / selected)
        "dizzy" → captured (X eyes)
*/
function StoneSVG({ player, className = "", style = {}, shadow = true, face = null, blinkDelay = "0s" }) {
  const grad = player === 1 ? "url(#bitiStone1)" : "url(#bitiStone2)";
  const ringCol = player === 1 ? "#7A3E04" : "#03332E";
  const paintCol = player === 1 ? "#B3450E" : "#EAFDF9";
  const cheek = player === 1 ? "#F0722A" : "#8FF3E4";
  const wide = face === "wide";
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      {shadow && <ellipse cx="50" cy="84" rx="34" ry="9" fill="#000" opacity="0.38" filter="url(#bitiSoft)" />}
      <circle cx="50" cy="47" r="38" fill={grad} />
      <circle cx="50" cy="47" r="38" fill="none" stroke={ringCol} strokeOpacity="0.5" strokeWidth="2.5" />

      {face == null ? (
        <g>
          <circle cx="50" cy="47" r="24" fill="none" stroke={paintCol} strokeOpacity="0.75" strokeWidth="3" />
          {player === 1 ? (
            <circle cx="50" cy="47" r="6.5" fill={paintCol} fillOpacity="0.85" />
          ) : (
            <g fill={paintCol} fillOpacity="0.9">
              <circle cx="50" cy="39" r="3.4" />
              <circle cx="43" cy="51" r="3.4" />
              <circle cx="57" cy="51" r="3.4" />
            </g>
          )}
        </g>
      ) : face === "dizzy" ? (
        <g stroke={ringCol} strokeWidth="4.2" strokeLinecap="round" opacity="0.9">
          <path d="M 32 36 L 42 46 M 42 36 L 32 46" />
          <path d="M 58 36 L 68 46 M 68 36 L 58 46" />
          <path d="M 41 63 Q 50 56 59 63" fill="none" />
        </g>
      ) : (
        <g>
          <g className="biti-blink" style={{ animationDelay: blinkDelay }}>
            <ellipse cx="38" cy="42" rx={wide ? 8 : 6.5} ry={wide ? 9.4 : 7.5} fill="#FFFDF5" />
            <ellipse cx="62" cy="42" rx={wide ? 8 : 6.5} ry={wide ? 9.4 : 7.5} fill="#FFFDF5" />
            <circle cx="39" cy={wide ? 42.6 : 43.4} r={wide ? 3.8 : 3} fill="#241309" />
            <circle cx="63" cy={wide ? 42.6 : 43.4} r={wide ? 3.8 : 3} fill="#241309" />
            <circle cx="40.4" cy="41.4" r="1.15" fill="#fff" />
            <circle cx="64.4" cy="41.4" r="1.15" fill="#fff" />
          </g>
          <circle cx="29.5" cy="53.5" r="4.2" fill={cheek} opacity="0.55" />
          <circle cx="70.5" cy="53.5" r="4.2" fill={cheek} opacity="0.55" />
          {wide ? (
            <path d="M 41 57 Q 50 69 59 57 Q 50 62.5 41 57 Z" fill={ringCol} opacity="0.88" />
          ) : (
            <path d="M 43 58.5 Q 50 64.5 57 58.5" fill="none" stroke={ringCol} strokeWidth="3.2" strokeLinecap="round" opacity="0.85" />
          )}
        </g>
      )}

      <g fill={ringCol} opacity="0.2">
        {SPECKS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 1.3 : 1.8} />)}
      </g>
      <ellipse cx="37" cy="28" rx="14" ry="8.5" fill="url(#bitiSheen)" transform="rotate(-18 37 28)" />
      <circle cx="32" cy="24.5" r="3" fill="#fff" opacity="0.9" />
    </svg>
  );
}

/* ---------- Sounds (layered Web Audio, no assets) ---------- */
function useSounds(enabledRef) {
  const ctxRef = useRef(null);
  const noiseRef = useRef(null);
  const ensure = () => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = ctxRef.current;
      const len = Math.floor(ctx.sampleRate * 0.12);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      noiseRef.current = buf;
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
  };
  const tone = (f, dur, type = "sine", gain = 0.12, delay = 0, slideTo = null) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(Math.max(40, f), t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  };
  const thock = (gain = 0.16, delay = 0, cutoff = 700) => {
    const ctx = ctxRef.current;
    if (!ctx || !noiseRef.current) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = noiseRef.current;
    const flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
    src.connect(flt); flt.connect(g); g.connect(ctx.destination);
    src.start(t0);
  };
  const R = (f) => f * (0.94 + Math.random() * 0.12); // humanize pitch
  const play = (kind, opt = 0) => {
    if (!enabledRef.current) return;
    try {
      ensure();
      if (kind === "select") { tone(R(640), 0.05, "triangle", 0.06); tone(R(940), 0.06, "triangle", 0.05, 0.045); }
      else if (kind === "grab") { tone(R(430), 0.09, "triangle", 0.08, 0, 700); thock(0.05, 0, 1800); }
      else if (kind === "tick") tone(R(1250), 0.03, "sine", 0.045);
      else if (kind === "move") { thock(0.18, 0, 620); tone(R(170), 0.08, "sine", 0.1, 0.005); }
      else if (kind === "back") { tone(R(340), 0.1, "sine", 0.06, 0, 210); }
      else if (kind === "capture") {
        const c = Math.min(opt || 0, 6);
        const base = 540 * Math.pow(1.14, c);
        thock(0.2, 0, 900);
        tone(base, 0.09, "square", 0.08, 0.01, base * 0.55);
        tone(base * 2.1, 0.1, "sine", 0.07, 0.12);
        tone(base * 2.8, 0.1, "sine", 0.05, 0.19);
      }
      else if (kind === "chain") { tone(R(880), 0.06, "triangle", 0.07); tone(R(1180), 0.07, "triangle", 0.06, 0.06); }
      else if (kind === "start") { tone(392, 0.09, "triangle", 0.08); tone(523, 0.09, "triangle", 0.08, 0.09); tone(659, 0.11, "triangle", 0.08, 0.18); }
      else if (kind === "turn") { tone(660, 0.07, "triangle", 0.08); tone(880, 0.08, "triangle", 0.07, 0.08); }
      else if (kind === "win") {
        [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.18, "triangle", 0.09, i * 0.1));
        [2093, 2637, 3136].forEach((f, i) => tone(f, 0.4, "sine", 0.03, 0.55 + i * 0.07));
      }
      else if (kind === "no") { tone(230, 0.07, "sawtooth", 0.045, 0, 175); tone(185, 0.09, "sawtooth", 0.04, 0.09, 140); }
    } catch (e) { /* sound is optional */ }
  };
  return play;
}

/* Touch-first press handler for simple buttons: instant on touch, keyboard-friendly */
const press = (fn) => ({
  onPointerDown: (e) => { e.preventDefault(); fn(); },
  onClick: (e) => { if (e.detail === 0) fn(); },
});

/* ================================================================ */
export default function TwelveBiti() {
  const [game, setGame] = useState(null); // null → menu
  const [selected, setSelected] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sound, setSound] = useState(true);
  const [mustCapture, setMustCapture] = useState(false);
  const [menuAv1, setMenuAv1] = useState("🐯");
  const [menuAv2, setMenuAv2] = useState("🦚");
  const [confettiKey, setConfettiKey] = useState(0);
  const [shake, setShake] = useState(null);       // {pos, key}
  const [lastMoved, setLastMoved] = useState(null); // {id, key} — landing hop
  const [bursts, setBursts] = useState([]);       // capture star bursts
  const [onlineBusy, setOnlineBusy] = useState(false);

  const soundRef = useRef(true); soundRef.current = sound;
  const mustRef = useRef(false); mustRef.current = mustCapture;
  const gameRef = useRef(null); gameRef.current = game;
  const aiBusyRef = useRef(false);
  const pollBusyRef = useRef(false);
  const notifSeqRef = useRef(0);
  const comboRef = useRef(0);
  const play = useSounds(soundRef);

  const showToast = (msg) => setToast({ msg, id: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1900);
    return () => clearTimeout(t);
  }, [toast]);

  const effMust = (g) => (g && g.mode === "online" ? false : mustRef.current);
  const myPlayer = (g) => (g && g.mode === "online" ? (g.role === "host" ? 1 : 2) : 1);

  function addBurst(pos, player) {
    const key = Date.now() + Math.random();
    setBursts((b) => [...b.slice(-4), { key, pos, player }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.key !== key)), 800);
  }

  /* ----- start / reset (local modes) ----- */
  function startGame(mode, level) {
    const board = initialBoard();
    play("start");
    setSelected(null); setToast(null); setLastMoved(null); setBursts([]);
    aiBusyRef.current = false; setAiBusy(false); comboRef.current = 0;
    const av2 = mode === "ai" ? "🤖" : (menuAv2 !== menuAv1 ? menuAv2 : AVATARS.find((a) => a !== menuAv1));
    setGame({
      gen: Date.now(), mode, level: level || null, phase: "playing",
      avatars: { 1: menuAv1, 2: av2 },
      board, pieces: freshPieces(board), current: 1, chain: null,
      winner: null, reason: null, msc: 0, history: [],
    });
  }
  const toMenu = () => { setGame(null); setSelected(null); aiBusyRef.current = false; setAiBusy(false); };

  /* ----- online: create / join ----- */
  async function createRoom() {
    if (onlineBusy) return;
    setOnlineBusy(true); play("start");
    const code = makeCode();
    const board = initialBoard();
    const g = {
      gen: Date.now(), mode: "online", role: "host", code, seq: 1, phase: "lobby",
      avatars: { 1: menuAv1, 2: null },
      board, pieces: freshPieces(board), current: 1, chain: null,
      winner: null, reason: null, msc: 0, history: [],
    };
    const ok = await roomSet(code, serializeRoom(g));
    setOnlineBusy(false);
    if (!ok) { showToast("Couldn't make a room — try again in a moment"); return; }
    notifSeqRef.current = 1; comboRef.current = 0;
    setSelected(null); setLastMoved(null); setBursts([]);
    setGame(g);
  }
  async function joinRoom(codeRaw) {
    if (onlineBusy) return;
    const code = (codeRaw || "").toUpperCase().trim();
    if (code.length !== 4) { showToast("Room codes are 4 letters"); return; }
    setOnlineBusy(true);
    const r = await roomGet(code);
    if (!r) { setOnlineBusy(false); showToast(`No room called ${code} — check the letters`); return; }
    if (r.guestJoined || r.phase !== "lobby") { setOnlineBusy(false); showToast("That room already has two players"); return; }
    if (r.t && Date.now() - r.t > 10 * 60 * 1000) { setOnlineBusy(false); showToast("That room looks old — ask for a fresh code"); return; }
    const g = {
      gen: Date.now(), mode: "online", role: "guest", code, seq: r.seq + 1, phase: "playing",
      avatars: { 1: r.hostAv, 2: menuAv1 !== r.hostAv ? menuAv1 : AVATARS.find((a) => a !== r.hostAv) },
      board: r.board, pieces: r.pieces, current: r.current, chain: r.chain ?? null,
      winner: null, reason: null, msc: r.msc || 0, history: [],
    };
    const ok = await roomSet(code, serializeRoom(g));
    setOnlineBusy(false);
    if (!ok) { showToast("Couldn't join — try again"); return; }
    play("start");
    notifSeqRef.current = g.seq; comboRef.current = 0;
    setSelected(null); setLastMoved(null); setBursts([]);
    setGame(g);
  }

  /* ----- shared commit helpers ----- */
  const snap = (g) => ({ board: g.board.slice(), pieces: g.pieces.map((p) => ({ ...p })), current: g.current, msc: g.msc });
  function commitPieces(g, m) {
    const board = applyBoard(g.board, m);
    const pieces = g.pieces.map((p) => ({ ...p }));
    const mover = pieces.find((p) => p.alive && p.pos === m.from);
    if (mover) mover.pos = m.to;
    if (m.captured != null) {
      const v = pieces.find((p) => p.alive && p.pos === m.captured);
      if (v) v.alive = false;
    }
    return { board, pieces };
  }
  function endTurnCore(g) {
    g.chain = null;
    g.current = 3 - g.current;
    const mv = allMoves(g.board, g.current, effMust(g));
    if (!mv.length) { g.winner = 3 - g.current; g.reason = "blocked"; }
    else if (g.msc >= 60) {
      const a1 = countOf(g.board, 1), a2 = countOf(g.board, 2);
      g.winner = a1 === a2 ? "draw" : a1 > a2 ? 1 : 2;
      g.reason = "quiet";
    }
    return g;
  }
  const markMine = (g) => { if (g.mode === "online") { g.seq = (g.seq || 0) + 1; g.mine = true; g.dirty = Date.now(); } return g; };

  /* ----- whose turn / what can move ----- */
  const isHumanTurn = !!game && !game.winner && game.phase === "playing" && !aiBusy &&
    (game.mode === "pvp" || game.current === myPlayer(game));

  const movable = useMemo(() => {
    if (!game || !isHumanTurn || game.chain != null) return new Set();
    const mv = allMoves(game.board, game.current, effMust(game));
    return new Set(mv.map((m) => m.from));
  }, [game, isHumanTurn, mustCapture]);

  const legalForSelected = useMemo(() => {
    if (!game || selected == null || !isHumanTurn) return [];
    if (game.chain != null) {
      if (selected !== game.chain) return [];
      return pieceMoves(game.board, selected).filter((m) => m.captured != null);
    }
    let mv = pieceMoves(game.board, selected);
    if (effMust(game)) {
      const anyCap = allMoves(game.board, game.current, true).some((m) => m.captured != null);
      if (anyCap) mv = mv.filter((m) => m.captured != null);
    }
    return mv;
  }, [game, selected, isHumanTurn, mustCapture]);

  /* ----- human actions ----- */
  function tapPiece(i, viaDrag = false) {
    const g = gameRef.current;
    if (!g || g.winner || !isHumanTurn) return false;
    if (g.board[i] !== g.current) { play("no"); return false; }
    if (g.chain != null && i !== g.chain) { showToast("Finish your jumps — or end your turn"); play("no"); return false; }
    if (g.chain == null && !movable.has(i)) {
      play("no");
      setShake({ pos: i, key: Date.now() });
      showToast("That stone is stuck — try a glowing one!");
      return false;
    }
    setSelected(i);
    play(viaDrag ? "grab" : "select");
    return true;
  }

  function tapTarget(m) {
    if (!isHumanTurn) return;
    const g0 = gameRef.current;
    const wasChaining = g0 && g0.chain != null;
    if (m.captured != null) {
      comboRef.current = wasChaining ? comboRef.current + 1 : 0;
      play("capture", comboRef.current);
      addBurst(m.captured, g0 ? 3 - g0.current : 2);
    } else {
      comboRef.current = 0;
      play("move");
    }
    const moverPc = g0 && g0.pieces.find((p) => p.alive && p.pos === m.from);
    if (moverPc) setLastMoved({ id: moverPc.id, key: Date.now() });
    setGame((prev) => {
      if (!prev || prev.winner) return prev;
      const g = { ...prev };
      if (g.chain == null && g.mode !== "online") g.history = [...g.history.slice(-39), snap(prev)];
      const { board, pieces } = commitPieces(g, m);
      g.board = board; g.pieces = pieces;
      g.msc = m.captured != null ? 0 : g.msc + 1;
      const opp = 3 - g.current;
      if (countOf(board, opp) === 0) { g.winner = g.current; g.reason = "captured"; g.chain = null; return markMine(g); }
      if (m.captured != null) {
        const more = pieceMoves(board, m.to).filter((x) => x.captured != null);
        if (more.length) { g.chain = m.to; return markMine(g); }
      }
      return markMine(endTurnCore(g));
    });
    setSelected(null);
  }

  // auto-select the chaining stone + "jump again!" chirp
  useEffect(() => {
    if (game && game.chain != null && isHumanTurn) {
      setSelected(game.chain);
      const t = setTimeout(() => play("chain"), 160);
      return () => clearTimeout(t);
    }
  }, [game && game.chain]); // eslint-disable-line

  function humanEndTurn() {
    play("move");
    comboRef.current = 0;
    setGame((prev) => (prev && prev.chain != null && !prev.winner ? markMine(endTurnCore({ ...prev })) : prev));
    setSelected(null);
  }

  function undo() {
    if (!game || game.mode === "online" || aiBusy || !game.history.length) return;
    play("select");
    comboRef.current = 0;
    setGame((prev) => {
      if (!prev || !prev.history.length) return prev;
      const h = prev.history[prev.history.length - 1];
      return {
        ...prev,
        board: h.board.slice(),
        pieces: h.pieces.map((p) => ({ ...p })),
        current: h.current, msc: h.msc,
        chain: null, winner: null, reason: null,
        history: prev.history.slice(0, -1),
      };
    });
    setSelected(null); setLastMoved(null);
  }

  function rematch() {
    if (!game) return;
    if (game.mode === "online") {
      play("start");
      setSelected(null); setLastMoved(null); setBursts([]); comboRef.current = 0;
      setGame((prev) => {
        if (!prev) return prev;
        const board = initialBoard();
        return markMine({
          ...prev, board, pieces: freshPieces(board), current: 1, chain: null,
          winner: null, reason: null, msc: 0, history: [], phase: "playing",
        });
      });
    } else {
      startGame(game.mode, game.level);
    }
  }

  /* ----- AI turn ----- */
  useEffect(() => {
    const g = gameRef.current;
    if (!g || g.mode !== "ai" || g.current !== 2 || g.winner || aiBusyRef.current) return;
    const myGen = g.gen;
    const alive = () => gameRef.current && gameRef.current.gen === myGen;
    aiBusyRef.current = true; setAiBusy(true);
    const release = () => { if (alive()) { aiBusyRef.current = false; setAiBusy(false); } };
    setTimeout(() => {
      if (!alive()) return;
      const g0 = gameRef.current;
      if (g0.winner) { release(); return; }
      const seq = planAiTurn(g0.board, g0.level, mustRef.current);
      if (!seq.length) { release(); return; }
      const comboAt = seq.map((mm, ii) => seq.slice(0, ii).filter((x) => x.captured != null).length);
      seq.forEach((m, i) => {
        setTimeout(() => {
          if (!alive()) return;
          const last = i === seq.length - 1;
          if (m.captured != null) { play("capture", comboAt[i]); addBurst(m.captured, 2); }
          else play("move");
          const mv0 = gameRef.current && gameRef.current.pieces.find((p) => p.alive && p.pos === m.from);
          if (mv0) setLastMoved({ id: mv0.id, key: Date.now() });
          setGame((prev) => {
            if (!prev || prev.gen !== myGen || prev.winner || prev.board[m.from] !== 2) return prev;
            const ng = { ...prev };
            const { board, pieces } = commitPieces(ng, m);
            ng.board = board; ng.pieces = pieces;
            ng.msc = m.captured != null ? 0 : ng.msc + 1;
            if (countOf(board, 1) === 0) { ng.winner = 2; ng.reason = "captured"; ng.chain = null; return ng; }
            if (!last) { ng.chain = m.to; return ng; }
            return endTurnCore(ng);
          });
          if (last) release();
        }, 250 + i * 560);
      });
    }, 620);
  }, [game && game.current, game && game.winner]); // eslint-disable-line

  /* ----- online: push my moves ----- */
  useEffect(() => {
    const g = gameRef.current;
    if (!g || g.mode !== "online" || !g.mine || !g.code) return;
    roomSet(g.code, serializeRoom(g)).then((ok) => {
      if (!ok) showToast("Connection hiccup — that move may not have synced");
    });
  }, [game && game.dirty]); // eslint-disable-line

  /* ----- online: poll for the other player ----- */
  useEffect(() => {
    if (!game || game.mode !== "online" || !game.code) return;
    const iv = setInterval(async () => {
      const g = gameRef.current;
      if (!g || g.mode !== "online" || pollBusyRef.current) return;
      pollBusyRef.current = true;
      const r = await roomGet(g.code);
      pollBusyRef.current = false;
      const g2 = gameRef.current;
      if (!r || !g2 || g2.mode !== "online" || r.seq <= (g2.seq || 0)) return;
      const wasLobby = g2.phase === "lobby";
      // diff for sounds & animation
      const deadNow = g2.pieces.filter((p) => p.alive && (r.pieces.find((q) => q.id === p.id) || {}).alive === false);
      const movedPc = r.pieces.find((q) => {
        const p = g2.pieces.find((pp) => pp.id === q.id);
        return p && p.alive && q.alive && p.pos !== q.pos;
      });
      setGame((prev) => {
        if (!prev || prev.mode !== "online") return prev;
        return {
          ...prev,
          seq: r.seq, phase: r.phase, mine: false,
          avatars: { 1: r.hostAv || prev.avatars[1], 2: r.guestAv || prev.avatars[2] },
          board: r.board, pieces: r.pieces, current: r.current, chain: r.chain ?? null,
          msc: r.msc || 0, winner: r.winner ?? null, reason: r.reason ?? null,
        };
      });
      if (!wasLobby) {
        if (deadNow.length) { play("capture", 0); deadNow.forEach((p) => addBurst(p.pos, p.player)); }
        else if (movedPc) play("move");
        if (movedPc) setLastMoved({ id: movedPc.id, key: Date.now() });
      }
      const mp = g2.role === "host" ? 1 : 2;
      if (wasLobby && r.phase === "playing") {
        play("start");
        showToast(`${NAME_OF[r.guestAv] || "A friend"} joined — your move! ✨`);
        notifSeqRef.current = r.seq;
      } else if (!r.winner && r.current === mp && notifSeqRef.current !== r.seq) {
        notifSeqRef.current = r.seq;
        play("turn");
        showToast("Your move! ✨");
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [game && game.mode, game && game.code]); // eslint-disable-line

  /* ----- win celebration ----- */
  useEffect(() => {
    if (game && game.winner) {
      setSelected(null);
      if (game.winner !== "draw") { play("win"); setConfettiKey((k) => k + 1); }
    }
  }, [game && game.winner]); // eslint-disable-line

  /* ================= render ================= */
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&display=swap');
    .biti-display { font-family: 'Baloo 2','Comic Sans MS',ui-rounded,system-ui,sans-serif; }
    .biti-blink { transform-box: fill-box; transform-origin: center; animation: bitiBlink 4.6s ease-in-out infinite; }
    @keyframes bitiBlink { 0%, 91%, 100% { transform: scaleY(1); } 94%, 96% { transform: scaleY(0.1); } }
    @keyframes bitiPulse { 0%,100% { transform: translate(-50%,-50%) scale(1); } 50% { transform: translate(-50%,-50%) scale(1.08); } }
    @keyframes bitiDot { 0%,100% { transform: translate(-50%,-50%) scale(.88); opacity:.8; } 50% { transform: translate(-50%,-50%) scale(1.08); opacity:1; } }
    @keyframes bitiHalo { 0%,100% { opacity:.28; transform: translate(-50%,-50%) scale(.95); } 50% { opacity:.6; transform: translate(-50%,-50%) scale(1.12); } }
    @keyframes bitiGlow { 0%,100% { opacity:.5; } 50% { opacity:.8; } }
    @keyframes bitiFall { 0% { transform: translateY(-8vh) rotate(0deg); opacity:1; } 90% { opacity:1; } 100% { transform: translateY(105vh) rotate(560deg); opacity:0; } }
    @keyframes bitiThink { 0%,80%,100% { opacity:.25; } 40% { opacity:1; } }
    @keyframes bitiRise { from { transform: translateY(14px); opacity:0; } to { transform: translateY(0); opacity:1; } }
    @keyframes bitiShake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-7%); } 55% { transform: translateX(7%); } 80% { transform: translateX(-4%); } }
    @keyframes bitiSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes bitiLand { 0% { transform: scale(1.14,0.82); } 45% { transform: scale(0.92,1.1); } 100% { transform: scale(1,1); } }
    @keyframes bitiPop { 0% { transform: scale(1) rotate(0deg); opacity:1; } 30% { transform: scale(1.18) rotate(16deg); opacity:1; } 100% { transform: scale(0) rotate(300deg); opacity:0; } }
    @keyframes bitiBurst { 0% { transform: translate(-50%,-50%) scale(.4) rotate(0deg); opacity:1; } 100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1) rotate(180deg); opacity:0; } }
    @media (prefers-reduced-motion: reduce) {
      .biti-anim, .biti-anim * { animation: none !important; transition: none !important; }
      .biti-anim .biti-dead { opacity: 0 !important; }
    }
  `;

  const pageBg = { background: "radial-gradient(130% 95% at 50% 12%, #4A2B1B 0%, #331C10 46%, #1B0D07 100%)" };
  const winnerName = game && game.winner && game.winner !== "draw" ? NAME_OF[game.avatars[game.winner]] : null;
  const inLobby = game && game.mode === "online" && game.phase === "lobby";

  return (
    <div className="biti-anim min-h-screen w-full text-amber-50 select-none overflow-hidden relative"
      style={{ ...pageBg, touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
      <style>{css}</style>
      <SvgDefs />

      {/* lantern glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: "130vw", height: "80vh", background: "radial-gradient(closest-side, rgba(255,190,90,.16), rgba(255,160,60,.05) 55%, transparent 75%)", animation: "bitiGlow 6s ease-in-out infinite" }} />

      {!game ? (
        <Menu
          av1={menuAv1} av2={menuAv2} setAv1={setMenuAv1} setAv2={setMenuAv2}
          onStart={startGame} onRules={() => setShowRules(true)}
          onCreateRoom={createRoom} onJoinRoom={joinRoom} onlineBusy={onlineBusy}
        />
      ) : inLobby ? (
        <Lobby game={game} onCancel={toMenu} />
      ) : (
        <GameScreen
          game={game} selected={selected} legal={legalForSelected} movable={movable}
          aiBusy={aiBusy} isHumanTurn={isHumanTurn} shake={shake} lastMoved={lastMoved}
          bursts={bursts} myP={myPlayer(game)}
          onPiece={(pos) => tapPiece(pos, false)}
          onGrab={(pos) => tapPiece(pos, true)}
          onTarget={tapTarget}
          onTick={() => play("tick")}
          onSpring={() => play("back")}
          onEndTurn={humanEndTurn}
          onUndo={undo} onMenu={toMenu}
          sound={sound} onSound={() => setSound((s) => !s)}
          onRules={() => setShowRules(true)} onSettings={() => setShowSettings(true)}
        />
      )}

      {/* toast */}
      {toast && (
        <div key={toast.id} className="fixed left-1/2 top-16 -translate-x-1/2 z-40 px-4 py-2 rounded-full text-sm biti-display font-semibold text-center"
          style={{ background: "rgba(20,10,5,.88)", border: `1.5px solid ${CHALK}55`, color: CHALK, animation: "bitiRise .25s ease-out", maxWidth: "86vw" }}>
          {toast.msg}
        </div>
      )}

      {/* winner overlay */}
      {game && game.winner && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6" style={{ background: "rgba(12,6,3,.72)", backdropFilter: "blur(3px)" }}>
          <Confetti key={confettiKey} active={game.winner !== "draw"} />
          <div className="relative w-full max-w-xs rounded-3xl p-6 text-center" style={{ background: "linear-gradient(180deg,#3d2314,#26140b)", border: `2px solid ${CHALK}44`, animation: "bitiRise .35s ease-out" }}>
            <div className="text-6xl mb-2">{game.winner === "draw" ? "🤝" : game.avatars[game.winner]}</div>
            <div className="biti-display text-3xl font-extrabold" style={{ color: CHALK }}>
              {game.winner === "draw" ? "It's a tie!" : `${winnerName} wins!`}
            </div>
            <div className="mt-1 text-sm text-amber-200/80">
              {game.reason === "captured" && "Every stone captured — champion of the courtyard! 🎉"}
              {game.reason === "blocked" && "The other side has no moves left!"}
              {game.reason === "quiet" && "The stones went quiet — most stones wins."}
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {[1, 2].map((pl) => (
                <div key={pl} className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: "rgba(255,243,220,.08)" }}>
                  <StoneSVG player={pl} className="w-5 h-5" shadow={false} />
                  <span className="text-sm font-bold">{countOf(game.board, pl)}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button onClick={rematch}
                className="biti-display font-bold text-lg py-2.5 rounded-full active:scale-95 transition-transform"
                style={{ background: "linear-gradient(180deg,#FFD37A,#F0A32C)", color: "#4a2400", boxShadow: "0 4px 12px rgba(0,0,0,.4)" }}>
                Play again
              </button>
              <button onClick={toMenu} className="biti-display font-semibold py-2 rounded-full"
                style={{ border: `1.5px solid ${CHALK}55`, color: CHALK }}>
                Back to menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* rules modal */}
      {showRules && (
        <Modal onClose={() => setShowRules(false)} title="How to play">
          <RuleRow icon="✨" title="Glow" text="Stones with a soft glow can move right now." />
          <RuleRow icon="🖐️" title="Grab" text="Drag a stone with your finger and drop it on a sparkly spot — or tap it, then tap the spot." />
          <RuleRow icon="🦘" title="Jump" text="Leap over the other player's stone to the empty spot right behind it — that stone is yours! Keep jumping if you can." />
          <RuleRow icon="🏆" title="Win" text="Capture all 12 of the other player's stones to win the courtyard." />
          <div className="mt-1 text-xs text-amber-200/70 text-center">Stones move in any direction — but only along the chalk lines.</div>
        </Modal>
      )}

      {/* settings modal */}
      {showSettings && (
        <Modal onClose={() => setShowSettings(false)} title="Settings">
          <ToggleRow label="Sounds" sub="Pops, plinks and cheers" value={sound} onChange={() => setSound((s) => !s)} />
          <ToggleRow label="Must jump" sub="Village rule: if you can capture, you have to" value={mustCapture} onChange={() => setMustCapture((v) => !v)} />
          {game && game.mode === "online" && (
            <div className="text-xs text-amber-200/60 text-center">Far-away games always use friendly rules.</div>
          )}
        </Modal>
      )}
    </div>
  );
}

/* ================= Menu ================= */
function Menu({ av1, av2, setAv1, setAv2, onStart, onRules, onCreateRoom, onJoinRoom, onlineBusy }) {
  const [mode, setMode] = useState("pvp");
  const [code, setCode] = useState("");
  const primaryBtn = { background: "linear-gradient(180deg,#FFD37A,#F0A32C)", color: "#4a2400", boxShadow: "0 5px 16px rgba(0,0,0,.45)" };
  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-8 gap-4" style={{ animation: "bitiRise .4s ease-out" }}>
      <div className="text-center">
        <div className="flex items-end justify-center gap-2">
          <StoneSVG player={1} face="idle" blinkDelay="0.8s" className="w-12 h-12 mb-2 -rotate-6" />
          <h1 className="biti-display font-extrabold leading-none" style={{ fontSize: "4.2rem", color: CHALK, textShadow: "0 3px 0 rgba(0,0,0,.35)", transform: "rotate(-2deg)" }}>
            12 Biti
          </h1>
          <StoneSVG player={2} face="idle" blinkDelay="2.3s" className="w-12 h-12 mb-2 rotate-6" />
        </div>
        <div className="biti-display text-amber-200/90 font-semibold tracking-wide mt-1">Bara Tehni · the stone-jumping game</div>
        <div className="text-sm text-amber-200/60 mt-1">A game from Dad's childhood ✨</div>
      </div>

      {/* mode picker */}
      <div className="flex rounded-full p-1 gap-1" style={{ background: "rgba(255,243,220,.08)", border: `1.5px solid ${CHALK}33` }}>
        {[["pvp", "🤝 Together"], ["ai", "🤖 Computer"], ["online", "🌐 Far away"]].map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className="biti-display font-bold px-3 py-2 rounded-full text-sm transition-colors"
            style={mode === m ? { background: CHALK, color: "#4a2400" } : { color: CHALK }}>
            {label}
          </button>
        ))}
      </div>

      {/* avatar pickers */}
      <div className="w-full max-w-xs flex flex-col gap-3">
        <AvatarPick label={mode === "pvp" ? "Marigold player" : "Your stone friend"} chosen={av1} onPick={setAv1} ring={MARIGOLD} />
        {mode === "pvp" && <AvatarPick label="Peacock player" chosen={av2} onPick={setAv2} ring={PEACOCK} />}
      </div>

      {/* start controls */}
      {mode === "pvp" && (
        <button onClick={() => onStart("pvp")}
          className="biti-display font-extrabold text-xl px-10 py-3 rounded-full active:scale-95 transition-transform" style={primaryBtn}>
          Draw the board! ✏️
        </button>
      )}
      {mode === "ai" && (
        <div className="flex gap-2">
          {[["easy", "🌱 Gentle"], ["medium", "🌶️ Clever"], ["hard", "🔥 Fierce"]].map(([lv, label]) => (
            <button key={lv} onClick={() => onStart("ai", lv)}
              className="biti-display font-bold px-4 py-2.5 rounded-full active:scale-95 transition-transform" style={primaryBtn}>
              {label}
            </button>
          ))}
        </div>
      )}
      {mode === "online" && (hasStorage ? (
        <div className="w-full max-w-xs flex flex-col gap-3 items-center">
          <button onClick={onCreateRoom} disabled={onlineBusy}
            className="biti-display font-extrabold text-lg px-8 py-3 rounded-full active:scale-95 transition-transform w-full"
            style={{ ...primaryBtn, opacity: onlineBusy ? 0.6 : 1 }}>
            {onlineBusy ? "Setting up…" : "Make a room 🏡"}
          </button>
          <div className="text-xs text-amber-200/60 biti-display font-semibold">— or join a friend's room —</div>
          <div className="flex gap-2 w-full">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
              placeholder="CODE"
              autoCapitalize="characters" autoCorrect="off" spellCheck={false}
              className="flex-1 min-w-0 rounded-2xl px-4 py-3 text-center biti-display font-extrabold text-2xl tracking-widest"
              style={{ background: "rgba(0,0,0,.3)", border: `2px dashed ${CHALK}66`, color: CHALK, letterSpacing: "0.35em", outline: "none" }}
            />
            <button onClick={() => onJoinRoom(code)} disabled={onlineBusy || code.length !== 4}
              className="biti-display font-bold px-5 rounded-2xl active:scale-95 transition-transform"
              style={{ ...primaryBtn, opacity: onlineBusy || code.length !== 4 ? 0.5 : 1 }}>
              Join
            </button>
          </div>
          <div className="text-xs text-amber-200/60 text-center leading-snug">
            One player makes a room and reads the 4 letters aloud (or texts them). The other joins from the same game link — any distance!
          </div>
        </div>
      ) : (
        <div className="w-full max-w-xs text-center text-sm text-amber-200/70 rounded-2xl px-4 py-3" style={{ border: `1.5px dashed ${CHALK}44` }}>
          Far-away rooms work on the Claude game link. This copy is perfect for playing together on one screen, or against the computer. 💛
        </div>
      ))}

      <button onClick={onRules} className="biti-display text-amber-200/80 underline underline-offset-4 text-sm">
        How to play?
      </button>
    </div>
  );
}

function AvatarPick({ label, chosen, onPick, ring }) {
  return (
    <div className="rounded-2xl px-3 py-2.5" style={{ background: "rgba(255,243,220,.06)", border: `1.5px solid ${CHALK}22` }}>
      <div className="text-xs text-amber-200/70 mb-1.5 biti-display font-semibold">{label}</div>
      <div className="flex justify-between">
        {AVATARS.map((a) => (
          <button key={a} onClick={() => onPick(a)}
            className="w-10 h-10 rounded-full text-xl flex items-center justify-center transition-transform active:scale-90"
            style={chosen === a ? { background: "rgba(255,243,220,.14)", boxShadow: `0 0 0 2.5px ${ring}` } : {}}>
            {a}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ================= Lobby (online host waiting) ================= */
function Lobby({ game, onCancel }) {
  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 gap-5 text-center" style={{ animation: "bitiRise .35s ease-out" }}>
      <div className="text-5xl">{game.avatars[1]}</div>
      <div className="biti-display font-extrabold text-2xl" style={{ color: CHALK }}>Your room is ready!</div>
      <div className="flex gap-2">
        {game.code.split("").map((ch, i) => (
          <div key={i} className="w-14 h-16 rounded-2xl flex items-center justify-center biti-display font-extrabold text-4xl"
            style={{ background: "rgba(0,0,0,.32)", border: `2.5px dashed ${CHALK}88`, color: CHALK }}>
            {ch}
          </div>
        ))}
      </div>
      <div className="text-sm text-amber-200/75 leading-relaxed" style={{ maxWidth: 300 }}>
        Tell your friend these 4 letters. They open this same game, tap <b>🌐 Far away → Join</b>, and type them in.
      </div>
      <div className="biti-display font-semibold text-amber-200/80">
        Waiting for a friend
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ animation: `bitiThink 1.1s ${i * 0.18}s infinite` }}>.</span>
        ))}
      </div>
      <button onClick={onCancel} className="biti-display font-semibold px-6 py-2 rounded-full"
        style={{ border: `1.5px solid ${CHALK}55`, color: CHALK }}>
        Cancel
      </button>
    </div>
  );
}

/* ================= Game screen ================= */
function GameScreen({ game, selected, legal, movable, aiBusy, isHumanTurn, shake, lastMoved, bursts, myP, onPiece, onGrab, onTarget, onTick, onSpring, onEndTurn, onUndo, onMenu, sound, onSound, onRules, onSettings }) {
  const capturedBy = (pl) => 12 - countOf(game.board, 3 - pl);
  const online = game.mode === "online";
  const topP = 3 - (online ? myP : 1);
  const bottomP = online ? myP : 1;
  const flip = online && myP === 2;
  return (
    <div className="relative z-10 min-h-screen flex flex-col px-3 py-3 gap-2 max-w-md mx-auto" style={{ animation: "bitiRise .35s ease-out" }}>
      {/* top bar */}
      <div className="flex items-center justify-between">
        <button onClick={onMenu} aria-label="Back to menu" className="biti-display font-bold text-sm px-3 py-1.5 rounded-full" style={{ border: `1.5px solid ${CHALK}44`, color: CHALK }}>
          {online ? "⌂ Leave" : "⌂ Menu"}
        </button>
        <div className="biti-display font-extrabold text-lg" style={{ color: CHALK, transform: "rotate(-1.5deg)" }}>
          12 Biti{online && <span className="text-xs font-bold text-amber-200/70 ml-1.5">🌐 {game.code}</span>}
        </div>
        <div className="flex gap-1.5">
          <IconBtn label="Rules" onClick={onRules}>?</IconBtn>
          <IconBtn label="Sound" onClick={onSound}>{sound ? "🔊" : "🔇"}</IconBtn>
          <IconBtn label="Settings" onClick={onSettings}>⚙</IconBtn>
        </div>
      </div>

      <PlayerCard game={game} pl={topP} aiBusy={aiBusy} captured={capturedBy(topP)} online={online} myP={myP} />

      <div className="flex-1 flex items-center justify-center min-h-0">
        <Board game={game} selected={selected} legal={legal} movable={movable} shake={shake}
          lastMoved={lastMoved} bursts={bursts} flip={flip}
          onPiece={onPiece} onGrab={onGrab} onTarget={onTarget} onTick={onTick} onSpring={onSpring}
          interactive={isHumanTurn} />
      </div>

      {/* status row */}
      <div className="h-11 flex items-center justify-center gap-2">
        {game.chain != null && isHumanTurn ? (
          <>
            <span className="biti-display font-bold text-amber-200 text-sm">Jump again? 🦘</span>
            <button onClick={onEndTurn} className="biti-display font-bold text-sm px-4 py-1.5 rounded-full active:scale-95 transition-transform"
              style={{ background: CHALK, color: "#4a2400" }}>
              End turn ✋
            </button>
          </>
        ) : online ? (
          <span className="biti-display font-semibold text-sm text-amber-200/70">
            {isHumanTurn ? "Your move — grab a glowing stone ✨" : "Waiting for " + (NAME_OF[game.avatars[topP]] || "your friend") + "…"}
          </span>
        ) : (
          <button onClick={onUndo} disabled={!game.history.length || aiBusy}
            className="biti-display font-bold text-sm px-4 py-1.5 rounded-full transition-opacity active:scale-95"
            style={{ border: `1.5px solid ${CHALK}55`, color: CHALK, opacity: !game.history.length || aiBusy ? 0.35 : 1 }}>
            ↺ Undo
          </button>
        )}
      </div>

      <PlayerCard game={game} pl={bottomP} aiBusy={aiBusy} captured={capturedBy(bottomP)} online={online} myP={myP} />
    </div>
  );
}

function IconBtn({ children, onClick, label }) {
  return (
    <button onClick={onClick} aria-label={label}
      className="w-9 h-9 rounded-full flex items-center justify-center text-sm biti-display font-bold active:scale-90 transition-transform"
      style={{ border: `1.5px solid ${CHALK}44`, color: CHALK }}>
      {children}
    </button>
  );
}

function PlayerCard({ game, pl, aiBusy, captured, online, myP }) {
  const active = game.current === pl && !game.winner;
  const ring = pl === 1 ? MARIGOLD : PEACOCK;
  const isAi = game.mode === "ai" && pl === 2;
  const isRemote = online && pl !== myP;
  const sub = !active
    ? "waiting…"
    : isAi ? "thinking"
    : isRemote ? "playing far away 🌐"
    : game.chain != null ? "keep jumping!" : "your turn ✨";
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-2xl transition-shadow"
      style={{
        background: "linear-gradient(180deg, rgba(255,243,220,.07), rgba(255,243,220,.03))",
        border: `1.5px solid ${active ? ring : CHALK + "1e"}`,
        boxShadow: active ? `0 0 16px ${ring}55` : "none",
      }}>
      <div className="relative">
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-2xl" style={{ background: "rgba(0,0,0,.28)", boxShadow: `0 0 0 2.5px ${ring}` }}>
          {game.avatars[pl] || "❔"}
        </div>
        <StoneSVG player={pl} className="w-5 h-5 absolute -bottom-1 -right-1" shadow={false} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="biti-display font-extrabold leading-tight" style={{ color: CHALK }}>
          {NAME_OF[game.avatars[pl]] || "Friend"}
          {online && pl === myP && <span className="text-xs font-bold text-amber-200/60 ml-1">(you)</span>}
        </div>
        <div className="text-xs text-amber-200/70 biti-display font-semibold">
          {sub}
          {active && (isAi ? aiBusy : isRemote) && [0, 1, 2].map((i) => (
            <span key={i} style={{ animation: `bitiThink 1.1s ${i * 0.18}s infinite` }}>.</span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {captured > 0 && Array.from({ length: Math.min(captured, 6) }).map((_, i) => (
          <StoneSVG key={i} player={3 - pl} className="w-4 h-4" shadow={false} style={{ marginLeft: i ? -8 : 0 }} />
        ))}
        {captured > 0 && <span className="text-xs font-bold text-amber-200/85 ml-0.5">{captured}</span>}
      </div>
    </div>
  );
}

/* ================= Board (with drag & drop) ================= */
function Board({ game, selected, legal, movable, shake, lastMoved, bursts, flip, onPiece, onGrab, onTarget, onTick, onSpring, interactive }) {
  const boardRef = useRef(null);
  const info = useRef(null); // {id, home, moved, over}
  const [drag, setDrag] = useState(null); // {id, x, y, over}

  const targets = new Map(legal.map((m) => [m.to, m]));
  const grid = [10, 30, 50, 70, 90];
  const XY = (i) => {
    const [r, c] = RC(i);
    let x = 10 + c * 20, y = 10 + r * 20;
    if (flip) { x = 100 - x; y = 100 - y; }
    return { x, y };
  };
  const toPct = (e) => {
    const el = boardRef.current;
    if (!el) return { x: 50, y: 50 };
    const r = el.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };
  const hitTarget = (p) => {
    for (const m of legal) {
      const t = XY(m.to);
      if (Math.hypot(p.x - t.x, p.y - t.y) < 9.5) return m;
    }
    return null;
  };

  const startDrag = (e, pc) => {
    if (!interactive || !pc.alive) return;
    e.preventDefault();
    if (!onGrab(pc.pos)) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    const p = toPct(e);
    info.current = { id: pc.id, home: pc.pos, moved: false, over: null };
    setDrag({ id: pc.id, x: p.x, y: p.y, over: null });
  };
  const moveDrag = (e) => {
    const d = info.current;
    if (!d) return;
    const p = toPct(e);
    const home = XY(d.home);
    if (Math.hypot(p.x - home.x, p.y - home.y) > 4) d.moved = true;
    const over = hitTarget(p);
    const overTo = over ? over.to : null;
    if (overTo !== d.over) { d.over = overTo; if (over) onTick(); }
    setDrag({ id: d.id, x: p.x, y: p.y, over: overTo });
  };
  const endDrag = (e) => {
    const d = info.current;
    if (!d) return;
    info.current = null;
    const p = toPct(e);
    const over = hitTarget(p);
    setDrag(null);
    if (over) onTarget(over);
    else if (d.moved) onSpring();
  };

  return (
    <div ref={boardRef} className="relative w-full" style={{ maxWidth: 420, aspectRatio: "1 / 1" }}>
      {/* swept-earth patch + chalk drawing */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <defs>
          <radialGradient id="bitiGround" cx="50%" cy="42%" r="75%">
            <stop offset="0%" stopColor="#6E4128" />
            <stop offset="60%" stopColor="#59331E" />
            <stop offset="100%" stopColor="#3F2213" />
          </radialGradient>
          <filter id="bitiGrain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="linear" slope="0.06" /></feComponentTransfer>
            <feComposite operator="in" in2="SourceGraphic" />
          </filter>
        </defs>

        <rect x="1" y="1" width="98" height="98" rx="9" fill="url(#bitiGround)" />
        <rect x="1" y="1" width="98" height="98" rx="9" fill="#fff" filter="url(#bitiGrain)" />
        <g stroke="#000" strokeOpacity="0.06" strokeWidth="5" fill="none" strokeLinecap="round">
          <path d="M 8 26 Q 50 18 92 28" />
          <path d="M 6 52 Q 50 44 94 54" />
          <path d="M 9 78 Q 50 70 91 80" />
        </g>
        <rect x="1.8" y="1.8" width="96.4" height="96.4" rx="8.4" fill="none" stroke="#000" strokeOpacity="0.3" strokeWidth="1.8" />

        {/* rangoli corner flowers */}
        <g filter="url(#bitiChalk)">
          {[[5.5, 5.5], [94.5, 5.5], [5.5, 94.5], [94.5, 94.5]].map(([cx, cy], k) => (
            <g key={k} opacity="0.55">
              <circle cx={cx} cy={cy} r="1.4" fill={ROSE} />
              {[0, 60, 120, 180, 240, 300].map((a) => (
                <circle key={a}
                  cx={cx + 3.1 * Math.cos((a * Math.PI) / 180)}
                  cy={cy + 3.1 * Math.sin((a * Math.PI) / 180)}
                  r="1" fill={k % 2 ? PEACOCK : MARIGOLD} />
              ))}
            </g>
          ))}
        </g>

        {/* chalk-dust under-stroke */}
        <g stroke={CHALK} strokeOpacity="0.16" strokeWidth="3.4" strokeLinecap="round" filter="url(#bitiChalk)" fill="none">
          <ChalkLines grid={grid} />
        </g>
        {/* chalk lines */}
        <g stroke={CHALK} strokeOpacity="0.95" strokeWidth="1.35" strokeLinecap="round" filter="url(#bitiChalk)" fill="none">
          <ChalkLines grid={grid} />
        </g>
        {/* intersection dots */}
        <g fill={CHALK} filter="url(#bitiChalk)">
          {grid.map((y) => grid.map((x) => <circle key={x + "-" + y} cx={x} cy={y} r="1.15" opacity="0.9" />))}
        </g>
      </svg>

      {/* movable-stone halos */}
      {interactive && selected == null && [...movable].map((pos) => {
        const { x, y } = XY(pos);
        return (
          <div key={"h" + pos} className="absolute rounded-full pointer-events-none"
            style={{
              left: x + "%", top: y + "%", width: "17%", height: "17%",
              transform: "translate(-50%,-50%)",
              background: `radial-gradient(closest-side, ${CHALK}66, transparent 72%)`,
              animation: "bitiHalo 1.6s ease-in-out infinite",
            }} />
        );
      })}

      {/* target markers */}
      {interactive && [...targets.values()].map((m) => {
        const { x, y } = XY(m.to);
        const cap = m.captured != null;
        const hot = drag && drag.over === m.to;
        return (
          <button key={"t" + m.to} {...press(() => onTarget(m))} aria-label={cap ? "Jump here" : "Move here"}
            className="absolute z-20"
            style={{ left: x + "%", top: y + "%", width: "16%", height: "16%", transform: "translate(-50%,-50%)", background: "transparent" }}>
            <span className="rounded-full flex items-center justify-center"
              style={{
                width: (cap ? 78 : 48) * (hot ? 1.25 : 1) + "%",
                height: (cap ? 78 : 48) * (hot ? 1.25 : 1) + "%",
                position: "absolute", left: "50%", top: "50%",
                transform: "translate(-50%,-50%)",
                background: cap ? (hot ? "rgba(249,115,182,.32)" : "rgba(249,115,182,.16)") : (hot ? "rgba(255,243,220,.4)" : "rgba(255,243,220,.22)"),
                border: cap ? `${hot ? 3 : 2.5}px ${hot ? "solid" : "dashed"} ${ROSE}` : `${hot ? 3 : 2.5}px ${hot ? "solid" : "dashed"} ${CHALK}`,
                animation: "bitiDot 1.1s ease-in-out infinite",
              }}>
              {cap ? (
                <svg viewBox="0 0 24 24" style={{ width: "58%", height: "58%", animation: "bitiSpin 5s linear infinite" }}>
                  <path d="M12 2 L14 9 L21 12 L14 15 L12 22 L10 15 L3 12 L10 9 Z" fill={ROSE} opacity="0.95" />
                  <circle cx="12" cy="12" r="2.2" fill="#FFE1EF" />
                </svg>
              ) : (
                <span className="rounded-full" style={{ width: 7, height: 7, background: CHALK }} />
              )}
            </span>
          </button>
        );
      })}

      {/* capture star-bursts */}
      {bursts.map((bu) => {
        const { x, y } = XY(bu.pos);
        const cols = bu.player === 1 ? [MARIGOLD, "#FFE3A1", ROSE] : [PEACOCK, "#B8FFF2", ROSE];
        return (
          <div key={bu.key} className="absolute pointer-events-none" style={{ left: x + "%", top: y + "%", width: 0, height: 0, zIndex: 25 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const a = ((i * 60 + 15) * Math.PI) / 180;
              return (
                <span key={i} className="absolute rounded-full"
                  style={{
                    left: 0, top: 0, width: 9, height: 9, background: cols[i % 3],
                    "--dx": Math.cos(a) * 36 + "px", "--dy": Math.sin(a) * 36 + "px",
                    animation: "bitiBurst .65s ease-out forwards",
                  }} />
              );
            })}
          </div>
        );
      })}

      {/* character stones */}
      {game.pieces.map((pc) => {
        const dragging = drag && drag.id === pc.id;
        const { x, y } = dragging ? { x: drag.x, y: drag.y } : XY(pc.pos);
        const isSel = selected === pc.pos && pc.alive && game.board[pc.pos] === pc.player;
        const ring = pc.player === 1 ? "#FFE3A1" : "#B8FFF2";
        const shaking = shake && shake.pos === pc.pos && pc.alive;
        const landed = lastMoved && lastMoved.id === pc.id && pc.alive;
        const face = !pc.alive ? "dizzy" : (isSel || dragging ? "wide" : "idle");
        const blinkDelay = ((parseInt(pc.id.slice(1), 10) * 0.53) % 4).toFixed(2) + "s";
        const spanKey = shaking ? "sh" + shake.key : landed ? "ld" + lastMoved.key : "st";
        return (
          <button key={pc.id}
            onPointerDown={(e) => startDrag(e, pc)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClick={(e) => { if (e.detail === 0 && pc.alive) onPiece(pc.pos); }}
            aria-label={pc.player === 1 ? "Marigold stone" : "Peacock stone"}
            className="absolute"
            style={{
              left: x + "%", top: y + "%", width: "13%", height: "13%",
              transform: `translate(-50%,-50%) scale(${dragging ? 1.18 : 1})`,
              zIndex: dragging ? 30 : 10,
              transition: dragging ? "none" : "left .3s ease, top .3s ease, transform .25s ease",
              pointerEvents: pc.alive && interactive ? "auto" : "none",
              background: "transparent",
              borderRadius: "50%",
              ...(isSel && !dragging ? { animation: "bitiPulse 1s ease-in-out infinite" } : {}),
            }}>
            <span key={spanKey}
              className={"block w-full h-full" + (!pc.alive ? " biti-dead" : "")}
              style={{
                animation: shaking ? "bitiShake .38s ease"
                  : !pc.alive ? "bitiPop .55s ease forwards"
                  : landed ? "bitiLand .34s .24s ease both" : "none",
                filter: isSel || dragging ? `drop-shadow(0 0 6px ${ring}) drop-shadow(0 0 12px ${ring})` : "none",
              }}>
              <StoneSVG player={pc.player} face={face} blinkDelay={blinkDelay} className="w-full h-full" />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ChalkLines({ grid }) {
  return (
    <>
      {grid.map((y) => <line key={"h" + y} x1="10" y1={y} x2="90" y2={y} />)}
      {grid.map((x) => <line key={"v" + x} x1={x} y1="10" x2={x} y2="90" />)}
      <line x1="10" y1="10" x2="90" y2="90" />
      <line x1="90" y1="10" x2="10" y2="90" />
      <path d="M 50 10 L 90 50 L 50 90 L 10 50 Z" />
    </>
  );
}

/* ================= Bits ================= */
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(12,6,3,.7)", backdropFilter: "blur(3px)" }} onClick={onClose}>
      <div className="w-full max-w-xs rounded-3xl p-5" onClick={(e) => e.stopPropagation()}
        style={{ background: "linear-gradient(180deg,#3d2314,#26140b)", border: `2px solid ${CHALK}44`, animation: "bitiRise .3s ease-out" }}>
        <div className="biti-display font-extrabold text-2xl mb-3 text-center" style={{ color: CHALK }}>{title}</div>
        <div className="flex flex-col gap-3">{children}</div>
        <button onClick={onClose} className="mt-4 w-full biti-display font-bold py-2.5 rounded-full active:scale-95 transition-transform"
          style={{ background: "linear-gradient(180deg,#FFD37A,#F0A32C)", color: "#4a2400" }}>
          Got it!
        </button>
      </div>
    </div>
  );
}

function RuleRow({ icon, title, text }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="text-2xl leading-none mt-0.5">{icon}</div>
      <div>
        <div className="biti-display font-bold" style={{ color: CHALK }}>{title}</div>
        <div className="text-sm text-amber-100/80 leading-snug">{text}</div>
      </div>
    </div>
  );
}

function ToggleRow({ label, sub, value, onChange }) {
  return (
    <button onClick={onChange} className="flex items-center justify-between gap-3 w-full text-left">
      <div>
        <div className="biti-display font-bold" style={{ color: CHALK }}>{label}</div>
        <div className="text-xs text-amber-200/65">{sub}</div>
      </div>
      <div className="w-12 h-7 rounded-full p-1 transition-colors shrink-0" style={{ background: value ? "#F0A32C" : "rgba(255,243,220,.15)" }}>
        <div className="w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: value ? "translateX(20px)" : "translateX(0)" }} />
      </div>
    </button>
  );
}

function Confetti({ active }) {
  const bits = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.9,
    dur: 2.4 + Math.random() * 1.8,
    size: 6 + Math.random() * 8,
    round: Math.random() > 0.5,
    color: [MARIGOLD, PEACOCK, ROSE, CHALK, "#A78BFA"][i % 5],
  })), []);
  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {bits.map((b) => (
        <span key={b.id} className="absolute"
          style={{
            left: b.left + "%", top: "-4vh",
            width: b.size, height: b.round ? b.size : b.size * 0.55,
            background: b.color, borderRadius: b.round ? "50%" : "2px",
            animation: `bitiFall ${b.dur}s ${b.delay}s ease-in forwards`,
          }} />
      ))}
    </div>
  );
}
