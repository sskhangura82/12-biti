import React, { useEffect, useMemo, useRef, useState } from "react";

/* ================================================================
   X · O — chalk tic-tac-toe from the courtyard
   Two variants:
     · Classic — the schoolyard original
     · Blitz — each player keeps only 3 marks; placing a 4th makes
       the oldest vanish. No draws. Pure excitement.
   Best-of-5 rounds · pass-and-play · 3 computer levels · far-away
   rooms over shared storage. Same dusk-courtyard family as 12 Biti.
   ================================================================ */

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const CHALK = "#FFF3DC";
const MARIGOLD = "#FFC24B";
const PEACOCK = "#2DD4BF";
const ROSE = "#F973B6";
const AVATARS = ["🐯", "🦚", "🐘", "🦋", "🐒", "⭐"];
const NAME_OF = { "🐯": "Tiger", "🦚": "Peacock", "🐘": "Elephant", "🦋": "Butterfly", "🐒": "Monkey", "⭐": "Star", "🤖": "Computer" };
const SERIES_TO = 3;

/* ---------- pure game logic ---------- */
function emptyRound() {
  return { board: Array(9).fill(0), order: { 1: [], 2: [] } };
}
function findWin(board, pl) {
  for (const L of LINES) if (L.every((i) => board[i] === pl)) return L;
  return null;
}
/* apply a placement (with blitz vanish); returns {board, order, vanished} */
function applyPlace(board, order, pl, i, blitz) {
  const b = board.slice();
  const o = { 1: order[1].slice(), 2: order[2].slice() };
  b[i] = pl;
  o[pl].push(i);
  let vanished = null;
  if (blitz && o[pl].length > 3) {
    vanished = o[pl].shift();
    b[vanished] = 0;
  }
  return { board: b, order: o, vanished };
}
function legalCells(board) {
  const res = [];
  for (let i = 0; i < 9; i++) if (board[i] === 0) res.push(i);
  return res;
}

/* ---------- AI ---------- */
function ttMinimax(board, order, player, ai, blitz, depth, alpha, beta) {
  const cells = legalCells(board);
  if (!cells.length) return 0; // classic draw (blitz never fills)
  if (depth <= 0) return ttEval(board, ai);
  let best = player === ai ? -Infinity : Infinity;
  for (const c of cells) {
    const { board: b2, order: o2 } = applyPlace(board, order, player, c, blitz);
    let v;
    if (findWin(b2, player)) v = player === ai ? 100 + depth : -(100 + depth);
    else v = ttMinimax(b2, o2, 3 - player, ai, blitz, depth - 1, alpha, beta);
    if (player === ai) { if (v > best) best = v; if (v > alpha) alpha = v; }
    else { if (v < best) best = v; if (v < beta) beta = v; }
    if (beta <= alpha) break;
  }
  return best;
}
function ttEval(board, ai) {
  let s = 0;
  for (const L of LINES) {
    const mine = L.filter((i) => board[i] === ai).length;
    const theirs = L.filter((i) => board[i] === 3 - ai).length;
    if (theirs === 0) s += mine * mine;
    if (mine === 0) s -= theirs * theirs;
  }
  if (board[4] === ai) s += 1.5;
  return s;
}
function chooseAi(board, order, level, blitz) {
  const cells = legalCells(board);
  if (!cells.length) return null;
  const winNow = cells.find((c) => findWin(applyPlace(board, order, 2, c, blitz).board, 2));
  const blockNow = cells.find((c) => findWin(applyPlace(board, order, 1, c, blitz).board, 1));
  if (level === "easy") {
    if (winNow != null && Math.random() < 0.5) return winNow;
    return cells[Math.floor(Math.random() * cells.length)];
  }
  if (level === "medium") {
    if (winNow != null) return winNow;
    if (blockNow != null && Math.random() < 0.85) return blockNow;
    if (Math.random() < 0.2) return cells[Math.floor(Math.random() * cells.length)];
    const pref = [4, 0, 2, 6, 8, 1, 3, 5, 7].filter((c) => cells.includes(c));
    return pref[0];
  }
  // fierce: full search (classic is solved; blitz searched deep)
  const depth = blitz ? 7 : 9;
  let best = -Infinity, pick = cells[0];
  for (const c of cells) {
    const { board: b2, order: o2 } = applyPlace(board, order, 2, c, blitz);
    let v;
    if (findWin(b2, 2)) v = 100 + depth;
    else v = ttMinimax(b2, o2, 1, 2, blitz, depth - 1, -Infinity, Infinity);
    v += Math.random() * 0.01;
    if (v > best) { best = v; pick = c; }
  }
  return pick;
}

/* ---------- online rooms (Claude shared storage) ---------- */
const hasStorage =
  typeof window !== "undefined" && window.storage &&
  typeof window.storage.get === "function" && typeof window.storage.set === "function";
const ROOM_ALPHA = "ABCDEFGHJKLMNPRSTUVWXYZ";
const makeCode = () => Array.from({ length: 4 }, () => ROOM_ALPHA[Math.floor(Math.random() * ROOM_ALPHA.length)]).join("");
const roomKey = (code) => "ttt:room:" + code;
async function roomGet(code) {
  try { const r = await window.storage.get(roomKey(code), true); return r && r.value ? JSON.parse(r.value) : null; }
  catch (e) { return null; }
}
async function roomSet(code, obj) {
  try { const r = await window.storage.set(roomKey(code), JSON.stringify(obj), true); return !!r; }
  catch (e) { return false; }
}
function serializeRoom(g) {
  return {
    v: 1, seq: g.seq, phase: g.phase, t: Date.now(),
    hostAv: g.avatars[1], guestAv: g.avatars[2] || null, guestJoined: !!g.avatars[2],
    variant: g.variant, board: g.board, order: g.order, current: g.current,
    winner: g.winner, winLine: g.winLine, score: g.score, round: g.round,
    roundStarter: g.roundStarter, champ: g.champ,
  };
}

/* ---------- sounds ---------- */
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
    const ctx = ctxRef.current; if (!ctx) return;
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
    const ctx = ctxRef.current; if (!ctx || !noiseRef.current) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = noiseRef.current;
    const flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
    src.connect(flt); flt.connect(g); g.connect(ctx.destination);
    src.start(t0);
  };
  const R = (f) => f * (0.94 + Math.random() * 0.12);
  const play = (kind) => {
    if (!enabledRef.current) return;
    try {
      ensure();
      if (kind === "x") { thock(0.18, 0, 560); tone(R(210), 0.09, "square", 0.07, 0.005); }
      else if (kind === "o") { tone(R(520), 0.09, "triangle", 0.1, 0, 640); thock(0.06, 0, 1800); }
      else if (kind === "vanish") { tone(R(700), 0.16, "sine", 0.06, 0, 180); }
      else if (kind === "round") { [659, 880, 1046].forEach((f, i) => tone(f, 0.12, "triangle", 0.09, i * 0.09)); thock(0.12, 0, 1200); }
      else if (kind === "draw") { tone(320, 0.14, "sine", 0.07, 0, 260); tone(260, 0.16, "sine", 0.06, 0.14, 210); }
      else if (kind === "champ") {
        [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.18, "triangle", 0.09, i * 0.1));
        [2093, 2637, 3136].forEach((f, i) => tone(f, 0.4, "sine", 0.03, 0.55 + i * 0.07));
      }
      else if (kind === "start") { tone(392, 0.09, "triangle", 0.08); tone(523, 0.09, "triangle", 0.08, 0.09); tone(659, 0.11, "triangle", 0.08, 0.18); }
      else if (kind === "turn") { tone(660, 0.07, "triangle", 0.08); tone(880, 0.08, "triangle", 0.07, 0.08); }
      else if (kind === "ui") thock(0.06, 0, 2200);
      else if (kind === "no") { tone(230, 0.07, "sawtooth", 0.045, 0, 175); }
    } catch (e) { /* optional */ }
  };
  return play;
}

const press = (fn) => ({
  onPointerDown: (e) => { e.preventDefault(); fn(); },
  onClick: (e) => { if (e.detail === 0) fn(); },
});

/* ---------- character marks ---------- */
function MarkDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="tttX" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE3A1" />
          <stop offset="55%" stopColor="#FFB63B" />
          <stop offset="100%" stopColor="#C86F0C" />
        </linearGradient>
        <linearGradient id="tttO" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9FF3E4" />
          <stop offset="55%" stopColor="#20C3AE" />
          <stop offset="100%" stopColor="#075E54" />
        </linearGradient>
        <filter id="tttSoft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <filter id="tttChalk" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.9" />
        </filter>
      </defs>
    </svg>
  );
}

function Face({ y = 46, dark = "#5A2E02", wide = false, dizzy = false }) {
  if (dizzy) {
    return (
      <g stroke={dark} strokeWidth="4" strokeLinecap="round" opacity="0.9">
        <path d={`M 36 ${y - 8} L 44 ${y} M 44 ${y - 8} L 36 ${y}`} />
        <path d={`M 56 ${y - 8} L 64 ${y} M 64 ${y - 8} L 56 ${y}`} />
        <path d={`M 42 ${y + 14} Q 50 ${y + 8} 58 ${y + 14}`} fill="none" />
      </g>
    );
  }
  return (
    <g>
      <g className="ttt-blink">
        <ellipse cx="41" cy={y - 3} rx={wide ? 7 : 5.8} ry={wide ? 8.2 : 6.8} fill="#FFFDF5" />
        <ellipse cx="59" cy={y - 3} rx={wide ? 7 : 5.8} ry={wide ? 8.2 : 6.8} fill="#FFFDF5" />
        <circle cx="41.8" cy={y - 1.6} r={wide ? 3.4 : 2.8} fill="#241309" />
        <circle cx="59.8" cy={y - 1.6} r={wide ? 3.4 : 2.8} fill="#241309" />
        <circle cx="43" cy={y - 3.4} r="1.05" fill="#fff" />
        <circle cx="61" cy={y - 3.4} r="1.05" fill="#fff" />
      </g>
      {wide
        ? <path d={`M 42 ${y + 9} Q 50 ${y + 19} 58 ${y + 9} Q 50 ${y + 13.5} 42 ${y + 9} Z`} fill={dark} opacity="0.88" />
        : <path d={`M 43.5 ${y + 10} Q 50 ${y + 15.5} 56.5 ${y + 10}`} fill="none" stroke={dark} strokeWidth="3" strokeLinecap="round" opacity="0.85" />}
    </g>
  );
}

function XMark({ className = "", style = {}, mood = "idle" }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <ellipse cx="50" cy="86" rx="30" ry="7.5" fill="#000" opacity="0.35" filter="url(#tttSoft)" />
      <g>
        <rect x="8" y="38" width="84" height="24" rx="12" fill="url(#tttX)" transform="rotate(45 50 50)" />
        <rect x="8" y="38" width="84" height="24" rx="12" fill="url(#tttX)" transform="rotate(-45 50 50)" />
        <rect x="8" y="38" width="84" height="24" rx="12" fill="none" stroke="#7A3E04" strokeOpacity="0.45" strokeWidth="2" transform="rotate(45 50 50)" />
        <rect x="8" y="38" width="84" height="24" rx="12" fill="none" stroke="#7A3E04" strokeOpacity="0.45" strokeWidth="2" transform="rotate(-45 50 50)" />
      </g>
      <circle cx="50" cy="47" r="19" fill="url(#tttX)" stroke="#7A3E04" strokeOpacity="0.4" strokeWidth="2" />
      <Face y={49} dark="#6B3403" wide={mood === "wide"} dizzy={mood === "dizzy"} />
      <ellipse cx="36" cy="26" rx="9" ry="5.5" fill="#fff" opacity="0.5" transform="rotate(-40 36 26)" />
    </svg>
  );
}
function OMark({ className = "", style = {}, mood = "idle" }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <ellipse cx="50" cy="86" rx="30" ry="7.5" fill="#000" opacity="0.35" filter="url(#tttSoft)" />
      <circle cx="50" cy="49" r="35" fill="none" stroke="url(#tttO)" strokeWidth="17" />
      <circle cx="50" cy="49" r="43.5" fill="none" stroke="#03332E" strokeOpacity="0.4" strokeWidth="2" />
      <circle cx="50" cy="49" r="26.5" fill="none" stroke="#03332E" strokeOpacity="0.4" strokeWidth="2" />
      <circle cx="50" cy="49" r="26.5" fill="#0F9184" fillOpacity="0.14" />
      <Face y={50} dark="#03332E" wide={mood === "wide"} dizzy={mood === "dizzy"} />
      <ellipse cx="33" cy="24" rx="9" ry="5" fill="#fff" opacity="0.55" transform="rotate(-38 33 24)" />
    </svg>
  );
}
function Mark({ player, ...rest }) {
  return player === 1 ? <XMark {...rest} /> : <OMark {...rest} />;
}

/* ================================================================ */
export default function ChalkTicTacToe() {
  const [game, setGame] = useState(null);
  const [toast, setToast] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sound, setSound] = useState(true);
  const [menuAv1, setMenuAv1] = useState("🐯");
  const [menuAv2, setMenuAv2] = useState("🦚");
  const [confettiKey, setConfettiKey] = useState(0);
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [lastPlaced, setLastPlaced] = useState(null); // {pos, key}

  const soundRef = useRef(true); soundRef.current = sound;
  const gameRef = useRef(null); gameRef.current = game;
  const aiBusyRef = useRef(false);
  const pollBusyRef = useRef(false);
  const notifSeqRef = useRef(0);
  const play = useSounds(soundRef);

  const showToast = (msg) => setToast({ msg, id: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const myPlayer = (g) => (g && g.mode === "online" ? (g.role === "host" ? 1 : 2) : 1);
  const isHumanTurn = !!game && !game.winner && !game.champ && game.phase === "playing" &&
    (game.mode === "pvp" || game.current === myPlayer(game));

  /* ----- start ----- */
  function baseGame(mode, variant, extra = {}) {
    const r = emptyRound();
    return {
      gen: Date.now(), mode, variant, phase: "playing",
      board: r.board, order: r.order, current: 1,
      winner: null, winLine: null, champ: null,
      score: { 1: 0, 2: 0 }, round: 1, roundStarter: 1,
      ...extra,
    };
  }
  function startGame(mode, variant, level) {
    play("start");
    aiBusyRef.current = false;
    setLastPlaced(null);
    const av2 = mode === "ai" ? "🤖" : (menuAv2 !== menuAv1 ? menuAv2 : AVATARS.find((a) => a !== menuAv1));
    setGame(baseGame(mode, variant, { level: level || null, avatars: { 1: menuAv1, 2: av2 } }));
  }
  const toMenu = () => { setGame(null); aiBusyRef.current = false; };

  /* ----- online ----- */
  async function createRoom(variant) {
    if (onlineBusy) return;
    setOnlineBusy(true); play("start");
    const code = makeCode();
    const g = baseGame("online", variant, { role: "host", code, seq: 1, phase: "lobby", avatars: { 1: menuAv1, 2: null } });
    const ok = await roomSet(code, serializeRoom(g));
    setOnlineBusy(false);
    if (!ok) { showToast("Couldn't make a room — try again in a moment"); return; }
    notifSeqRef.current = 1;
    setLastPlaced(null);
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
      variant: r.variant, avatars: { 1: r.hostAv, 2: menuAv1 !== r.hostAv ? menuAv1 : AVATARS.find((a) => a !== r.hostAv) },
      board: r.board, order: r.order, current: r.current,
      winner: null, winLine: null, champ: null,
      score: r.score || { 1: 0, 2: 0 }, round: r.round || 1, roundStarter: r.roundStarter || 1,
      level: null,
    };
    const ok = await roomSet(code, serializeRoom(g));
    setOnlineBusy(false);
    if (!ok) { showToast("Couldn't join — try again"); return; }
    play("start");
    notifSeqRef.current = g.seq;
    setLastPlaced(null);
    setGame(g);
  }
  const markMine = (g) => { if (g.mode === "online") { g.seq = (g.seq || 0) + 1; g.mine = true; g.dirty = Date.now(); } return g; };

  /* ----- place a mark ----- */
  function place(i, byAi = false) {
    const g0 = gameRef.current;
    if (!g0 || g0.winner || g0.champ || g0.phase !== "playing") return;
    if (!byAi && !(g0.mode === "pvp" || g0.current === myPlayer(g0))) return;
    if (g0.board[i] !== 0) { if (!byAi) play("no"); return; }
    const pl = g0.current;
    const { vanished } = applyPlace(g0.board, g0.order, pl, i, g0.variant === "blitz");
    play(pl === 1 ? "x" : "o");
    if (vanished != null) setTimeout(() => play("vanish"), 140);
    setLastPlaced({ pos: i, key: Date.now() });
    setGame((prev) => {
      if (!prev || prev.winner || prev.champ) return prev;
      const g = { ...prev };
      const res = applyPlace(g.board, g.order, pl, i, g.variant === "blitz");
      g.board = res.board; g.order = res.order;
      const line = findWin(g.board, pl);
      if (line) {
        g.winner = pl; g.winLine = line;
        g.score = { ...g.score, [pl]: g.score[pl] + 1 };
        if (g.score[pl] >= SERIES_TO) g.champ = pl;
      } else if (g.variant === "classic" && legalCells(g.board).length === 0) {
        g.winner = "draw";
      } else {
        g.current = 3 - pl;
      }
      return markMine(g);
    });
  }

  function nextRound() {
    play("ui");
    setLastPlaced(null);
    setGame((prev) => {
      if (!prev || !prev.winner || prev.champ) return prev;
      const g = { ...prev };
      const r = emptyRound();
      g.board = r.board; g.order = r.order;
      g.round = g.round + 1;
      g.roundStarter = 3 - g.roundStarter;
      g.current = g.roundStarter;
      g.winner = null; g.winLine = null;
      return markMine(g);
    });
  }

  function rematch() {
    const g0 = gameRef.current;
    if (!g0) return;
    if (g0.mode === "online") {
      play("start");
      setLastPlaced(null);
      setGame((prev) => {
        if (!prev) return prev;
        const r = emptyRound();
        return markMine({
          ...prev, board: r.board, order: r.order, current: 1,
          winner: null, winLine: null, champ: null,
          score: { 1: 0, 2: 0 }, round: 1, roundStarter: 1, phase: "playing",
        });
      });
    } else {
      startGame(g0.mode, g0.variant, g0.level);
    }
  }

  /* ----- round / champ sounds ----- */
  useEffect(() => {
    if (!game || !game.winner) return;
    if (game.champ) { play("champ"); setConfettiKey((k) => k + 1); }
    else if (game.winner === "draw") play("draw");
    else play("round");
  }, [game && game.winner, game && game.champ]); // eslint-disable-line

  /* ----- AI turn ----- */
  useEffect(() => {
    const g = gameRef.current;
    if (!g || g.mode !== "ai" || g.current !== 2 || g.winner || g.champ || aiBusyRef.current) return;
    const myGen = g.gen;
    aiBusyRef.current = true;
    setTimeout(() => {
      const g0 = gameRef.current;
      if (!g0 || g0.gen !== myGen || g0.winner || g0.champ || g0.current !== 2) { aiBusyRef.current = false; return; }
      const c = chooseAi(g0.board, g0.order, g0.level, g0.variant === "blitz");
      if (c != null) place(c, true);
      aiBusyRef.current = false;
    }, 620 + Math.random() * 300);
  }, [game && game.current, game && game.winner, game && game.round]); // eslint-disable-line

  /* ----- online push + poll ----- */
  useEffect(() => {
    const g = gameRef.current;
    if (!g || g.mode !== "online" || !g.mine || !g.code) return;
    roomSet(g.code, serializeRoom(g)).then((ok) => {
      if (!ok) showToast("Connection hiccup — that move may not have synced");
    });
  }, [game && game.dirty]); // eslint-disable-line

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
      const placedByThem = r.board.findIndex((v, i) => v !== 0 && g2.board[i] === 0);
      setGame((prev) => {
        if (!prev || prev.mode !== "online") return prev;
        return {
          ...prev,
          seq: r.seq, phase: r.phase, mine: false,
          avatars: { 1: r.hostAv || prev.avatars[1], 2: r.guestAv || prev.avatars[2] },
          variant: r.variant || prev.variant,
          board: r.board, order: r.order, current: r.current,
          winner: r.winner ?? null, winLine: r.winLine ?? null,
          score: r.score || prev.score, round: r.round || prev.round,
          roundStarter: r.roundStarter || prev.roundStarter, champ: r.champ ?? null,
        };
      });
      if (!wasLobby && placedByThem >= 0) {
        play(r.board[placedByThem] === 1 ? "x" : "o");
        setLastPlaced({ pos: placedByThem, key: Date.now() });
      }
      const mp = g2.role === "host" ? 1 : 2;
      if (wasLobby && r.phase === "playing") {
        play("start");
        showToast(`${NAME_OF[r.guestAv] || "A friend"} joined — X goes first! ✨`);
        notifSeqRef.current = r.seq;
      } else if (!r.winner && !r.champ && r.current === mp && notifSeqRef.current !== r.seq) {
        notifSeqRef.current = r.seq;
        play("turn");
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [game && game.mode, game && game.code]); // eslint-disable-line

  /* ================= render ================= */
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&display=swap');
    .biti-display { font-family: 'Baloo 2','Comic Sans MS',ui-rounded,system-ui,sans-serif; }
    .ttt-blink { transform-box: fill-box; transform-origin: center; animation: tttBlink 4.4s ease-in-out infinite; }
    @keyframes tttBlink { 0%, 91%, 100% { transform: scaleY(1); } 94%, 96% { transform: scaleY(0.1); } }
    @keyframes tttDrop { 0% { transform: scale(1.5) rotate(-8deg); opacity: 0; } 55% { transform: scale(0.92) rotate(2deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
    @keyframes tttWobble { 0%,100% { transform: rotate(-4deg) scale(0.97); } 50% { transform: rotate(4deg) scale(1); } }
    @keyframes tttCheer { 0%,100% { transform: translateY(0) scale(1); } 40% { transform: translateY(-9%) scale(1.06); } 60% { transform: translateY(0) scale(0.96,1.02); } }
    @keyframes tttStrike { from { stroke-dashoffset: 160; } to { stroke-dashoffset: 0; } }
    @keyframes bitiGlow { 0%,100% { opacity:.5; } 50% { opacity:.8; } }
    @keyframes bitiFall { 0% { transform: translateY(-8vh) rotate(0deg); opacity:1; } 90% { opacity:1; } 100% { transform: translateY(105vh) rotate(560deg); opacity:0; } }
    @keyframes bitiThink { 0%,80%,100% { opacity:.25; } 40% { opacity:1; } }
    @keyframes bitiRise { from { transform: translateY(14px); opacity:0; } to { transform: translateY(0); opacity:1; } }
    @media (prefers-reduced-motion: reduce) { .biti-anim, .biti-anim * { animation: none !important; transition: none !important; } }
  `;
  const pageBg = { background: "radial-gradient(130% 95% at 50% 12%, #4A2B1B 0%, #331C10 46%, #1B0D07 100%)" };
  const inLobby = game && game.mode === "online" && game.phase === "lobby";

  return (
    <div className="biti-anim min-h-screen w-full text-amber-50 select-none overflow-hidden relative"
      style={{ ...pageBg, touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
      <style>{css}</style>
      <MarkDefs />
      <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: "130vw", height: "80vh", background: "radial-gradient(closest-side, rgba(255,190,90,.16), rgba(255,160,60,.05) 55%, transparent 75%)", animation: "bitiGlow 6s ease-in-out infinite" }} />

      {!game ? (
        <Menu av1={menuAv1} av2={menuAv2} setAv1={setMenuAv1} setAv2={setMenuAv2}
          onStart={startGame} onRules={() => setShowRules(true)}
          onCreateRoom={createRoom} onJoinRoom={joinRoom} onlineBusy={onlineBusy} />
      ) : inLobby ? (
        <Lobby game={game} onCancel={toMenu} />
      ) : (
        <GameScreen game={game} isHumanTurn={isHumanTurn} myP={myPlayer(game)} lastPlaced={lastPlaced}
          onCell={(i) => place(i, false)} onNextRound={nextRound} onMenu={toMenu}
          sound={sound} onSound={() => setSound((s) => !s)}
          onRules={() => setShowRules(true)} onSettings={() => setShowSettings(true)} />
      )}

      {toast && (
        <div key={toast.id} className="fixed left-1/2 top-16 -translate-x-1/2 z-40 px-4 py-2 rounded-full text-sm biti-display font-semibold text-center"
          style={{ background: "rgba(20,10,5,.88)", border: `1.5px solid ${CHALK}55`, color: CHALK, animation: "bitiRise .25s ease-out", maxWidth: "86vw" }}>
          {toast.msg}
        </div>
      )}

      {/* series champion overlay */}
      {game && game.champ && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6" style={{ background: "rgba(12,6,3,.72)", backdropFilter: "blur(3px)" }}>
          <Confetti key={confettiKey} active />
          <div className="relative w-full max-w-xs rounded-3xl p-6 text-center" style={{ background: "linear-gradient(180deg,#3d2314,#26140b)", border: `2px solid ${CHALK}44`, animation: "bitiRise .35s ease-out" }}>
            <div className="text-6xl mb-2">{game.avatars[game.champ]}</div>
            <div className="biti-display text-3xl font-extrabold" style={{ color: CHALK }}>
              {NAME_OF[game.avatars[game.champ]]} wins the match!
            </div>
            <div className="mt-1 text-sm text-amber-200/80">
              {game.score[1]} – {game.score[2]} · first to {SERIES_TO} 🏆
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button onClick={rematch} className="biti-display font-bold text-lg py-2.5 rounded-full active:scale-95 transition-transform"
                style={{ background: "linear-gradient(180deg,#FFD37A,#F0A32C)", color: "#4a2400", boxShadow: "0 4px 12px rgba(0,0,0,.4)" }}>
                Play again
              </button>
              <button onClick={toMenu} className="biti-display font-semibold py-2 rounded-full" style={{ border: `1.5px solid ${CHALK}55`, color: CHALK }}>
                Back to menu
              </button>
            </div>
          </div>
        </div>
      )}

      {showRules && (
        <Modal onClose={() => setShowRules(false)} title="How to play">
          <RuleRow icon="👆" title="Take turns" text="Tap an empty square. X starts. Three in a row — across, down, or diagonal — wins the round." />
          <RuleRow icon="💨" title="Blitz twist" text="In Blitz you only ever have 3 marks. Placing a 4th makes your oldest one vanish — the wobbly one is next to go!" />
          <RuleRow icon="🏆" title="The match" text={`First to win ${SERIES_TO} rounds takes the match. The loser starts the next round.`} />
        </Modal>
      )}
      {showSettings && (
        <Modal onClose={() => setShowSettings(false)} title="Settings">
          <ToggleRow label="Sounds" sub="Knocks, pops and cheers" value={sound} onChange={() => setSound((s) => !s)} />
        </Modal>
      )}
    </div>
  );
}

/* ================= Menu ================= */
function Menu({ av1, av2, setAv1, setAv2, onStart, onRules, onCreateRoom, onJoinRoom, onlineBusy }) {
  const [mode, setMode] = useState("pvp");
  const [variant, setVariant] = useState("blitz");
  const [code, setCode] = useState("");
  const primaryBtn = { background: "linear-gradient(180deg,#FFD37A,#F0A32C)", color: "#4a2400", boxShadow: "0 5px 16px rgba(0,0,0,.45)" };
  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-8 gap-4" style={{ animation: "bitiRise .4s ease-out" }}>
      <div className="text-center">
        <div className="flex items-end justify-center gap-2">
          <XMark className="w-14 h-14 mb-1 -rotate-6" />
          <h1 className="biti-display font-extrabold leading-none" style={{ fontSize: "4rem", color: CHALK, textShadow: "0 3px 0 rgba(0,0,0,.35)", transform: "rotate(-2deg)" }}>
            X · O!
          </h1>
          <OMark className="w-14 h-14 mb-1 rotate-6" />
        </div>
        <div className="biti-display text-amber-200/90 font-semibold tracking-wide mt-1">chalk tic-tac-toe · best of 5</div>
        <div className="text-sm text-amber-200/60 mt-1">From the courtyard wall ✨</div>
      </div>

      {/* variant */}
      <div className="flex rounded-full p-1 gap-1" style={{ background: "rgba(255,243,220,.08)", border: `1.5px solid ${CHALK}33` }}>
        {[["blitz", "💨 Blitz (marks vanish!)"], ["classic", "🏛️ Classic"]].map(([v, label]) => (
          <button key={v} onClick={() => setVariant(v)}
            className="biti-display font-bold px-3 py-2 rounded-full text-sm transition-colors"
            style={variant === v ? { background: CHALK, color: "#4a2400" } : { color: CHALK }}>
            {label}
          </button>
        ))}
      </div>

      {/* mode */}
      <div className="flex rounded-full p-1 gap-1" style={{ background: "rgba(255,243,220,.08)", border: `1.5px solid ${CHALK}33` }}>
        {[["pvp", "🤝 Together"], ["ai", "🤖 Computer"], ["online", "🌐 Far away"]].map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className="biti-display font-bold px-3 py-2 rounded-full text-sm transition-colors"
            style={mode === m ? { background: CHALK, color: "#4a2400" } : { color: CHALK }}>
            {label}
          </button>
        ))}
      </div>

      <div className="w-full max-w-xs flex flex-col gap-3">
        <AvatarPick label={mode === "pvp" ? "X player" : "Your character"} chosen={av1} onPick={setAv1} ring={MARIGOLD} />
        {mode === "pvp" && <AvatarPick label="O player" chosen={av2} onPick={setAv2} ring={PEACOCK} />}
      </div>

      {mode === "pvp" && (
        <button onClick={() => onStart("pvp", variant)}
          className="biti-display font-extrabold text-xl px-10 py-3 rounded-full active:scale-95 transition-transform" style={primaryBtn}>
          Chalk it up! ✏️
        </button>
      )}
      {mode === "ai" && (
        <div className="flex gap-2">
          {[["easy", "🌱 Gentle"], ["medium", "🌶️ Clever"], ["hard", "🔥 Fierce"]].map(([lv, label]) => (
            <button key={lv} onClick={() => onStart("ai", variant, lv)}
              className="biti-display font-bold px-4 py-2.5 rounded-full active:scale-95 transition-transform" style={primaryBtn}>
              {label}
            </button>
          ))}
        </div>
      )}
      {mode === "online" && (hasStorage ? (
        <div className="w-full max-w-xs flex flex-col gap-3 items-center">
          <button onClick={() => onCreateRoom(variant)} disabled={onlineBusy}
            className="biti-display font-extrabold text-lg px-8 py-3 rounded-full active:scale-95 transition-transform w-full"
            style={{ ...primaryBtn, opacity: onlineBusy ? 0.6 : 1 }}>
            {onlineBusy ? "Setting up…" : "Make a room 🏡"}
          </button>
          <div className="text-xs text-amber-200/60 biti-display font-semibold">— or join a friend's room —</div>
          <div className="flex gap-2 w-full">
            <input value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
              placeholder="CODE" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
              className="flex-1 min-w-0 rounded-2xl px-4 py-3 text-center biti-display font-extrabold text-2xl tracking-widest"
              style={{ background: "rgba(0,0,0,.3)", border: `2px dashed ${CHALK}66`, color: CHALK, letterSpacing: "0.35em", outline: "none" }} />
            <button onClick={() => onJoinRoom(code)} disabled={onlineBusy || code.length !== 4}
              className="biti-display font-bold px-5 rounded-2xl active:scale-95 transition-transform"
              style={{ ...primaryBtn, opacity: onlineBusy || code.length !== 4 ? 0.5 : 1 }}>
              Join
            </button>
          </div>
          <div className="text-xs text-amber-200/60 text-center leading-snug">
            The room maker plays X and picks the variant. Read the 4 letters to your friend — any distance!
          </div>
        </div>
      ) : (
        <div className="w-full max-w-xs text-center text-sm text-amber-200/70 rounded-2xl px-4 py-3" style={{ border: `1.5px dashed ${CHALK}44` }}>
          Far-away rooms work on the Claude game link. This copy plays together on one screen, or against the computer. 💛
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

function Lobby({ game, onCancel }) {
  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 gap-5 text-center" style={{ animation: "bitiRise .35s ease-out" }}>
      <div className="text-5xl">{game.avatars[1]}</div>
      <div className="biti-display font-extrabold text-2xl" style={{ color: CHALK }}>Your room is ready!</div>
      <div className="biti-display text-sm text-amber-200/70 font-semibold">{game.variant === "blitz" ? "💨 Blitz — marks vanish!" : "🏛️ Classic"}</div>
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
        {[0, 1, 2].map((i) => <span key={i} style={{ animation: `bitiThink 1.1s ${i * 0.18}s infinite` }}>.</span>)}
      </div>
      <button onClick={onCancel} className="biti-display font-semibold px-6 py-2 rounded-full" style={{ border: `1.5px solid ${CHALK}55`, color: CHALK }}>
        Cancel
      </button>
    </div>
  );
}

/* ================= Game screen ================= */
function GameScreen({ game, isHumanTurn, myP, lastPlaced, onCell, onNextRound, onMenu, sound, onSound, onRules, onSettings }) {
  const online = game.mode === "online";
  const topP = online ? 3 - myP : 2;
  const bottomP = online ? myP : 1;
  const fading = game.variant === "blitz" && !game.winner && game.order[game.current].length === 3
    ? game.order[game.current][0] : null;
  return (
    <div className="relative z-10 min-h-screen flex flex-col px-3 py-3 gap-2 max-w-md mx-auto" style={{ animation: "bitiRise .35s ease-out" }}>
      <div className="flex items-center justify-between">
        <button onClick={onMenu} aria-label="Back to menu" className="biti-display font-bold text-sm px-3 py-1.5 rounded-full" style={{ border: `1.5px solid ${CHALK}44`, color: CHALK }}>
          {online ? "⌂ Leave" : "⌂ Menu"}
        </button>
        <div className="biti-display font-extrabold text-lg" style={{ color: CHALK, transform: "rotate(-1.5deg)" }}>
          {game.variant === "blitz" ? "💨 " : ""}Round {game.round}
          {online && <span className="text-xs font-bold text-amber-200/70 ml-1.5">🌐 {game.code}</span>}
        </div>
        <div className="flex gap-1.5">
          <IconBtn label="Rules" onClick={onRules}>?</IconBtn>
          <IconBtn label="Sound" onClick={onSound}>{sound ? "🔊" : "🔇"}</IconBtn>
          <IconBtn label="Settings" onClick={onSettings}>⚙</IconBtn>
        </div>
      </div>

      <PlayerCard game={game} pl={topP} online={online} myP={myP} />

      <div className="flex-1 flex items-center justify-center min-h-0 relative">
        <BoardTTT game={game} onCell={onCell} interactive={isHumanTurn} fading={fading} lastPlaced={lastPlaced} />
        {/* round banner */}
        {game.winner && !game.champ && (
          <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
            <div className="rounded-3xl px-5 py-4 text-center pointer-events-auto"
              style={{ background: "rgba(20,10,5,.92)", border: `2px solid ${CHALK}55`, animation: "bitiRise .3s ease-out", maxWidth: 260 }}>
              <div className="text-4xl mb-1">{game.winner === "draw" ? "😮" : game.avatars[game.winner]}</div>
              <div className="biti-display font-extrabold text-xl" style={{ color: CHALK }}>
                {game.winner === "draw" ? "A draw!" : `${NAME_OF[game.avatars[game.winner]]} takes the round!`}
              </div>
              <div className="text-xs text-amber-200/75 mt-0.5">{game.score[1]} – {game.score[2]} · first to {SERIES_TO}</div>
              <button onClick={onNextRound}
                className="mt-3 biti-display font-bold text-sm px-6 py-2 rounded-full active:scale-95 transition-transform"
                style={{ background: "linear-gradient(180deg,#FFD37A,#F0A32C)", color: "#4a2400" }}>
                Next round ▶
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="h-8 flex items-center justify-center">
        {!game.winner && game.variant === "blitz" && fading != null && game.mode !== "online" && (
          <span className="biti-display font-semibold text-xs text-amber-200/70">the wobbly mark vanishes on your next move 💨</span>
        )}
        {!game.winner && online && (
          <span className="biti-display font-semibold text-xs text-amber-200/70">
            {isHumanTurn ? "Your move ✨" : "Waiting for " + (NAME_OF[game.avatars[topP]] || "your friend") + "…"}
          </span>
        )}
      </div>

      <PlayerCard game={game} pl={bottomP} online={online} myP={myP} />
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

function PlayerCard({ game, pl, online, myP }) {
  const active = game.current === pl && !game.winner && !game.champ;
  const ring = pl === 1 ? MARIGOLD : PEACOCK;
  const isAi = game.mode === "ai" && pl === 2;
  const isRemote = online && pl !== myP;
  const sub = !active ? "waiting…" : isAi ? "thinking" : isRemote ? "playing far away 🌐" : "your turn ✨";
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-2xl"
      style={{
        background: "linear-gradient(180deg, rgba(255,243,220,.07), rgba(255,243,220,.03))",
        border: `1.5px solid ${active ? ring : CHALK + "1e"}`,
        boxShadow: active ? `0 0 16px ${ring}55` : "none",
      }}>
      <div className="relative">
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-2xl" style={{ background: "rgba(0,0,0,.28)", boxShadow: `0 0 0 2.5px ${ring}` }}>
          {game.avatars[pl] || "❔"}
        </div>
        <div className="w-5 h-5 absolute -bottom-1 -right-1">
          {pl === 1 ? <XMark className="w-full h-full" /> : <OMark className="w-full h-full" />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="biti-display font-extrabold leading-tight" style={{ color: CHALK }}>
          {NAME_OF[game.avatars[pl]] || "Friend"}
          {online && pl === myP && <span className="text-xs font-bold text-amber-200/60 ml-1">(you)</span>}
        </div>
        <div className="text-xs text-amber-200/70 biti-display font-semibold">
          {sub}
          {active && (isAi || isRemote) && [0, 1, 2].map((i) => (
            <span key={i} style={{ animation: `bitiThink 1.1s ${i * 0.18}s infinite` }}>.</span>
          ))}
        </div>
      </div>
      {/* round pips */}
      <div className="flex items-center gap-1">
        {Array.from({ length: SERIES_TO }).map((_, i) => (
          <div key={i} className="w-3 h-3 rounded-full"
            style={{
              background: i < game.score[pl] ? ring : "rgba(255,243,220,.12)",
              boxShadow: i < game.score[pl] ? `0 0 6px ${ring}88` : "none",
            }} />
        ))}
      </div>
    </div>
  );
}

/* ================= Board ================= */
function BoardTTT({ game, onCell, interactive, fading, lastPlaced }) {
  const CX = [17.5, 50, 82.5];
  const cellXY = (i) => ({ x: CX[i % 3], y: CX[Math.floor(i / 3)] });
  const winnersSet = new Set(game.winLine || []);
  return (
    <div className="relative w-full" style={{ maxWidth: 380, aspectRatio: "1 / 1" }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <defs>
          <radialGradient id="tttGround" cx="50%" cy="42%" r="75%">
            <stop offset="0%" stopColor="#6E4128" />
            <stop offset="60%" stopColor="#59331E" />
            <stop offset="100%" stopColor="#3F2213" />
          </radialGradient>
          <filter id="tttGrain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="linear" slope="0.06" /></feComponentTransfer>
            <feComposite operator="in" in2="SourceGraphic" />
          </filter>
        </defs>
        <rect x="1" y="1" width="98" height="98" rx="9" fill="url(#tttGround)" />
        <rect x="1" y="1" width="98" height="98" rx="9" fill="#fff" filter="url(#tttGrain)" />
        <rect x="1.8" y="1.8" width="96.4" height="96.4" rx="8.4" fill="none" stroke="#000" strokeOpacity="0.3" strokeWidth="1.8" />
        {/* rangoli corners */}
        <g filter="url(#tttChalk)">
          {[[5.5, 5.5], [94.5, 5.5], [5.5, 94.5], [94.5, 94.5]].map(([cx, cy], k) => (
            <g key={k} opacity="0.55">
              <circle cx={cx} cy={cy} r="1.4" fill={ROSE} />
              {[0, 60, 120, 180, 240, 300].map((a) => (
                <circle key={a} cx={cx + 3.1 * Math.cos((a * Math.PI) / 180)} cy={cy + 3.1 * Math.sin((a * Math.PI) / 180)}
                  r="1" fill={k % 2 ? PEACOCK : MARIGOLD} />
              ))}
            </g>
          ))}
        </g>
        {/* the classic hand-drawn hash */}
        <g stroke={CHALK} strokeOpacity="0.16" strokeWidth="4" strokeLinecap="round" filter="url(#tttChalk)">
          <line x1="34" y1="9" x2="34" y2="91" /><line x1="66" y1="9" x2="66" y2="91" />
          <line x1="9" y1="34" x2="91" y2="34" /><line x1="9" y1="66" x2="91" y2="66" />
        </g>
        <g stroke={CHALK} strokeOpacity="0.95" strokeWidth="1.7" strokeLinecap="round" filter="url(#tttChalk)">
          <line x1="34" y1="9" x2="34" y2="91" /><line x1="66" y1="9" x2="66" y2="91" />
          <line x1="9" y1="34" x2="91" y2="34" /><line x1="9" y1="66" x2="91" y2="66" />
        </g>
        {/* winning strike */}
        {game.winLine && (
          <line
            x1={cellXY(game.winLine[0]).x} y1={cellXY(game.winLine[0]).y}
            x2={cellXY(game.winLine[2]).x} y2={cellXY(game.winLine[2]).y}
            stroke={ROSE} strokeWidth="3.4" strokeLinecap="round" filter="url(#tttChalk)"
            strokeDasharray="160" style={{ animation: "tttStrike .5s ease-out forwards" }} />
        )}
      </svg>

      {/* cells */}
      {Array.from({ length: 9 }).map((_, i) => {
        const { x, y } = cellXY(i);
        const v = game.board[i];
        const isFading = fading === i;
        const isWin = winnersSet.has(i);
        const justPlaced = lastPlaced && lastPlaced.pos === i && v !== 0;
        return (
          <div key={i} className="absolute" style={{ left: x + "%", top: y + "%", width: "29%", height: "29%", transform: "translate(-50%,-50%)" }}>
            {v === 0 ? (
              interactive && !game.winner ? (
                <button {...press(() => onCell(i))} aria-label={"Place in square " + (i + 1)}
                  className="w-full h-full rounded-2xl" style={{ background: "transparent" }} />
              ) : null
            ) : (
              <div key={justPlaced ? "p" + lastPlaced.key : "m"} className="w-full h-full"
                style={{
                  animation: isWin ? "tttCheer .7s ease-in-out infinite"
                    : justPlaced ? "tttDrop .34s ease-out"
                    : isFading ? "tttWobble 1s ease-in-out infinite" : "none",
                  opacity: isFading ? 0.55 : 1,
                }}>
                <Mark player={v} className="w-full h-full"
                  mood={isWin ? "wide" : game.winner && game.winner !== "draw" && v !== game.winner ? "dizzy" : "idle"} />
              </div>
            )}
          </div>
        );
      })}
    </div>
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
