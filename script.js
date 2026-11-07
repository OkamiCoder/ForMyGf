/* =========================================================
   I love u sm — script.js
   ========================================================= */

/* ---------------------------------------------------------
   Пиксельный шаблон сердечка
   --------------------------------------------------------- */
const HEART_PATTERN = [
  [0, 1, 1, 0, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
];

function drawPixelHeart(ctx, x, y, px, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let r = 0; r < HEART_PATTERN.length; r++) {
    for (let c = 0; c < HEART_PATTERN[r].length; c++) {
      if (HEART_PATTERN[r][c]) {
        ctx.fillRect(x + c * px, y + r * px, px, px);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function makePixelHeartSVG(color) {
  const rows = HEART_PATTERN.length;
  const cols = HEART_PATTERN[0].length;
  let rects = '';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (HEART_PATTERN[y][x]) {
        rects += `<rect x="${x}" y="${y}" width="1.05" height="1.05"/>`;
      }
    }
  }
  return `<svg viewBox="0 0 ${cols} ${rows}"
            preserveAspectRatio="xMidYMid meet"
            shape-rendering="crispEdges"
            fill="${color}"
            xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

/* ---------------------------------------------------------
   Фон: падающие пиксельные сердечки
   --------------------------------------------------------- */
(function initBgHearts() {
  const canvas = document.getElementById('bgHearts');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const COLORS = ['#ffb6d5', '#ff9ac9', '#ffc6e3', '#e3b5ff', '#ffd9ea', '#ff8fc4'];

  let W = 0, H = 0;
  let hearts = [];
  let last = performance.now();

  function makeHeart(initial) {
    const px = 2 + Math.floor(Math.random() * 3);
    return {
      x: Math.random() * W,
      y: initial ? Math.random() * H : -80 - Math.random() * 120,
      px,
      speed: 22 + Math.random() * 52,
      drift: 10 + Math.random() * 26,
      phase: Math.random() * Math.PI * 2,
      phaseSpeed: 0.5 + Math.random() * 1.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 0.28 + Math.random() * 0.55,
    };
  }

  function spawnAll() {
    const count = Math.max(12, Math.min(40, Math.round((W * H) / 42000)));
    hearts = Array.from({ length: count }, () => makeHeart(true));
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    spawnAll();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    ctx.clearRect(0, 0, W, H);

    for (const h of hearts) {
      h.y += h.speed * dt;
      h.phase += h.phaseSpeed * dt;
      h.x += Math.sin(h.phase) * h.drift * dt;

      if (h.y > H + 80) Object.assign(h, makeHeart(false));
      if (h.x < -80) h.x = W + 80;
      if (h.x > W + 80) h.x = -80;

      drawPixelHeart(ctx, Math.round(h.x), Math.round(h.y), h.px, h.color, h.alpha);
    }
    requestAnimationFrame(frame);
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  resize();
  requestAnimationFrame(frame);
})();

/* ---------------------------------------------------------
   Сердце из слов — эффект "обрисовки контура"
   --------------------------------------------------------- */
const HeartWords = (function () {
  const canvas = document.getElementById('heartCanvas');
  if (!canvas) return { start() {}, resize() {} };

  const ctx = canvas.getContext('2d');

  const TEXTS = ['i love u', 'Yas'];
  const COLORS = ['#ff5fa2', '#ff86bf', '#c084fc', '#ff9ac9'];

  /* ---------- НАСТРОЙКИ СКОРОСТИ ----------
     revealDur  — за сколько секунд слова полностью обрисуют контур.
                  Меньше → быстрее. (главный параметр)
     wordFade   — плавность появления одного слова.
     hold       — сколько держится готовое сердечко.
     fadeOut    — общее исчезновение перед новым циклом.
     gap        — пауза между циклами.
     shiftPerCycle — сдвиг стартовой точки между циклами. */
  const CFG = {
    revealDur:     1.6,
    wordFade:      0.22,
    hold:          0.9,
    fadeOut:       0.7,
    gap:           0.35,
    shiftPerCycle: 23,
  };

  let W = 0, H = 0, scale = 1, cxRaw = 0, cyRaw = 0;

  let samples = [];
  let totalLen = 0;
  let contour = 0;

  let words = [];
  let spacing = 0;
  let fontSize = 10;

  let offset = 0;

  // тайминги цикла
  let cycleTime = 0;
  let cycleDur = 1;
  let wordStep = 0;
  let revealEnd = 0;
  let fadeStart = 0;

  let outline = null;
  let running = false;
  let last = performance.now();

  /* --- математика сердечка --- */
  function heartPoint(t) {
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);
    return { x, y };
  }

  function buildSamples() {
    const N = 900;
    samples = [];
    let len = 0;
    let prev = null;

    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2;
      const p = heartPoint(t);
      if (prev) len += Math.hypot(p.x - prev.x, p.y - prev.y);
      samples.push({ x: p.x, y: p.y, len });
      prev = p;
    }
    totalLen = len;
  }

  function computeBounds() {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const s of samples) {
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
      if (s.y < minY) minY = s.y;
      if (s.y > maxY) maxY = s.y;
    }
    return { minX, maxX, minY, maxY };
  }

  const toCanvasX = (x) => W / 2 + (x - cxRaw) * scale;
  const toCanvasY = (y) => H / 2 - (y - cyRaw) * scale;

  function pointAtRaw(rawL) {
    let lo = 0, hi = samples.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].len < rawL) lo = mid + 1;
      else hi = mid;
    }
    const b = samples[lo];
    const a = samples[Math.max(0, lo - 1)];
    const seg = b.len - a.len;
    const k = seg > 0 ? (rawL - a.len) / seg : 0;
    return {
      x: a.x + (b.x - a.x) * k,
      y: a.y + (b.y - a.y) * k,
    };
  }

  function computeTimings() {
    const n = words.length;
    if (n === 0) {
      wordStep = 0;
      revealEnd = 0;
      fadeStart = 0;
      cycleDur = 1;
      return;
    }
    wordStep = CFG.revealDur / n;
    revealEnd = CFG.revealDur + CFG.wordFade;
    fadeStart = revealEnd + CFG.hold;
    cycleDur = fadeStart + CFG.fadeOut + CFG.gap;
  }

  function layoutWords() {
    fontSize = Math.max(7, Math.min(16, Math.round(W * 0.022)));
    ctx.font = `${fontSize}px "Press Start 2P", monospace`;

    let maxW = 0;
    for (const t of TEXTS) maxW = Math.max(maxW, ctx.measureText(t).width);

    const slot = maxW + fontSize * 1.7;
    const count = Math.max(6, Math.floor(contour / slot));

    spacing = contour / count;
    words = [];
    for (let i = 0; i < count; i++) {
      words.push({
        text: TEXTS[i % TEXTS.length],
        color: COLORS[i % COLORS.length],
      });
    }
    computeTimings();
  }

  function buildOutline() {
    outline = new Path2D();
    samples.forEach((s, i) => {
      const x = toCanvasX(s.x);
      const y = toCanvasY(s.y);
      if (i === 0) outline.moveTo(x, y);
      else outline.lineTo(x, y);
    });
    outline.closePath();
  }

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    if (rect.width < 10) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(200, Math.round(rect.width));
    H = Math.max(200, Math.round(rect.height));

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const b = computeBounds();
    const rawW = b.maxX - b.minX;
    const rawH = b.maxY - b.minY;
    const pad = 0.15;

    scale = Math.min(
      (W * (1 - pad * 2)) / rawW,
      (H * (1 - pad * 2)) / rawH
    );

    cxRaw = (b.minX + b.maxX) / 2;
    cyRaw = (b.minY + b.maxY) / 2;

    contour = totalLen * scale;

    layoutWords();
    buildOutline();
  }

  function frame(now) {
    if (!running) return;

    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    cycleTime += dt;
    if (cycleTime >= cycleDur) {
      cycleTime -= cycleDur;
      offset = (offset + CFG.shiftPerCycle) % contour;
    }

    ctx.clearRect(0, 0, W, H);

    // пунктирный контур-подсказка (куда рисуем)
    if (outline) {
      ctx.save();
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 8]);
      ctx.strokeStyle = 'rgba(255, 143, 196, 0.18)';
      ctx.stroke(outline);
      ctx.restore();
    }

    // растущий яркий "след пера", синхронный со словами
    let trailLen = 0;
    let trailAlpha = 0;

    if (cycleTime < revealEnd) {
      trailLen = contour * Math.min(1, cycleTime / CFG.revealDur);
      trailAlpha = 0.45;
    } else if (cycleTime < fadeStart) {
      trailLen = contour;
      trailAlpha = 0.45;
    } else if (cycleTime < fadeStart + CFG.fadeOut) {
      trailLen = contour;
      trailAlpha = 0.45 * (1 - (cycleTime - fadeStart) / CFG.fadeOut);
    }

    if (trailLen > 0 && outline) {
      ctx.save();
      ctx.setLineDash([trailLen, 1e6]);
      ctx.lineDashOffset = -offset;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255, 95, 162, ${trailAlpha})`;
      ctx.stroke(outline);
      ctx.restore();
    }

    // сами слова
    ctx.font = `${fontSize}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const appearAt = i * wordStep;

      let alpha;
      if (cycleTime < appearAt) alpha = 0;
      else if (cycleTime < appearAt + CFG.wordFade)
        alpha = (cycleTime - appearAt) / CFG.wordFade;
      else if (cycleTime < fadeStart) alpha = 1;
      else if (cycleTime < fadeStart + CFG.fadeOut)
        alpha = 1 - (cycleTime - fadeStart) / CFG.fadeOut;
      else alpha = 0;

      if (alpha < 0.02) continue;

      let arc = offset + i * spacing;
      arc = ((arc % contour) + contour) % contour;

      const p = pointAtRaw(arc / scale);
      const x = toCanvasX(p.x);
      const y = toCanvasY(p.y);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = w.color;
      ctx.fillText(w.text, x, y);
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  buildSamples();
  window.addEventListener('resize', () => {
    if (running) resize();
  });

  return { start, resize };
})();

/* ---------------------------------------------------------
   Логика сайта
   --------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // пиксельное сердечко в заголовке
  const titleHeart = document.getElementById('titleHeart');
  if (titleHeart) titleHeart.innerHTML = makePixelHeartSVG('#ff5fa2');

  // если баннера нет — просто останется розовая рамка
  const bannerImg = document.getElementById('bannerImg');
  if (bannerImg) {
    bannerImg.addEventListener('error', () => { bannerImg.style.display = 'none'; });
  }

  const tapBtn  = document.getElementById('tapBtn');
  const intro   = document.getElementById('intro');
  const content = document.getElementById('content');
  if (!tapBtn || !intro || !content) return;

  tapBtn.addEventListener('click', () => {
    if (tapBtn.disabled) return;
    tapBtn.disabled = true;

    intro.classList.add('intro-out');
    document.body.classList.remove('locked');

    setTimeout(() => {
      intro.style.display = 'none';
      content.classList.remove('is-hidden');
      content.classList.add('content-in');
      window.scrollTo(0, 0);

      HeartWords.resize();
      HeartWords.start();

      if (document.fonts && document.fonts.ready) {
        document.fonts.ready
          .then(() => HeartWords.resize())
          .catch(() => {});
      }
    }, 430);
  });
});
