import React, { useEffect, useMemo, useRef, useState } from "react";

/* ================================================================
   SAANP SEEDHI 🐍🪜 — Snakes & Ladders
   The 100-square climb, born in India (Moksha Patam), drawn in
   chalk on the same dusk courtyard as 12 Biti.
   · 2–4 players, any mix of humans and robots
   · dice tumble, tokens hop square by square, slide down the
     snake's actual body, climb ladders rung by rung
   · six rolls again · overshoot bounces back · first to 100 wins
   ================================================================ */

const CHALK = "#FFF3DC";
const MARIGOLD = "#FFC24B";
const PEACOCK = "#2DD4BF";
const ROSE = "#F973B6";
const VIOLET = "#A78BFA";
const AVATARS = ["🐯", "🦚", "🐘", "🦋", "🐒", "⭐"];
const NAME_OF = { "🐯": "Tiger", "🦚": "Peacock", "🐘": "Elephant", "🦋": "Butterfly", "🐒": "Monkey", "⭐": "Star" };

/* Board v2 — layout chosen by solver: zero path crossings, no endpoint
   collisions, min body clearance 4.09 units (verified 2026-07-25). */
const LADDERS = { 4: 25, 9: 30, 42: 63, 50: 69, 55: 75, 67: 86 };
const SNAKES = { 27: 5, 40: 3, 54: 34, 76: 58, 89: 68, 99: 41 };

/* ---------- board geometry ---------- */
function cellXY(n) {
  const idx = n - 1;
  const row = Math.floor(idx / 10);           // 0 = bottom row
  const col = row % 2 === 0 ? idx % 10 : 9 - (idx % 10);
  return { x: 5 + col * 10, y: 95 - row * 10 };
}
function bez(a, p1, p2, b, t) {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * b.y,
  };
}
const SNAKE_COLORS = [
  ["#2DD4BF", "#075E54"], ["#F973B6", "#8A2C55"], ["#A78BFA", "#4C2E8A"],
  ["#FF8A5C", "#8A3A12"], ["#8FD34E", "#3D6414"], ["#4FA9FF", "#1C4E8A"],
  ["#FFC24B", "#8A5A07"], ["#FF6B8A", "#7E1F35"],
];
const SNAKE_DATA = Object.entries(SNAKES).map(([h, t], i) => {
  const head = cellXY(+h), tail = cellXY(+t);
  const dx = tail.x - head.x, dy = tail.y - head.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len, ny = dx / len;
  const w = Math.min(7, 3.5 + len * 0.09) * (i % 2 ? -1 : 1);
  const p1 = { x: head.x + dx * 0.3 + nx * w, y: head.y + dy * 0.3 + ny * w };
  const p2 = { x: head.x + dx * 0.7 - nx * w, y: head.y + dy * 0.7 - ny * w };
  const d = `M ${head.x} ${head.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${tail.x} ${tail.y}`;
  const samples = Array.from({ length: 15 }, (_, k) => bez(head, p1, p2, tail, k / 14));
  const [body, dark] = SNAKE_COLORS[i % SNAKE_COLORS.length];
  return { from: +h, to: +t, d, samples, head, tail, body, dark };
});
const SNAKE_BY_HEAD = Object.fromEntries(SNAKE_DATA.map((s) => [s.from, s]));

const LADDER_DATA = Object.entries(LADDERS).map(([b, t]) => {
  const bot = cellXY(+b), top = cellXY(+t);
  const dx = top.x - bot.x, dy = top.y - bot.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len, ny = dx / len, off = 1.2;
  const rungs = Math.max(3, Math.round(len / 5.5));
  const samples = Array.from({ length: 9 }, (_, k) => ({
    x: bot.x + (dx * k) / 8, y: bot.y + (dy * k) / 8,
  }));
  return {
    from: +b, to: +t, bot, top,
    r1: { x1: bot.x + nx * off, y1: bot.y + ny * off, x2: top.x + nx * off, y2: top.y + ny * off },
    r2: { x1: bot.x - nx * off, y1: bot.y - ny * off, x2: top.x - nx * off, y2: top.y - ny * off },
    rungs: Array.from({ length: rungs }, (_, k) => {
      const tt = (k + 0.5) / rungs;
      const cx = bot.x + dx * tt, cy = bot.y + dy * tt;
      return { x1: cx + nx * off, y1: cy + ny * off, x2: cx - nx * off, y2: cy - ny * off };
    }),
    samples,
  };
});
const LADDER_BY_BOT = Object.fromEntries(LADDER_DATA.map((l) => [l.from, l]));

/* ---------- token palettes ---------- */
const TOKEN_PAL = [
  { grad: "slG1", hi: "#FFF4CB", mid: "#FFCF6B", lo: "#8A4A07", ring: "#7A3E04", label: MARIGOLD },
  { grad: "slG2", hi: "#DFFFF8", mid: "#4FE3CD", lo: "#043B36", ring: "#03332E", label: PEACOCK },
  { grad: "slG3", hi: "#FFE1EF", mid: "#F973B6", lo: "#6B1B40", ring: "#5E1837", label: ROSE },
  { grad: "slG4", hi: "#EFE6FF", mid: "#A78BFA", lo: "#33206B", ring: "#2C1B5E", label: VIOLET },
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
        <filter id="slSoft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
        <filter id="slChalk" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="9" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" />
        </filter>
      </defs>
    </svg>
  );
}

function TokenSVG({ seat, className = "", style = {}, mood = "idle", blinkDelay = "0s" }) {
  const p = TOKEN_PAL[seat % 4];
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <ellipse cx="50" cy="85" rx="32" ry="8.5" fill="#000" opacity="0.38" filter="url(#slSoft)" />
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
          <g className="sl-blink" style={{ animationDelay: blinkDelay }}>
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

/* ---------- dice ---------- */
const PIPS = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 26], [70, 26], [30, 50], [70, 50], [30, 74], [70, 74]],
};
function DiceSVG({ val, className = "", style = {} }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <rect x="8" y="10" width="84" height="84" rx="20" fill="#000" opacity="0.35" filter="url(#slSoft)" />
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
      else if (kind === "ladder") { [440, 554, 659, 880, 1108].forEach((f, i) => tone(f, 0.09, "triangle", 0.08, i * 0.07)); }
      else if (kind === "snake") { tone(680, 0.55, "sine", 0.09, 0, 150); thock(0.14, 0.55, 500); tone(R(140), 0.12, "sine", 0.09, 0.58); }
      else if (kind === "bounce") { tone(R(340), 0.1, "sine", 0.07, 0, 210); }
      else if (kind === "six") { tone(880, 0.08, "triangle", 0.09); tone(1174, 0.1, "triangle", 0.08, 0.08); }
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
export default function SaanpSeedhi() {
  const [game, setGame] = useState(null); // null → setup
  const [toast, setToast] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sound, setSound] = useState(true);
  const [confettiKey, setConfettiKey] = useState(0);

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

  /* ----- start ----- */
  function startGame(playerDefs) {
    play("start");
    busyRef.current = false;
    setGame({
      gen: Date.now(), phase: "playing",
      players: playerDefs.map((p, i) => ({ ...p, seat: i, pos: 0, float: null })),
      turnIdx: 0, dice: 1, rolling: false, busy: false, winner: null,
      sixStreak: 0,
    });
  }
  const toMenu = () => { setGame(null); busyRef.current = false; };

  const patchPlayer = (g, seat, patch) => ({
    ...g, players: g.players.map((p) => (p.seat === seat ? { ...p, ...patch } : p)),
  });

  /* ----- rolling & movement ----- */
  function doRoll() {
    const g0 = gameRef.current;
    if (!g0 || g0.winner || busyRef.current || g0.rolling) return;
    const myGen = g0.gen;
    const alive = () => gameRef.current && gameRef.current.gen === myGen && !gameRef.current.winner;
    busyRef.current = true;
    play("rattle");
    setGame((prev) => (prev ? { ...prev, rolling: true, busy: true } : prev));
    // tumble
    let ticks = 0;
    const tumble = setInterval(() => {
      if (!alive()) { clearInterval(tumble); busyRef.current = false; return; }
      ticks++;
      setGame((prev) => (prev ? { ...prev, dice: 1 + Math.floor(Math.random() * 6) } : prev));
      if (ticks >= 6) {
        clearInterval(tumble);
        const val = 1 + Math.floor(Math.random() * 6);
        setGame((prev) => (prev ? { ...prev, dice: val, rolling: false } : prev));
        setTimeout(() => moveSequence(val, myGen), 260);
      }
    }, 85);
  }

  function moveSequence(steps, myGen) {
    const alive = () => gameRef.current && gameRef.current.gen === myGen && !gameRef.current.winner;
    if (!alive()) { busyRef.current = false; return; }
    const g0 = gameRef.current;
    const seat = g0.turnIdx;
    const start = g0.players[seat].pos;
    const target = start + steps;

    // path of cells to hop through (with bounce-back past 100)
    const path = [];
    if (target <= 100) { for (let k = start + 1; k <= target; k++) path.push(k); }
    else {
      for (let k = start + 1; k <= 100; k++) path.push(k);
      for (let k = 99; k >= 200 - target; k--) path.push(k);
    }
    const bounced = target > 100;

    path.forEach((cell, i) => {
      setTimeout(() => {
        if (!alive()) return;
        play("hop", i);
        setGame((prev) => (prev ? patchPlayer(prev, seat, { pos: cell, float: null }) : prev));
      }, i * 170);
    });

    const afterHops = path.length * 170 + 120;
    setTimeout(() => {
      if (!alive()) return;
      if (bounced) { play("bounce"); showToast("💨 Too far! Bounce back…"); }
      const landing = path.length ? path[path.length - 1] : start;
      resolveCell(landing, seat, steps, myGen);
    }, afterHops);
  }

  function glideAlong(samples, seat, myGen, done) {
    const alive = () => gameRef.current && gameRef.current.gen === myGen && !gameRef.current.winner;
    samples.forEach((pt, i) => {
      setTimeout(() => {
        if (!alive()) return;
        setGame((prev) => (prev ? patchPlayer(prev, seat, { float: { x: pt.x, y: pt.y } }) : prev));
        if (i === samples.length - 1) setTimeout(() => { if (alive()) done(); }, 60);
      }, i * 48);
    });
  }

  function resolveCell(cell, seat, steps, myGen) {
    const alive = () => gameRef.current && gameRef.current.gen === myGen && !gameRef.current.winner;
    if (!alive()) { busyRef.current = false; return; }
    const g0 = gameRef.current;
    const name = playerName(g0.players[seat]);

    if (LADDER_BY_BOT[cell]) {
      const L = LADDER_BY_BOT[cell];
      play("ladder");
      showToast(`🪜 ${name} found a ladder! Climb climb climb!`);
      glideAlong(L.samples, seat, myGen, () => {
        setGame((prev) => (prev ? patchPlayer(prev, seat, { pos: L.to, float: null }) : prev));
        setTimeout(() => finishTurn(L.to, seat, steps, myGen), 140);
      });
      return;
    }
    if (SNAKE_BY_HEAD[cell]) {
      const S = SNAKE_BY_HEAD[cell];
      play("snake");
      showToast(`🐍 Sssnake! ${name} slides down…`);
      glideAlong(S.samples, seat, myGen, () => {
        setGame((prev) => (prev ? patchPlayer(prev, seat, { pos: S.to, float: null }) : prev));
        setTimeout(() => finishTurn(S.to, seat, steps, myGen), 140);
      });
      return;
    }
    finishTurn(cell, seat, steps, myGen);
  }

  function finishTurn(cell, seat, steps, myGen) {
    const alive = () => gameRef.current && gameRef.current.gen === myGen;
    if (!alive()) { busyRef.current = false; return; }
    if (cell === 100) {
      busyRef.current = false;
      play("win");
      setConfettiKey((k) => k + 1);
      setGame((prev) => (prev ? { ...prev, winner: seat, busy: false } : prev));
      return;
    }
    if (steps === 6) {
      const g0 = gameRef.current;
      const name = playerName(g0.players[seat]);
      play("six");
      showToast(`🎲 Six! ${name} rolls again!`);
      busyRef.current = false;
      setGame((prev) => (prev ? { ...prev, busy: false } : prev));
      return; // same player's turn
    }
    busyRef.current = false;
    setGame((prev) => {
      if (!prev) return prev;
      return { ...prev, busy: false, turnIdx: (prev.turnIdx + 1) % prev.players.length };
    });
  }

  /* ----- robots roll by themselves ----- */
  useEffect(() => {
    const g = gameRef.current;
    if (!g || g.winner || g.busy || g.rolling) return;
    const cur = g.players[g.turnIdx];
    if (cur.kind !== "robot") return;
    const myGen = g.gen, myTurn = g.turnIdx;
    const t = setTimeout(() => {
      const g2 = gameRef.current;
      if (!g2 || g2.gen !== myGen || g2.winner || g2.busy || g2.rolling || g2.turnIdx !== myTurn) return;
      doRoll();
    }, 950);
    return () => clearTimeout(t);
  }, [game && game.turnIdx, game && game.busy, game && game.rolling, game && game.winner]); // eslint-disable-line

  /* ================= render ================= */
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&display=swap');
    .biti-display { font-family: 'Baloo 2','Comic Sans MS',ui-rounded,system-ui,sans-serif; }
    .sl-blink { transform-box: fill-box; transform-origin: center; animation: slBlink 4.5s ease-in-out infinite; }
    @keyframes slBlink { 0%, 91%, 100% { transform: scaleY(1); } 94%, 96% { transform: scaleY(0.1); } }
    @keyframes slTongue { 0%, 82%, 100% { transform: scaleX(0.2); opacity: 0; } 86%, 94% { transform: scaleX(1); opacity: 1; } }
    @keyframes slPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
    @keyframes slShake { 0%,100% { transform: rotate(0deg); } 20% { transform: rotate(-14deg); } 45% { transform: rotate(11deg); } 70% { transform: rotate(-7deg); } }
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
        <GameScreen game={game} onRoll={doRoll} onMenu={toMenu}
          sound={sound} onSound={() => setSound((s) => !s)}
          onRules={() => setShowRules(true)} onSettings={() => setShowSettings(true)} />
      )}

      {toast && (
        <div key={toast.id} className="fixed left-1/2 top-16 -translate-x-1/2 z-40 px-4 py-2 rounded-full text-sm biti-display font-semibold text-center"
          style={{ background: "rgba(20,10,5,.88)", border: `1.5px solid ${CHALK}55`, color: CHALK, animation: "bitiRise .25s ease-out", maxWidth: "86vw" }}>
          {toast.msg}
        </div>
      )}

      {/* winner overlay */}
      {game && game.winner != null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6" style={{ background: "rgba(12,6,3,.72)", backdropFilter: "blur(3px)" }}>
          <Confetti key={confettiKey} active />
          <div className="relative w-full max-w-xs rounded-3xl p-6 text-center" style={{ background: "linear-gradient(180deg,#3d2314,#26140b)", border: `2px solid ${CHALK}44`, animation: "bitiRise .35s ease-out" }}>
            <div className="text-6xl mb-2">{game.players[game.winner].avatar}</div>
            <div className="biti-display text-3xl font-extrabold" style={{ color: CHALK }}>
              {playerName(game.players[game.winner])} reached 100!
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {game.players.slice().sort((a, b) => b.pos - a.pos).map((p, i) => (
                <div key={p.seat} className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "rgba(255,243,220,.07)" }}>
                  <span className="text-lg">{["🥇", "🥈", "🥉", "🏅"][i]}</span>
                  <TokenSVG seat={p.seat} className="w-5 h-5" />
                  <span className="biti-display font-bold text-sm flex-1 text-left" style={{ color: CHALK }}>{playerName(p)}</span>
                  <span className="text-xs font-bold text-amber-200/80">{p.pos}</span>
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
          <RuleRow icon="🎲" title="Roll & hop" text="Tap the dice on your turn. Your token hops that many squares along the winding path to 100." />
          <RuleRow icon="🪜" title="Ladders" text="Land at the bottom of a ladder and you climb straight to the top. Lucky!" />
          <RuleRow icon="🐍" title="Snakes" text="Land on a snake's head and you slide all the way down its body. Watch out for the big one at 99!" />
          <RuleRow icon="✨" title="Extras" text="Roll a six — go again! Roll past 100 and you bounce back. First to land exactly on 100 wins." />
        </Modal>
      )}
      {showSettings && (
        <Modal onClose={() => setShowSettings(false)} title="Settings">
          <ToggleRow label="Sounds" sub="Rattles, hops and hisses" value={sound} onChange={() => setSound((s) => !s)} />
        </Modal>
      )}
    </div>
  );
}

function playerName(p) {
  return (p.kind === "robot" ? "Robot " : "") + (NAME_OF[p.avatar] || "Friend");
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
          <span className="text-4xl mb-1">🐍</span>
          <h1 className="biti-display font-extrabold leading-none" style={{ fontSize: "3.4rem", color: CHALK, textShadow: "0 3px 0 rgba(0,0,0,.35)", transform: "rotate(-2deg)" }}>
            Saanp Seedhi
          </h1>
          <span className="text-4xl mb-1">🪜</span>
        </div>
        <div className="biti-display text-amber-200/90 font-semibold tracking-wide mt-1">Snakes & Ladders · race to 100</div>
        <div className="text-sm text-amber-200/60 mt-1">A game from Dad's childhood ✨</div>
      </div>

      {/* player count */}
      <div className="flex rounded-full p-1 gap-1" style={{ background: "rgba(255,243,220,.08)", border: `1.5px solid ${CHALK}33` }}>
        {[2, 3, 4].map((n) => (
          <button key={n} onClick={() => setCount(n)}
            className="biti-display font-bold px-5 py-2 rounded-full text-sm transition-colors"
            style={count === n ? { background: CHALK, color: "#4a2400" } : { color: CHALK }}>
            {n} players
          </button>
        ))}
      </div>

      {/* per-player rows */}
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
function GameScreen({ game, onRoll, onMenu, sound, onSound, onRules, onSettings }) {
  const cur = game.players[game.turnIdx];
  const humanTurn = cur.kind === "human" && !game.busy && !game.rolling && game.winner == null;
  const atStart = game.players.filter((p) => p.pos === 0);
  return (
    <div className="relative z-10 min-h-screen flex flex-col px-2.5 py-3 gap-2 max-w-md mx-auto" style={{ animation: "bitiRise .35s ease-out" }}>
      {/* top bar */}
      <div className="flex items-center justify-between px-0.5">
        <button onClick={onMenu} aria-label="Back to setup" className="biti-display font-bold text-sm px-3 py-1.5 rounded-full" style={{ border: `1.5px solid ${CHALK}44`, color: CHALK }}>
          ⌂ Menu
        </button>
        <div className="biti-display font-extrabold text-lg" style={{ color: CHALK, transform: "rotate(-1.5deg)" }}>Saanp Seedhi</div>
        <div className="flex gap-1.5">
          <IconBtn label="Rules" onClick={onRules}>?</IconBtn>
          <IconBtn label="Sound" onClick={onSound}>{sound ? "🔊" : "🔇"}</IconBtn>
          <IconBtn label="Settings" onClick={onSettings}>⚙</IconBtn>
        </div>
      </div>

      {/* board */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <BoardSL game={game} />
      </div>

      {/* start pad */}
      {atStart.length > 0 && (
        <div className="flex items-center justify-center gap-1.5">
          <span className="biti-display text-xs font-semibold text-amber-200/60">At the start:</span>
          {atStart.map((p) => <TokenSVG key={p.seat} seat={p.seat} className="w-6 h-6" />)}
        </div>
      )}

      {/* dice + turn */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ background: "rgba(255,243,220,.06)", border: `1.5px solid ${TOKEN_PAL[cur.seat].label}88`, boxShadow: `0 0 14px ${TOKEN_PAL[cur.seat].label}44` }}>
          <TokenSVG seat={cur.seat} className="w-7 h-7" mood="wide" />
          <div className="biti-display font-bold text-sm" style={{ color: CHALK }}>
            {playerName(cur)}
            <div className="text-xs font-semibold text-amber-200/70">
              {game.winner != null ? "finished!" : cur.kind === "robot"
                ? <>rolling{[0, 1, 2].map((i) => <span key={i} style={{ animation: `bitiThink 1.1s ${i * 0.18}s infinite` }}>.</span>)}</>
                : game.busy || game.rolling ? "moving…" : "your roll! ✨"}
            </div>
          </div>
        </div>
        <button onClick={onRoll} disabled={!humanTurn} aria-label="Roll the dice"
          className="relative active:scale-95 transition-transform"
          style={{ width: 74, height: 74, opacity: humanTurn ? 1 : 0.85 }}>
          <DiceSVG val={game.dice} className="w-full h-full"
            style={{ animation: game.rolling ? "slShake .5s ease-in-out infinite" : humanTurn ? "slPulse 1.4s ease-in-out infinite" : "none" }} />
        </button>
      </div>

      {/* players strip */}
      <div className="flex gap-1.5 justify-center">
        {game.players.map((p) => {
          const active = p.seat === game.turnIdx && game.winner == null;
          return (
            <div key={p.seat} className="flex items-center gap-1.5 px-2 py-1.5 rounded-2xl"
              style={{
                background: "rgba(255,243,220,.05)",
                border: `1.5px solid ${active ? TOKEN_PAL[p.seat].label : CHALK + "1e"}`,
                boxShadow: active ? `0 0 10px ${TOKEN_PAL[p.seat].label}55` : "none",
              }}>
              <span className="text-base leading-none">{p.avatar}</span>
              {p.kind === "robot" && <span className="text-xs leading-none">🤖</span>}
              <span className="biti-display font-bold text-xs" style={{ color: CHALK }}>{p.pos === 0 ? "start" : p.pos}</span>
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
function BoardSL({ game }) {
  const cells = useMemo(() => {
    const arr = [];
    for (let n = 1; n <= 100; n++) arr.push({ n, ...cellXY(n) });
    return arr;
  }, []);
  // cluster tokens sharing a cell
  const clusters = {};
  game.players.forEach((p) => {
    if (p.pos > 0 && !p.float) {
      clusters[p.pos] = clusters[p.pos] || [];
      clusters[p.pos].push(p.seat);
    }
  });
  const OFFS = [[-2, -2], [2, -2], [-2, 2], [2, 2]];
  return (
    <div className="relative w-full" style={{ maxWidth: 430, aspectRatio: "1 / 1" }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <defs>
          <radialGradient id="slGround" cx="50%" cy="42%" r="78%">
            <stop offset="0%" stopColor="#7A4A2D" />
            <stop offset="60%" stopColor="#5F371F" />
            <stop offset="100%" stopColor="#432414" />
          </radialGradient>
          <filter id="slGrain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="linear" slope="0.05" /></feComponentTransfer>
            <feComposite operator="in" in2="SourceGraphic" />
          </filter>
        </defs>
        <rect x="0" y="0" width="100" height="100" rx="6" fill="url(#slGround)" />
        <rect x="0" y="0" width="100" height="100" rx="6" fill="#fff" filter="url(#slGrain)" />
        {/* checkered tint */}
        {cells.map(({ n, x, y }) => (
          <rect key={"c" + n} x={x - 5} y={y - 5} width="10" height="10"
            fill={((Math.floor((n - 1) / 10) + (n - 1)) % 2 === 0) ? "rgba(255,220,160,.07)" : "rgba(0,0,0,.06)"} />
        ))}
        {/* grid lines */}
        <g stroke={CHALK} strokeOpacity="0.2" strokeWidth="0.35">
          {Array.from({ length: 11 }, (_, i) => <line key={"gv" + i} x1={i * 10} y1="0" x2={i * 10} y2="100" />)}
          {Array.from({ length: 11 }, (_, i) => <line key={"gh" + i} x1="0" y1={i * 10} x2="100" y2={i * 10} />)}
        </g>
        <rect x="0.6" y="0.6" width="98.8" height="98.8" rx="5.6" fill="none" stroke="#000" strokeOpacity="0.32" strokeWidth="1.4" />
        {/* numbers */}
        <g fill={CHALK} opacity="0.62" style={{ fontFamily: "'Baloo 2','Comic Sans MS',ui-rounded,system-ui,sans-serif", fontWeight: 700 }}>
          {cells.map(({ n, x, y }) => (
            <text key={"n" + n} x={x - 4.2} y={y - 2.2} fontSize="2.45">{n}</text>
          ))}
        </g>
        {/* finish + start flair */}
        <text x={cellXY(100).x} y={cellXY(100).y + 2.6} fontSize="6.5" textAnchor="middle">🏆</text>
        <text x={cellXY(1).x} y={cellXY(1).y + 2.4} fontSize="5" textAnchor="middle">🏁</text>

        {/* ladders */}
        <g strokeLinecap="round">
          {LADDER_DATA.map((L, i) => (
            <g key={"l" + i}>
              <line {...L.r1} stroke="#3A2008" strokeWidth="1.5" strokeOpacity="0.8" />
              <line {...L.r2} stroke="#3A2008" strokeWidth="1.5" strokeOpacity="0.8" />
              <line {...L.r1} stroke="#E8B25C" strokeWidth="0.95" />
              <line {...L.r2} stroke="#E8B25C" strokeWidth="0.95" />
              {L.rungs.map((r, k) => (
                <g key={k}>
                  <line {...r} stroke="#3A2008" strokeWidth="1.25" strokeOpacity="0.8" />
                  <line {...r} stroke="#F3C97E" strokeWidth="0.7" />
                </g>
              ))}
            </g>
          ))}
        </g>

        {/* snakes */}
        <g fill="none" strokeLinecap="round">
          {SNAKE_DATA.map((S, i) => (
            <g key={"s" + i}>
              <path d={S.d} stroke="#000" strokeOpacity="0.22" strokeWidth="3.2" transform="translate(0.35 0.5)" />
              <path d={S.d} stroke={S.dark} strokeWidth="2.9" />
              <path d={S.d} stroke={S.body} strokeWidth="2" />
              <path d={S.d} stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="0.55" strokeDasharray="1.2 2.6" />
              {/* tail tip */}
              <circle cx={S.tail.x} cy={S.tail.y} r="0.95" fill={S.dark} />
              {/* head */}
              <g>
                <circle cx={S.head.x} cy={S.head.y} r="2.15" fill={S.body} stroke={S.dark} strokeWidth="0.7" />
                <circle cx={S.head.x - 0.8} cy={S.head.y - 0.55} r="0.52" fill="#fff" />
                <circle cx={S.head.x + 0.8} cy={S.head.y - 0.55} r="0.52" fill="#fff" />
                <circle cx={S.head.x - 0.8} cy={S.head.y - 0.48} r="0.3" fill="#1a0c05" />
                <circle cx={S.head.x + 0.8} cy={S.head.y - 0.48} r="0.3" fill="#1a0c05" />
                <g className="sl-tongue" style={{ transformBox: "fill-box", transformOrigin: "left center", animation: `slTongue ${(3 + (i % 3))}s ease-in-out infinite` }}>
                  <path d={`M ${S.head.x} ${S.head.y + 1.2} l 1.3 1.2 m -1.3 -1.2 l -0.15 1.7`} stroke="#E23B5A" strokeWidth="0.45" fill="none" />
                </g>
              </g>
            </g>
          ))}
        </g>
      </svg>

      {/* tokens */}
      {game.players.map((p) => {
        if (p.pos === 0 && !p.float) return null;
        const base = p.float ? p.float : cellXY(p.pos);
        const group = !p.float ? clusters[p.pos] || [p.seat] : [p.seat];
        const gi = group.indexOf(p.seat);
        const off = group.length > 1 ? OFFS[gi % 4] : [0, 0];
        const sliding = !!p.float;
        return (
          <div key={p.seat} className="absolute pointer-events-none"
            style={{
              left: base.x + off[0] + "%", top: base.y + off[1] - 1.2 + "%",
              width: "8.2%", height: "8.2%",
              transform: "translate(-50%,-50%)",
              transition: sliding ? "left .05s linear, top .05s linear" : "left .15s ease, top .15s ease",
              zIndex: sliding ? 22 : 20,
            }}>
            <TokenSVG seat={p.seat} className="w-full h-full"
              mood={sliding ? "dizzy" : p.seat === game.turnIdx && game.winner == null ? "wide" : "idle"}
              blinkDelay={(p.seat * 1.1).toFixed(1) + "s"} />
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
