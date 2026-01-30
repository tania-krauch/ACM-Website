// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
(function () {
  // Attach to the canvas in the hero section
  const canvas = document.getElementById("binarygrid-canvas");
  if (!canvas) {
    console.error('Canvas element not found!');
    return;
  }
  const ctx = canvas.getContext("2d", { alpha: false });

  // ——— Tunables ———
  const bg = "#ffffff";            // white background
  const bitFg = "#E8E8E8";         // binary glyph color (lighter gray)
  const cloudFg = "#C6CBFF";       // cloud glyph color

  const fontFamily = "monospace";

  let cycleMsBase = 2200;
  const changeJitter = 0.5;

  const cloudCount = 2;
  const cloudRadiusCells = { min: 12, max: 18 };
  const cloudPulseMs = { min: 1600, max: 2400 };

  const pxPerRem = 16;
  const fontSizeRem = 1.0;

  const padding = { left: 0, top: 0, right: 0, bottom: 0 };

  // Make canvas fill its parent (#home)
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.border = "none";
  canvas.style.display = "block";

  let cols = 0, rows = 0, charW = 0, lineH = 0;
  let startX = 0, startY = 0;

  let cells = [];
  let clouds = [];
  let lastTs = 0;
  let running = false;

  // Canvas sizing: sync backing store to CSS size
  function setupCanvasSize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(canvas.clientWidth));
    const h = Math.max(1, Math.floor(canvas.clientHeight));
    const bufW = Math.max(1, Math.floor(w * dpr));
    const bufH = Math.max(1, Math.floor(h * dpr));
    if (canvas.width !== bufW)  canvas.width  = bufW;
    if (canvas.height !== bufH) canvas.height = bufH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setFont() {
    const fontPx = Math.max(10, fontSizeRem * pxPerRem);
    ctx.font = `${fontPx}px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const metr0 = ctx.measureText('0');
    const spaceW = ctx.measureText(' ').width || metr0.width;
    charW = Math.max(metr0.width, spaceW);
    const ascent = metr0.actualBoundingBoxAscent || fontPx * 0.8;
    const descent = metr0.actualBoundingBoxDescent || fontPx * 0.2;
    lineH = Math.ceil(ascent + descent + Math.ceil(fontPx * 0.15));
  }

  function computeLayout() {
    const innerW = Math.max(0, canvas.clientWidth  - (padding.left + padding.right));
    const innerH = Math.max(0, canvas.clientHeight - (padding.top  + padding.bottom));
    cols = Math.max(1, Math.floor(innerW / charW));
    rows = Math.max(1, Math.floor(innerH / lineH));
    const usedW = cols * charW;
    const usedH = rows * lineH;
    const leftoverW = Math.max(0, innerW - usedW);
    const leftoverH = Math.max(0, innerH - usedH);
    startX = padding.left + Math.floor(leftoverW / 2);
    startY = padding.top  + Math.floor(leftoverH / 2);
  }

  function randBit() { return Math.random() < 0.5 ? '0' : '1'; }
  function randRange(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
  function randDur(base) { return base * (1 - changeJitter + Math.random() * (2 * changeJitter)); }
  function clampEven(col) { return (col & 1) ? Math.max(0, col - 1) : col; }
  function easeInOut(t) { return t < 0.5 ? 3*t*t - 2*t*t*t : 1 - Math.pow(1 - (2*t - 1), 3) * 0.5; }

  function makeBitCell(now) {
    return { cur: randBit(), next: randBit(), t0: now + Math.random() * cycleMsBase, dur: randDur(cycleMsBase) };
  }
  function seedBitCells(now) {
    cells = new Array(rows);
    for (let r = 0; r < rows; r++) {
      const row = new Array(cols);
      for (let c = 0; c < cols; c++) row[c] = makeBitCell(now);
      cells[r] = row;
    }
  }

  function makeCloud() {
    const radius = randInt(cloudRadiusCells.min, cloudRadiusCells.max);
    const c = clampEven(randInt(radius, Math.max(radius, cols - 1 - radius)));
    const r = randInt(radius, Math.max(radius, rows - 1 - radius));
    return { 
      c: c + Math.random() * 0.5, 
      r: r + Math.random() * 0.5, 
      radius, 
      pulseMs: randInt(cloudPulseMs.min, cloudPulseMs.max),
      phase: Math.random(),
      stretchX: 1.0,
      stretchY: 1.0
    };
  }
  function makeClouds() { clouds = new Array(cloudCount).fill(0).map(makeCloud); }

  function drawBackground() {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }

  function drawBits(ts) {
    for (let r = 0; r < rows; r++) {
      const y = startY + r * lineH;
      for (let c = 0; c < cols; c += 2) {
        const x = startX + c * charW;
        const cell = cells[r][c];
        const elapsed = ts - cell.t0;

        if (elapsed < 0) {
          ctx.fillStyle = bitFg;
          ctx.fillText(cell.cur, x, y);
        } else if (elapsed < cell.dur) {
          const t = easeInOut(elapsed / cell.dur);
          ctx.fillStyle = bitFg;
          ctx.globalAlpha = 1 - t;
          ctx.fillText(cell.cur, x, y);
          ctx.globalAlpha = t;
          ctx.fillText(cell.next, x, y);
          ctx.globalAlpha = 1;
        } else {
          cell.cur = cell.next;
          cell.next = randBit();
          cell.t0 = ts + Math.random() * (cycleMsBase * 0.8);
          cell.dur = randDur(cycleMsBase);
          ctx.fillStyle = bitFg;
          ctx.fillText(cell.cur, x, y);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // Pointer for geometry-only interactions
  let pointer = { x: 0, y: 0, active: false };

  canvas.addEventListener("pointermove", ev => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = (ev.clientX - rect.left) / charW;
    pointer.y = (ev.clientY - rect.top) / lineH;
    pointer.active = true;
  });
  canvas.addEventListener("pointerleave", () => (pointer.active = false));

  function updateClouds(ts, dtSec) {
    const t = ts * 0.00015;

    for (let i = 0; i < clouds.length; i++) {
      const cl = clouds[i];
      const phase = i * Math.PI;

      // smooth oscillation around center
      const baseC = cols * 0.5 + Math.sin(t * 0.8 + phase) * (cols * 0.18);
      const baseR = rows * 0.5 + Math.cos(t * 0.7 + phase) * (rows * 0.12);

      // gentle easing toward base position
      cl.c += (baseC - cl.c) * 0.05;
      cl.r += (baseR - cl.r) * 0.05;

      // prevent escaping off-screen
      cl.c = Math.max(cl.radius * 0.5, Math.min(cols - cl.radius * 0.5, cl.c));
      cl.r = Math.max(cl.radius * 0.5, Math.min(rows - cl.radius * 0.5, cl.r));

      // elastic mouse interaction (NO COLOR CHANGE)
      if (pointer.active) {
        const dx = pointer.x - cl.c;
        const dy = pointer.y - cl.r;
        const dist = Math.hypot(dx, dy);
        const pull = Math.exp(-dist * 0.04);
        cl.c += dx * pull * 0.4;
        cl.r += dy * pull * 0.4;
        cl.stretchX = 1.0 + 0.6 * pull;
        cl.stretchY = 1.0 + 0.6 * pull;
      } else {
        cl.stretchX += (1.0 - cl.stretchX) * 0.05;
        cl.stretchY += (1.0 - cl.stretchY) * 0.05;
      }

      // breathing radius
      cl.radius = cloudRadiusCells.max * (1.4 + 0.3 * Math.sin(t * 2 + i * 1.3));
    }
  }

  function drawClouds(ts) {
    const t = ts * 0.0005;
    const intensityThreshold = 0.8;

    for (let r = 0; r < rows; r++) {
      const y = startY + r * lineH;
      for (let c = 0; c < cols; c += 2) {
        const x = startX + c * charW;
        let field = 0;

        // Field = sum of stretched metaballs
        for (const cl of clouds) {
          const dx = (c - cl.c) / (cl.radius * cl.stretchX);
          const dy = (r - cl.r) / (cl.radius * cl.stretchY);
          const dist2 = dx * dx + dy * dy;
          field += 1.0 / (1.0 + dist2 * 3.5);
        }

        if (field > intensityThreshold * 0.4) {
          const brightness = Math.min(1, (field - 0.4) * 1.8);
          const hue = 220 + brightness * 40; // VS Code blue→purple
          const alpha = 0.35 + brightness * 0.65;

          ctx.globalAlpha = alpha;
          ctx.fillStyle = `hsl(${hue}, 90%, 65%)`;
          const glyph = field > intensityThreshold ? "#" : "@";
          ctx.fillText(glyph, x, y);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  function drawBackgroundAndAll(ts, dtMs) {
    drawBackground();
    // Clouds first — behind the bits
    ctx.save();
    ctx.filter = "blur(6px)";
    drawClouds(ts);
    ctx.restore();

    drawBits(ts);
  }

  function tick(ts) {
    if (!running) return;
    const dtMs = lastTs ? (ts - lastTs) : 16;
    const dtSec = dtMs / 1000;
    lastTs = ts;

    updateClouds(ts, dtSec);
    drawBackgroundAndAll(ts, dtMs);
    requestAnimationFrame(tick);
  }

  function rebuildAll() {
    setupCanvasSize();
    setFont();
    computeLayout();
    seedBitCells(performance.now());
    makeClouds();
  }

  function start() { running = true; rebuildAll(); lastTs = 0; requestAnimationFrame(tick); }
  function stop()  { running = false; }

  // React to CSS size changes of the canvas
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => { if (running) { stop(); start(); } });
    ro.observe(canvas);
  } else {
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (running) { stop(); start(); } }, 120);
    });
  }

  start();

  window.__binaryStream = {
    start, stop,
    setBitSpeed(ms) { cycleMsBase = Math.max(300, +ms || 2200); }
  };
})()});