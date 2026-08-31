import React, { useEffect, useMemo, useRef, useState } from "react";

/* ================================================================
   LUDO 🎲 — the other side of the Saanp Seedhi board
   Classic rules, kid-tuned:
   · roll a 6 to bring a token out of your yard
   · race all 4 tokens 57 steps around and home (exact roll to finish)
   · land on an opponent (off the ⭐ safe cells) — they go back home,
     and you roll again; reaching home also earns a roll; so does a 6
   · three 6s in a row — turn skipped!
   2–4 players, any mix of humans and robots. Same dusk courtyard.
   Track geometry solver-verified 2026-07-25 (52-cell ring, starts
   0/13/26/39, home entry at rel-51, 8 safe cells).
   ================================================================ */

const CHALK = "#FFF3DC";
const MARIGOLD = "#FFC24B";
const PEACOCK = "#2DD4BF";
const ROSE = "#F973B6";
const VIOLET = "#A78BFA";
const AVATARS = ["🐯", "🦚", "🐘", "🦋", "🐒", "⭐"];
const NAME_OF = { "🐯": "Tiger", "🦚": "Peacock", "🐘": "Elephant", "🦋": "Butterfly", "🐒": "Monkey", "⭐": "Star" };

/* ---------- verified board geometry ---------- */
const TRACK = [
  ...Array.from({ length: 5 }, (_, i) => [6, 1 + i]),
  ...Array.from({ length: 6 }, (_, i) => [5 - i, 6]),
  [0, 7], [0, 8],
  ...Array.from({ length: 5 }, (_, i) => [1 + i, 8]),
  ...Array.from({ length: 6 }, (_, i) => [6, 9 + i]),
  [7, 14], [8, 14],
  ...Array.from({ length: 5 }, (_, i) => [8, 13 - i]),
  ...Array.from({ length: 6 }, (_, i) => [9 + i, 8]),
  [14, 7], [14, 6],
  ...Array.from({ length: 5 }, (_, i) => [13 - i, 6]),
  ...Array.from({ length: 6 }, (_, i) => [8, 5 - i]),
  [7, 0], [6, 0],
];
const START_IDX = [0, 13, 26, 39]; // marigold TL · peacock TR · rose BR · violet BL
const HOME_COLS = [
  Array.from({ length: 5 }, (_, i) => [7, 1 + i]),
  Array.from({ length: 5 }, (_, i) => [1 + i, 7]),
  Array.from({ length: 5 }, (_, i) => [7, 13 - i]),
  Array.from({ length: 5 }, (_, i) => [13 - i, 7]),
];
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47].map((i) => TRACK[i].join(",")));
const HOME_ANCHOR = [[7, 6.15], [6.15, 7], [7, 7.85], [7.85, 7]]; // finished tokens rest in their triangle
const YARD_SLOTS = [
  [[2, 2], [2, 4], [4, 2], [4, 4]],
  [[2, 10], [2, 12], [4, 10], [4, 12]],
  [[10, 10], [10, 12], [12, 10], [12, 12]],
  [[10, 2], [10, 4], [12, 2], [12, 4]],
];
const CELL = 100 / 15;
const rcXY = (r, c) => ({ x: (c + 0.5) * CELL, y: (r + 0.5) * CELL });

/* absolute board position for seat's token at relative progress rel (0..57) */
function cellOf(seat, rel, ti = 0) {
  if (rel === 0) { const [r, c] = YARD_SLOTS[seat][ti]; return rcXY(r, c); }
  if (rel <= 51) { const [r, c] = TRACK[(START_IDX[seat] + rel - 1) % 52]; return rcXY(r, c); }
  if (rel <= 56) { const [r, c] = HOME_COLS[seat][rel - 52]; return rcXY(r, c); }
  const [r, c] = HOME_ANCHOR[seat]; return rcXY(r, c);
}
const trackKeyOf = (seat, rel) => (rel >= 1 && rel <= 51 ? TRACK[(START_IDX[seat] + rel - 1) % 52].join(",") : null);

/* ---------- token art (same family as Saanp Seedhi) ---------- */
const TOKEN_PAL = [
  { grad: "ldG1", hi: "#FFF4CB", mid: "#FFCF6B", lo: "#8A4A07", ring: "#7A3E04", label: MARIGOLD },
  { grad: "ldG2", hi: "#DFFFF8", mid: "#4FE3CD", lo: "#043B36", ring: "#03332E", label: PEACOCK },
  { grad: "ldG3", hi: "#FFE1EF", mid: "#F973B6", lo: "#6B1B40", ring: "#5E1837", label: ROSE },
  { grad: "ldG4", hi: "#EFE6FF", mid: "#A78BFA", lo: "#33206B", ring: "#2C1B5E", label: VIOLET },
];

function TokenDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        {TOKEN_PAL.map((p) => (
          <radialGradient key={p.grad} id={p.grad} cx="34%" cy="28%" r="80%">
            <stop offset="0%" stopColor={p.hi} />
            <stop offset="45%" stopColor={p.mid} />
            <stop offset="100%" stopColor={p.lo} />
          </radialGradient>
        ))}
        <filter id="ldSoft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
        <filter id="ldChalk" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="5" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" />
        </filter>
      </defs>
    </svg>
  );
}

function TokenSVG({ seat, className = "", style = {}, mood = "idle", blinkDelay = "0s" }) {
  const p = TOKEN_PAL[seat % 4];
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <ellipse cx="50" cy="85" rx="32" ry="8.5" fill="#000" opacity="0.38" filter="url(#ldSoft)" />
      <circle cx="50" cy="47" r="38" fill={`url(#${p.grad})`} />
      <circle cx="50" cy="47" r="38" fill="none" stroke={p.ring} strokeOpacity="0.5" strokeWidth="2.5" />
      {mood === "dizzy" ? (
        <g stroke={p.ring} strokeWidth="4.2" strokeLinecap="round" opacity="0.9">
          <path d="M 32 38 L 42 48 M 42 38 L 32 48" />
          <path d="M 58 38 L 68 48 M 68 38 L 58 48" />
          <path d="M 41 64 Q 50 57 59 64" fill="none" />
        </g>
      ) : (
        <g>
          <g className="ld-blink" style={{ animationDelay: blinkDelay }}>
            <ellipse cx="38" cy="42" rx={mood === "wide" ? 8 : 6.5} ry={mood === "wide" ? 9.4 : 7.5} fill="#FFFDF5" />
            <ellipse cx="62" cy="42" rx={mood === "wide" ? 8 : 6.5} ry={mood === "wide" ? 9.4 : 7.5} fill="#FFFDF5" />
            <circle cx="39" cy={mood === "wide" ? 42.6 : 43.4} r={mood === "wide" ? 3.8 : 3} fill="#241309" />
            <circle cx="63" cy={mood === "wide" ? 42.6 : 43.4} r={mood === "wide" ? 3.8 : 3} fill="#241309" />
            <circle cx="40.4" cy="41.4" r="1.15" fill="#fff" />
            <circle cx="64.4" cy="41.4" r="1.15" fill="#fff" />
          </g>
          {mood === "wide"
            ? <path d="M 41 57 Q 50 69 59 57 Q 50 62.5 41 57 Z" fill={p.ring} opacity="0.88" />
            : <path d="M 43 58.5 Q 50 64.5 57 58.5" fill="none" stroke={p.ring} strokeWidth="3.2" strokeLinecap="round" opacity="0.85" />}
        </g>
      )}
      <ellipse cx="37" cy="28" rx="14" ry="8.5" fill="#fff" opacity="0.45" transform="rotate(-18 37 28)" />
      <circle cx="32" cy="24.5" r="3" fill="#fff" opacity="0.9" />
    </svg>
  );
}

const PIPS = {
  1: [[50, 50]], 2: [[30, 30], [70, 70]], 3: [[28, 28], [50, 50], [72, 72]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 26], [70, 26], [30, 50], [70, 50], [30, 74], [70, 74]],
};
function DiceSVG({ val, className = "", style = {} }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <rect x="8" y="10" width="84" height="84" rx="20" fill="#000" opacity="0.35" filter="url(#ldSoft)" />
      <rect x="6" y="6" width="84" height="84" rx="20" fill="#FFF8E8" />
      <rect x="6" y="6" width="84" height="84" rx="20" fill="none" stroke="#C9A15E" strokeWidth="3" />
      {(PIPS[val] || PIPS[1]).map(([x, y], i) => (
        <circle key={i} cx={6 + (x * 84) / 100} cy={6 + (y * 84) / 100} r="7.5" fill="#5A2E02" />
      ))}
    </svg>
  );
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
  const play = (kind, opt = 0) => {
    if (!enabledRef.current) return;
    try {
      ensure();
      if (kind === "rattle") { [0, 1, 2, 3, 4].forEach((i) => thock(0.09, i * 0.07, 2400)); }
      else if (kind === "hop") tone(R(300 + opt * 24), 0.05, "triangle", 0.07);
      else if (kind === "enter") { tone(R(440), 0.12, "triangle", 0.09, 0, 720); thock(0.08, 0, 1600); }
      else if (kind === "capture") { thock(0.2, 0, 900); tone(R(560), 0.09, "square", 0.08, 0.01, 300); tone(R(1150), 0.1, "sine", 0.06, 0.12); }
      else if (kind === "home") { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.1, "triangle", 0.09, i * 0.07)); }
      else if (kind === "six") { tone(880, 0.08, "triangle", 0.09); tone(1174, 0.1, "triangle", 0.08, 0.08); }
      else if (kind === "forfeit") { tone(300, 0.12, "sawtooth", 0.05, 0, 190); tone(240, 0.14, "sawtooth", 0.045, 0.12, 150); }
      else if (kind === "tick") tone(R(1250), 0.03, "sine", 0.045);
      else if (kind === "start") { tone(392, 0.09, "triangle", 0.08); tone(523, 0.09, "triangle", 0.08, 0.09); tone(659, 0.11, "triangle", 0.08, 0.18); }
      else if (kind === "win") {
        [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.18, "triangle", 0.09, i * 0.1));
        [2093, 2637, 3136].forEach((f, i) => tone(f, 0.4, "sine", 0.03, 0.55 + i * 0.07));
      }
      else if (kind === "ui") thock(0.06, 0, 2200);
    } catch (e) { /* optional */ }
  };
  return play;
}

/* ================================================================ */
export default function Ludo() {
  const [game, setGame] = useState(null);
  const [toast, setToast] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sound, setSound] = useState(true);
  const [confettiKey, setConfettiKey] = useState(0);
  const [bursts, setBursts] = useState([]);

  const soundRef = useRef(true); soundRef.current = sound;
  const gameRef = useRef(null); gameRef.current = game;
  const busyRef = useRef(false);
  const play = useSounds(soundRef);

  const showToast = (msg) => setToast({ msg, id: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2100);
    return () => clearTimeout(t);
  }, [toast]);

  function addBurst(x, y, seat) {
    const key = Date.now() + Math.random();
    setBursts((b) => [...b.slice(-4), { key, x, y, seat }]);
    setTimeout(() => setBursts((b) => b.filter((q) => q.key !== key)), 800);
  }

  /* ----- start ----- */
  function startGame(defs) {
    play("start");
    busyRef.current = false;
    setBursts([]);
    setGame({
      gen: Date.now(), phase: "playing",
      players: defs.map((p, i) => ({ ...p, seat: i, tokens: [0, 0, 0, 0] })),
      turnIdx: 0, dice: 6, rolling: false, busy: false,
      awaiting: null, sixStreak: 0, winner: null,
    });
  }
  const toMenu = () => { setGame(null); busyRef.current = false; };

  const patchPlayer = (g, seat, fn) => ({
    ...g, players: g.players.map((p) => (p.seat === seat ? fn(p) : p)),
  });

  /* ----- legal moves ----- */
  function legalMoves(g, seat, roll) {
    const p = g.players[seat];
    const moves = [];
    p.tokens.forEach((rel, ti) => {
      if (rel === 57) return;
      if (rel === 0) {
        if (roll === 6) moves.push({ ti, from: 0, to: 1 });
        return;
      }
      const to = rel + roll;
      if (to > 57) return;
      moves.push({ ti, from: rel, to });
    });
    // annotate captures
    return moves.map((m) => {
      const key = trackKeyOf(seat, m.to);
      const captures = [];
      if (key && !SAFE.has(key)) {
        g.players.forEach((op) => {
          if (op.seat === seat) return;
          op.tokens.forEach((orel, oti) => {
            if (trackKeyOf(op.seat, orel) === key) captures.push({ seat: op.seat, ti: oti });
          });
        });
      }
      return { ...m, captures };
    });
  }

  /* ----- rolling ----- */
  function doRoll() {
    const g0 = gameRef.current;
    if (!g0 || g0.winner != null || busyRef.current || g0.rolling || g0.awaiting) return;
    const myGen = g0.gen;
    const alive = () => gameRef.current && gameRef.current.gen === myGen && gameRef.current.winner == null;
    busyRef.current = true;
    play("rattle");
    setGame((prev) => (prev ? { ...prev, rolling: true, busy: true } : prev));
    let ticks = 0;
    const tumble = setInterval(() => {
      if (!alive()) { clearInterval(tumble); busyRef.current = false; return; }
      ticks++;
      setGame((prev) => (prev ? { ...prev, dice: 1 + Math.floor(Math.random() * 6) } : prev));
      if (ticks >= 6) {
        clearInterval(tumble);
        const val = 1 + Math.floor(Math.random() * 6);
        setGame((prev) => (prev ? { ...prev, dice: val, rolling: false } : prev));
        setTimeout(() => afterRoll(val, myGen), 280);
      }
    }, 85);
  }

  function afterRoll(roll, myGen) {
    const alive = () => gameRef.current && gameRef.current.gen === myGen && gameRef.current.winner == null;
    if (!alive()) { busyRef.current = false; return; }
    const g = gameRef.current;
    const seat = g.turnIdx;
    const cur = g.players[seat];
    const streak = roll === 6 ? g.sixStreak + 1 : 0;
    if (roll === 6 && streak >= 3) {
      play("forfeit");
      showToast(`😅 Three sixes! ${playerName(cur)} loses the turn`);
      busyRef.current = false;
      setGame((prev) => (prev ? { ...prev, busy: false, sixStreak: 0, turnIdx: (prev.turnIdx + 1) % prev.players.length } : prev));
      return;
    }
    if (roll === 6) play("six");
    const moves = legalMoves(g, seat, roll);
    if (!moves.length) {
      showToast(roll === 6 ? "Six, but nowhere to go!" : `No moves for ${playerName(cur)}`);
      busyRef.current = false;
      setGame((prev) => {
        if (!prev) return prev;
        const extra = roll === 6; // a 6 always re-rolls, even wasted? classic: yes for 6
        return {
          ...prev, busy: false, sixStreak: streak,
          turnIdx: extra ? prev.turnIdx : (prev.turnIdx + 1) % prev.players.length,
          ...(extra ? {} : { sixStreak: 0 }),
        };
      });
      return;
    }
    if (moves.length === 1) {
      setGame((prev) => (prev ? { ...prev, sixStreak: streak } : prev));
      setTimeout(() => { if (alive()) execMove(seat, moves[0], roll, myGen); }, 420);
      return;
    }
    if (cur.kind === "robot") {
      setGame((prev) => (prev ? { ...prev, sixStreak: streak } : prev));
      const pick = robotPick(moves);
      setTimeout(() => { if (alive()) execMove(seat, pick, roll, myGen); }, 720);
      return;
    }
    // human chooses
    play("tick");
    busyRef.current = false;
    setGame((prev) => (prev ? { ...prev, busy: false, sixStreak: streak, awaiting: { roll, moves } } : prev));
  }

  function robotPick(moves) {
    let best = moves[0], bs = -Infinity;
    for (const m of moves) {
      let s = Math.random() * 4;
      if (m.captures.length) s += 100;
      if (m.to === 57) s += 80;
      if (m.from === 0) s += 50;
      if (m.to >= 52) s += 20;                       // duck into home column
      if (trackKeyOf(gameRef.current.turnIdx, m.to) && SAFE.has(trackKeyOf(gameRef.current.turnIdx, m.to))) s += 14;
      s += (m.to / 57) * 8;
      if (s > bs) { bs = s; best = m; }
    }
    return best;
  }

  function chooseMove(ti) {
    const g = gameRef.current;
    if (!g || !g.awaiting) return;
    const m = g.awaiting.moves.find((x) => x.ti === ti);
    if (!m) { play("ui"); return; }
    const myGen = g.gen, roll = g.awaiting.roll, seat = g.turnIdx;
    busyRef.current = true;
    setGame((prev) => (prev ? { ...prev, awaiting: null, busy: true } : prev));
    execMove(seat, m, roll, myGen);
  }

  /* ----- executing a move ----- */
  function execMove(seat, m, roll, myGen) {
    const alive = () => gameRef.current && gameRef.current.gen === myGen && gameRef.current.winner == null;
    if (!alive()) { busyRef.current = false; return; }
    busyRef.current = true;
    setGame((prev) => (prev ? { ...prev, busy: true } : prev));

    const finish = (captured, reachedHome) => {
      if (!alive()) { busyRef.current = false; return; }
      const g = gameRef.current;
      const cur = g.players[seat];
      const allHome = cur.tokens.every((r) => r === 57);
      if (allHome) {
        busyRef.current = false;
        play("win");
        setConfettiKey((k) => k + 1);
        setGame((prev) => (prev ? { ...prev, busy: false, winner: seat, awaiting: null } : prev));
        return;
      }
      const extra = roll === 6 || captured || reachedHome;
      if (extra) {
        if (captured) showToast(`💥 Got them! ${playerName(cur)} rolls again`);
        else if (reachedHome) showToast(`🏠 Home! ${playerName(cur)} rolls again`);
        else showToast(`🎲 Six! ${playerName(cur)} rolls again`);
      }
      busyRef.current = false;
      setGame((prev) => {
        if (!prev) return prev;
        return {
          ...prev, busy: false,
          sixStreak: extra ? prev.sixStreak : 0,
          turnIdx: extra ? prev.turnIdx : (prev.turnIdx + 1) % prev.players.length,
        };
      });
    };

    if (m.from === 0) {
      // enter from yard: single pop onto the start cell
      play("enter");
      setGame((prev) => (prev ? patchPlayer(prev, seat, (p) => ({ ...p, tokens: p.tokens.map((r, i) => (i === m.ti ? 1 : r)) })) : prev));
      setTimeout(() => resolveLanding(seat, m, 1, myGen, finish), 260);
      return;
    }
    // hop cell by cell
    const steps = [];
    for (let r = m.from + 1; r <= m.to; r++) steps.push(r);
    steps.forEach((rel, i) => {
      setTimeout(() => {
        if (!alive()) return;
        play("hop", i);
        setGame((prev) => (prev ? patchPlayer(prev, seat, (p) => ({ ...p, tokens: p.tokens.map((r, k) => (k === m.ti ? rel : r)) })) : prev));
      }, i * 170);
    });
    setTimeout(() => resolveLanding(seat, m, m.to, myGen, finish), steps.length * 170 + 140);
  }

  function resolveLanding(seat, m, landedRel, myGen, finish) {
    const alive = () => gameRef.current && gameRef.current.gen === myGen && gameRef.current.winner == null;
    if (!alive()) { busyRef.current = false; return; }
    const g = gameRef.current;
    let captured = false;
    if (m.captures && m.captures.length) {
      // re-check against live state (positions may equal plan; captures only on track cells)
      const key = trackKeyOf(seat, landedRel);
      if (key && !SAFE.has(key)) {
        const victims = [];
        g.players.forEach((op) => {
          if (op.seat === seat) return;
          op.tokens.forEach((orel, oti) => {
            if (trackKeyOf(op.seat, orel) === key) victims.push({ seat: op.seat, ti: oti });
          });
        });
        if (victims.length) {
          captured = true;
          play("capture");
          const { x, y } = cellOf(seat, landedRel, m.ti);
          victims.forEach((v) => addBurst(x, y, v.seat));
          setGame((prev) => {
            if (!prev) return prev;
            let ng = prev;
            victims.forEach((v) => {
              ng = patchPlayer(ng, v.seat, (p) => ({ ...p, tokens: p.tokens.map((r, i) => (i === v.ti ? 0 : r)) }));
            });
            return ng;
          });
        }
      }
    }
    const reachedHome = landedRel === 57;
    if (reachedHome) {
      play("home");
      const { x, y } = cellOf(seat, 57, m.ti);
      addBurst(x, y, seat);
    }
    setTimeout(() => finish(captured, reachedHome), captured || reachedHome ? 420 : 60);
  }

  /* ----- robots roll by themselves ----- */
  useEffect(() => {
    const g = gameRef.current;
    if (!g || g.winner != null || g.busy || g.rolling || g.awaiting) return;
    const cur = g.players[g.turnIdx];
    if (cur.kind !== "robot") return;
    const myGen = g.gen, myTurn = g.turnIdx;
    const t = setTimeout(() => {
      const g2 = gameRef.current;
      if (!g2 || g2.gen !== myGen || g2.winner != null || g2.busy || g2.rolling || g2.awaiting || g2.turnIdx !== myTurn) return;
      doRoll();
    }, 950);
    return () => clearTimeout(t);
  }, [game && game.turnIdx, game && game.busy, game && game.rolling, game && game.winner, game && game.awaiting]); // eslint-disable-line

  /* ================= render ================= */
  const css = `
    /* Baloo 2 v23 (SIL OFL 1.1) — served from this site, not from Google. wght axis 400-800. */
    /* devanagari */
    @font-face { font-family: 'Baloo 2'; font-style: normal; font-weight: 400 800; font-display: swap; src: url('fonts/baloo2-v23-devanagari.woff2') format('woff2'); unicode-range: U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B09; }
    /* vietnamese */
    @font-face { font-family: 'Baloo 2'; font-style: normal; font-weight: 400 800; font-display: swap; src: url('fonts/baloo2-v23-vietnamese.woff2') format('woff2'); unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB; }
    /* latin-ext */
    @font-face { font-family: 'Baloo 2'; font-style: normal; font-weight: 400 800; font-display: swap; src: url('fonts/baloo2-v23-latin-ext.woff2') format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
    /* latin */
    @font-face { font-family: 'Baloo 2'; font-style: normal; font-weight: 400 800; font-display: swap; src: url('fonts/baloo2-v23-latin.woff2') format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
    .biti-display { font-family: 'Baloo 2','Comic Sans MS',ui-rounded,system-ui,sans-serif; }
    .ld-blink { transform-box: fill-box; transform-origin: center; animation: ldBlink 4.5s ease-in-out infinite; }
    @keyframes ldBlink { 0%, 91%, 100% { transform: scaleY(1); } 94%, 96% { transform: scaleY(0.1); } }
    @keyframes ldPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
    @keyframes ldHalo { 0%,100% { opacity:.3; transform: translate(-50%,-50%) scale(.95); } 50% { opacity:.7; transform: translate(-50%,-50%) scale(1.14); } }
    @keyframes ldShake { 0%,100% { transform: rotate(0deg); } 20% { transform: rotate(-14deg); } 45% { transform: rotate(11deg); } 70% { transform: rotate(-7deg); } }
    @keyframes ldBurst { 0% { transform: translate(-50%,-50%) scale(.4) rotate(0deg); opacity:1; } 100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1) rotate(180deg); opacity:0; } }
    @keyframes bitiGlow { 0%,100% { opacity:.5; } 50% { opacity:.8; } }
    @keyframes bitiFall { 0% { transform: translateY(-8vh) rotate(0deg); opacity:1; } 90% { opacity:1; } 100% { transform: translateY(105vh) rotate(560deg); opacity:0; } }
    @keyframes bitiThink { 0%,80%,100% { opacity:.25; } 40% { opacity:1; } }
    @keyframes bitiRise { from { transform: translateY(14px); opacity:0; } to { transform: translateY(0); opacity:1; } }
    @media (prefers-reduced-motion: reduce) { .biti-anim, .biti-anim * { animation: none !important; transition: none !important; } }
  `;
  const pageBg = { background: "radial-gradient(130% 95% at 50% 12%, #4A2B1B 0%, #331C10 46%, #1B0D07 100%)" };

  return (
    <div className="biti-anim min-h-screen w-full text-amber-50 select-none overflow-hidden relative"
      style={{ ...pageBg, touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
      <style>{css}</style>
      <TokenDefs />
      <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: "130vw", height: "80vh", background: "radial-gradient(closest-side, rgba(255,190,90,.16), rgba(255,160,60,.05) 55%, transparent 75%)", animation: "bitiGlow 6s ease-in-out infinite" }} />

      {!game ? (
        <Setup onStart={startGame} onRules={() => setShowRules(true)} />
      ) : (
        <GameScreen game={game} bursts={bursts} onRoll={doRoll} onPick={chooseMove} onMenu={toMenu}
          sound={sound} onSound={() => setSound((s) => !s)}
          onRules={() => setShowRules(true)} onSettings={() => setShowSettings(true)} />
      )}

      {toast && (
        <div key={toast.id} className="fixed left-1/2 top-16 -translate-x-1/2 z-40 px-4 py-2 rounded-full text-sm biti-display font-semibold text-center"
          style={{ background: "rgba(20,10,5,.88)", border: `1.5px solid ${CHALK}55`, color: CHALK, animation: "bitiRise .25s ease-out", maxWidth: "86vw" }}>
          {toast.msg}
        </div>
      )}

      {game && game.winner != null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6" style={{ background: "rgba(12,6,3,.72)", backdropFilter: "blur(3px)" }}>
          <Confetti key={confettiKey} active />
          <div className="relative w-full max-w-xs rounded-3xl p-6 text-center" style={{ background: "linear-gradient(180deg,#3d2314,#26140b)", border: `2px solid ${CHALK}44`, animation: "bitiRise .35s ease-out" }}>
            <div className="text-6xl mb-2">{game.players[game.winner].avatar}</div>
            <div className="biti-display text-3xl font-extrabold" style={{ color: CHALK }}>
              {playerName(game.players[game.winner])} wins!
            </div>
            <div className="text-sm text-amber-200/80 mt-1">All four tokens home 🏠</div>
            <div className="mt-3 flex flex-col gap-1.5">
              {game.players.slice().sort((a, b) => score(b) - score(a)).map((p, i) => (
                <div key={p.seat} className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "rgba(255,243,220,.07)" }}>
                  <span className="text-lg">{["🥇", "🥈", "🥉", "🏅"][i]}</span>
                  <TokenSVG seat={p.seat} className="w-5 h-5" />
                  <span className="biti-display font-bold text-sm flex-1 text-left" style={{ color: CHALK }}>{playerName(p)}</span>
                  <span className="text-xs font-bold text-amber-200/80">{p.tokens.filter((r) => r === 57).length}/4 home</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button onClick={() => startGame(game.players.map(({ avatar, kind }) => ({ avatar, kind })))}
                className="biti-display font-bold text-lg py-2.5 rounded-full active:scale-95 transition-transform"
                style={{ background: "linear-gradient(180deg,#FFD37A,#F0A32C)", color: "#4a2400", boxShadow: "0 4px 12px rgba(0,0,0,.4)" }}>
                Play again
              </button>
              <button onClick={toMenu} className="biti-display font-semibold py-2 rounded-full" style={{ border: `1.5px solid ${CHALK}55`, color: CHALK }}>
                Change players
              </button>
            </div>
          </div>
        </div>
      )}

      {showRules && (
        <Modal onClose={() => setShowRules(false)} title="How to play">
          <RuleRow icon="🎲" title="Get moving" text="Roll a 6 to bring a token out of your yard. Then race it all the way around the board and up your home path." />
          <RuleRow icon="💥" title="Captures" text="Land on another player's token and it goes back to their yard — and you roll again! Tokens on ⭐ star cells are safe." />
          <RuleRow icon="🔁" title="Extra rolls" text="A 6, a capture, or bringing a token home all earn another roll. But three 6s in a row — turn skipped!" />
          <RuleRow icon="🏠" title="Win" text="You need the exact number to step into the centre. First to bring all 4 tokens home wins." />
        </Modal>
      )}
      {showSettings && (
        <Modal onClose={() => setShowSettings(false)} title="Settings">
          <ToggleRow label="Sounds" sub="Rattles, hops and cheers" value={sound} onChange={() => setSound((s) => !s)} />
        </Modal>
      )}
    </div>
  );
}

function playerName(p) {
  return (p.kind === "robot" ? "Robot " : "") + (NAME_OF[p.avatar] || "Friend");
}
function score(p) {
  return p.tokens.filter((r) => r === 57).length * 1000 + p.tokens.reduce((a, b) => a + b, 0);
}

/* ================= Setup ================= */
function Setup({ onStart, onRules }) {
  const [count, setCount] = useState(2);
  const [defs, setDefs] = useState([
    { avatar: "🐯", kind: "human" },
    { avatar: "🦚", kind: "robot" },
    { avatar: "🐘", kind: "robot" },
    { avatar: "🐒", kind: "robot" },
  ]);
  const upd = (i, patch) => setDefs((d) => d.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const primaryBtn = { background: "linear-gradient(180deg,#FFD37A,#F0A32C)", color: "#4a2400", boxShadow: "0 5px 16px rgba(0,0,0,.45)" };
  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-5 py-8 gap-4" style={{ animation: "bitiRise .4s ease-out" }}>
      <div className="text-center">
        <div className="flex items-end justify-center gap-2">
          <span className="text-4xl mb-1">🎲</span>
          <h1 className="biti-display font-extrabold leading-none" style={{ fontSize: "4rem", color: CHALK, textShadow: "0 3px 0 rgba(0,0,0,.35)", transform: "rotate(-2deg)" }}>
            Ludo
          </h1>
          <span className="text-4xl mb-1">🏠</span>
        </div>
        <div className="biti-display text-amber-200/90 font-semibold tracking-wide mt-1">race all four tokens home</div>
        <div className="text-sm text-amber-200/60 mt-1">The other side of the Saanp Seedhi board ✨</div>
      </div>

      <div className="flex rounded-full p-1 gap-1" style={{ background: "rgba(255,243,220,.08)", border: `1.5px solid ${CHALK}33` }}>
        {[2, 3, 4].map((n) => (
          <button key={n} onClick={() => setCount(n)}
            className="biti-display font-bold px-5 py-2 rounded-full text-sm transition-colors"
            style={count === n ? { background: CHALK, color: "#4a2400" } : { color: CHALK }}>
            {n} players
          </button>
        ))}
      </div>

      <div className="w-full max-w-sm flex flex-col gap-2">
        {defs.slice(0, count).map((p, i) => (
          <div key={i} className="flex items-center gap-2 rounded-2xl px-2.5 py-2"
            style={{ background: "rgba(255,243,220,.06)", border: `1.5px solid ${TOKEN_PAL[i].label}55` }}>
            <TokenSVG seat={i} className="w-8 h-8 shrink-0" />
            <div className="flex gap-1 flex-1 justify-center">
              {AVATARS.map((a) => (
                <button key={a} onClick={() => upd(i, { avatar: a })}
                  className="w-8 h-8 rounded-full text-base flex items-center justify-center transition-transform active:scale-90"
                  style={p.avatar === a ? { background: "rgba(255,243,220,.14)", boxShadow: `0 0 0 2px ${TOKEN_PAL[i].label}` } : {}}>
                  {a}
                </button>
              ))}
            </div>
            <button onClick={() => upd(i, { kind: p.kind === "human" ? "robot" : "human" })}
              className="biti-display font-bold text-xs px-2.5 py-1.5 rounded-full shrink-0"
              style={{ border: `1.5px solid ${CHALK}55`, color: CHALK, minWidth: 74, textAlign: "center" }}>
              {p.kind === "human" ? "🙋 Human" : "🤖 Robot"}
            </button>
          </div>
        ))}
      </div>

      <button onClick={() => onStart(defs.slice(0, count).map(({ avatar, kind }) => ({ avatar, kind })))}
        className="biti-display font-extrabold text-xl px-10 py-3 rounded-full active:scale-95 transition-transform" style={primaryBtn}>
        Roll the dice! 🎲
      </button>

      <button onClick={onRules} className="biti-display text-amber-200/80 underline underline-offset-4 text-sm">
        How to play?
      </button>
    </div>
  );
}

/* ================= Game screen ================= */
function GameScreen({ game, bursts, onRoll, onPick, onMenu, sound, onSound, onRules, onSettings }) {
  const cur = game.players[game.turnIdx];
  const humanTurn = cur.kind === "human" && !game.busy && !game.rolling && game.winner == null && !game.awaiting;
  const choosing = !!game.awaiting && cur.kind === "human";
  return (
    <div className="relative z-10 min-h-screen flex flex-col px-2.5 py-3 gap-2 max-w-md mx-auto" style={{ animation: "bitiRise .35s ease-out" }}>
      <div className="flex items-center justify-between px-0.5">
        <button onClick={onMenu} aria-label="Back to setup" className="biti-display font-bold text-sm px-3 py-1.5 rounded-full" style={{ border: `1.5px solid ${CHALK}44`, color: CHALK }}>
          ⌂ Menu
        </button>
        <div className="biti-display font-extrabold text-lg" style={{ color: CHALK, transform: "rotate(-1.5deg)" }}>Ludo</div>
        <div className="flex gap-1.5">
          <IconBtn label="Rules" onClick={onRules}>?</IconBtn>
          <IconBtn label="Sound" onClick={onSound}>{sound ? "🔊" : "🔇"}</IconBtn>
          <IconBtn label="Settings" onClick={onSettings}>⚙</IconBtn>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0">
        <BoardLudo game={game} bursts={bursts} onPick={onPick} choosing={choosing} />
      </div>

      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ background: "rgba(255,243,220,.06)", border: `1.5px solid ${TOKEN_PAL[cur.seat].label}88`, boxShadow: `0 0 14px ${TOKEN_PAL[cur.seat].label}44` }}>
          <TokenSVG seat={cur.seat} className="w-7 h-7" mood="wide" />
          <div className="biti-display font-bold text-sm" style={{ color: CHALK }}>
            {playerName(cur)}
            <div className="text-xs font-semibold text-amber-200/70">
              {game.winner != null ? "finished!" : choosing ? "pick a glowing token ✨"
                : cur.kind === "robot"
                  ? <>rolling{[0, 1, 2].map((i) => <span key={i} style={{ animation: `bitiThink 1.1s ${i * 0.18}s infinite` }}>.</span>)}</>
                  : game.busy || game.rolling ? "moving…" : "your roll! ✨"}
            </div>
          </div>
        </div>
        <button onClick={onRoll} disabled={!humanTurn} aria-label="Roll the dice"
          className="relative active:scale-95 transition-transform"
          style={{ width: 74, height: 74, opacity: humanTurn ? 1 : 0.85 }}>
          <DiceSVG val={game.dice} className="w-full h-full"
            style={{ animation: game.rolling ? "ldShake .5s ease-in-out infinite" : humanTurn ? "ldPulse 1.4s ease-in-out infinite" : "none" }} />
        </button>
      </div>

      <div className="flex gap-1.5 justify-center">
        {game.players.map((p) => {
          const active = p.seat === game.turnIdx && game.winner == null;
          const home = p.tokens.filter((r) => r === 57).length;
          return (
            <div key={p.seat} className="flex items-center gap-1.5 px-2 py-1.5 rounded-2xl"
              style={{
                background: "rgba(255,243,220,.05)",
                border: `1.5px solid ${active ? TOKEN_PAL[p.seat].label : CHALK + "1e"}`,
                boxShadow: active ? `0 0 10px ${TOKEN_PAL[p.seat].label}55` : "none",
              }}>
              <span className="text-base leading-none">{p.avatar}</span>
              {p.kind === "robot" && <span className="text-xs leading-none">🤖</span>}
              <span className="biti-display font-bold text-xs" style={{ color: CHALK }}>🏠{home}</span>
            </div>
          );
        })}
      </div>
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

/* ================= Board ================= */
function BoardLudo({ game, bursts, onPick, choosing }) {
  const legalSet = new Set(choosing ? game.awaiting.moves.map((m) => m.ti) : []);
  // cluster: group visible tokens by rounded position
  const groups = {};
  game.players.forEach((p) => {
    p.tokens.forEach((rel, ti) => {
      const { x, y } = cellOf(p.seat, rel, ti);
      const key = Math.round(x * 2) + ":" + Math.round(y * 2);
      groups[key] = groups[key] || [];
      groups[key].push(p.seat + "-" + ti);
    });
  });
  const OFFS = [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]];
  return (
    <div className="relative w-full" style={{ maxWidth: 430, aspectRatio: "1 / 1" }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <defs>
          <radialGradient id="ldGround" cx="50%" cy="42%" r="78%">
            <stop offset="0%" stopColor="#7A4A2D" />
            <stop offset="60%" stopColor="#5F371F" />
            <stop offset="100%" stopColor="#432414" />
          </radialGradient>
          <filter id="ldGrain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="linear" slope="0.05" /></feComponentTransfer>
            <feComposite operator="in" in2="SourceGraphic" />
          </filter>
        </defs>
        <rect x="0" y="0" width="100" height="100" rx="6" fill="url(#ldGround)" />
        <rect x="0" y="0" width="100" height="100" rx="6" fill="#fff" filter="url(#ldGrain)" />
        <rect x="0.6" y="0.6" width="98.8" height="98.8" rx="5.6" fill="none" stroke="#000" strokeOpacity="0.32" strokeWidth="1.4" />

        {/* yards */}
        {[[0, 0], [0, 9], [9, 9], [9, 0]].map(([r, c], seat) => (
          <g key={"y" + seat}>
            <rect x={c * CELL + 0.7} y={r * CELL + 0.7} width={6 * CELL - 1.4} height={6 * CELL - 1.4} rx="3.5"
              fill={TOKEN_PAL[seat].label} opacity="0.16" />
            <rect x={c * CELL + 0.7} y={r * CELL + 0.7} width={6 * CELL - 1.4} height={6 * CELL - 1.4} rx="3.5"
              fill="none" stroke={TOKEN_PAL[seat].label} strokeOpacity="0.55" strokeWidth="0.7" filter="url(#ldChalk)" />
            {YARD_SLOTS[seat].map(([sr, sc], k) => {
              const { x, y } = rcXY(sr, sc);
              return <circle key={k} cx={x} cy={y} r="2.9" fill="rgba(0,0,0,.22)" stroke={TOKEN_PAL[seat].label} strokeOpacity="0.5" strokeWidth="0.5" />;
            })}
          </g>
        ))}

        {/* track cells */}
        {TRACK.map(([r, c], i) => {
          const { x, y } = rcXY(r, c);
          const startSeat = START_IDX.indexOf(i);
          const isStart = startSeat >= 0;
          const isStar = [8, 21, 34, 47].includes(i);
          return (
            <g key={"t" + i}>
              <rect x={x - CELL / 2 + 0.35} y={y - CELL / 2 + 0.35} width={CELL - 0.7} height={CELL - 0.7} rx="1.1"
                fill={isStart ? TOKEN_PAL[startSeat].label : "rgba(255,243,220,.10)"}
                fillOpacity={isStart ? 0.45 : 1}
                stroke={CHALK} strokeOpacity="0.35" strokeWidth="0.3" />
              {(isStar || isStart) && (
                <path d={`M ${x} ${y - 1.7} L ${x + 0.55} ${y - 0.55} L ${x + 1.7} ${y - 0.4} L ${x + 0.85} ${y + 0.45} L ${x + 1.05} ${y + 1.6} L ${x} ${y + 1} L ${x - 1.05} ${y + 1.6} L ${x - 0.85} ${y + 0.45} L ${x - 1.7} ${y - 0.4} L ${x - 0.55} ${y - 0.55} Z`}
                  fill={isStart ? "#FFF8E8" : CHALK} opacity={isStart ? 0.9 : 0.6} />
              )}
            </g>
          );
        })}

        {/* home columns */}
        {HOME_COLS.map((col, seat) => (
          <g key={"h" + seat}>
            {col.map(([r, c], k) => {
              const { x, y } = rcXY(r, c);
              return (
                <rect key={k} x={x - CELL / 2 + 0.35} y={y - CELL / 2 + 0.35} width={CELL - 0.7} height={CELL - 0.7} rx="1.1"
                  fill={TOKEN_PAL[seat].label} fillOpacity="0.4" stroke={CHALK} strokeOpacity="0.3" strokeWidth="0.3" />
              );
            })}
          </g>
        ))}

        {/* centre home triangles */}
        {(() => {
          const L = 6 * CELL, R = 9 * CELL, M = 7.5 * CELL;
          const tris = [
            [[L, L], [L, R], [M, M]],   // seat 0 left
            [[L, L], [R, L], [M, M]],   // seat 1 top
            [[R, L], [R, R], [M, M]],   // seat 2 right
            [[L, R], [R, R], [M, M]],   // seat 3 bottom
          ];
          return tris.map((t, seat) => (
            <polygon key={"c" + seat} points={t.map(([px, py]) => `${px},${py}`).join(" ")}
              fill={TOKEN_PAL[seat].label} opacity="0.55" stroke="#26140b" strokeOpacity="0.5" strokeWidth="0.4" />
          ));
        })()}
        <text x={7.5 * CELL} y={7.5 * CELL + 1.2} fontSize="3.4" textAnchor="middle">🏠</text>
      </svg>

      {/* capture / home bursts */}
      {bursts.map((bu) => {
        const cols = [TOKEN_PAL[bu.seat].label, "#FFF3DC", ROSE];
        return (
          <div key={bu.key} className="absolute pointer-events-none" style={{ left: bu.x + "%", top: bu.y + "%", width: 0, height: 0, zIndex: 25 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const a = ((i * 60 + 15) * Math.PI) / 180;
              return (
                <span key={i} className="absolute rounded-full"
                  style={{
                    left: 0, top: 0, width: 8, height: 8, background: cols[i % 3],
                    "--dx": Math.cos(a) * 32 + "px", "--dy": Math.sin(a) * 32 + "px",
                    animation: "ldBurst .65s ease-out forwards",
                  }} />
              );
            })}
          </div>
        );
      })}

      {/* selection halos */}
      {choosing && game.players[game.turnIdx].tokens.map((rel, ti) => {
        if (!legalSet.has(ti)) return null;
        const { x, y } = cellOf(game.turnIdx, rel, ti);
        return (
          <div key={"halo" + ti} className="absolute rounded-full pointer-events-none"
            style={{
              left: x + "%", top: y + "%", width: "11%", height: "11%",
              transform: "translate(-50%,-50%)",
              background: `radial-gradient(closest-side, ${CHALK}77, transparent 72%)`,
              animation: "ldHalo 1.3s ease-in-out infinite", zIndex: 15,
            }} />
        );
      })}

      {/* tokens */}
      {game.players.map((p) =>
        p.tokens.map((rel, ti) => {
          const { x, y } = cellOf(p.seat, rel, ti);
          const key = Math.round(x * 2) + ":" + Math.round(y * 2);
          const grp = groups[key] || [];
          const gi = grp.indexOf(p.seat + "-" + ti);
          const off = grp.length > 1 ? OFFS[gi % 4] : [0, 0];
          const small = grp.length > 1 || rel === 57;
          const pickable = choosing && p.seat === game.turnIdx && legalSet.has(ti);
          return (
            <button key={p.seat + "-" + ti}
              onPointerDown={(e) => { if (pickable) { e.preventDefault(); onPick(ti); } }}
              onClick={(e) => { if (e.detail === 0 && pickable) onPick(ti); }}
              aria-label={`Token ${ti + 1}`}
              className="absolute"
              style={{
                left: x + off[0] + "%", top: y + off[1] - 0.9 + "%",
                width: small ? "5.4%" : "6.4%", height: small ? "5.4%" : "6.4%",
                transform: "translate(-50%,-50%)",
                transition: "left .16s ease, top .16s ease, width .2s, height .2s",
                zIndex: pickable ? 22 : rel === 0 ? 8 : 18,
                pointerEvents: pickable ? "auto" : "none",
                background: "transparent", borderRadius: "50%",
                ...(pickable ? { animation: "ldPulse 1s ease-in-out infinite" } : {}),
              }}>
              <TokenSVG seat={p.seat} className="w-full h-full" mood={pickable ? "wide" : "idle"}
                blinkDelay={((p.seat * 4 + ti) * 0.6).toFixed(1) + "s"} />
            </button>
          );
        })
      )}
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
    color: [MARIGOLD, PEACOCK, ROSE, CHALK, VIOLET][i % 5],
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
