// Game of Life — moteur principal
// Grille infinie (stockage sparse), pan & zoom, dessin de cellules

(function () {
  function init() {
    const canvas = document.getElementById('gol-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // ── Stockage sparse ───────────────────────────────────────────────
    let cells = new Map(); // clé "x,y" → true

    // ── Caméra ────────────────────────────────────────────────────────
    let cam = { x: 0, y: 0, scale: 16 }; // (x,y) = coord monde au centre du canvas
    const MIN_SCALE = 2;
    const MAX_SCALE = 80;

    // ── Simulation ────────────────────────────────────────────────────
    let running = false;
    let generation = 0;
    let fps = 10;
    let lastStepTime = 0;
    let animId = null;

    // ── Interaction ───────────────────────────────────────────────────
    let panActive = false;
    let panStart = { x: 0, y: 0 };
    let panCamStart = { x: 0, y: 0 };
    let drawActive = false;
    let drawErase = false;
    let lastDrawnCell = null;
    let spaceDown = false;

    // ── DOM ───────────────────────────────────────────────────────────
    const btnPlay   = document.getElementById('btn-play');
    const btnPause  = document.getElementById('btn-pause');
    const btnReset  = document.getElementById('btn-reset');
    const btnRandom = document.getElementById('btn-random');
    const btnCenter = document.getElementById('btn-center');
    const sldSpeed  = document.getElementById('speed-slider');
    const lblGen    = document.getElementById('gen-count');
    const lblCells  = document.getElementById('cell-count');
    const lblZoom   = document.getElementById('zoom-level');
    const lblFps    = document.getElementById('speed-val');
    const statusDot = document.getElementById('status-dot');
    const statusTxt = document.getElementById('status-text');
    const tooltip   = document.getElementById('nav-tooltip');

    // ── Redimensionnement ─────────────────────────────────────────────
    function resize() {
      const container = canvas.parentElement;
      canvas.width  = container.clientWidth;
      canvas.height = container.clientHeight;
    }
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);
    resize();

    // ── Utilitaires ───────────────────────────────────────────────────
    function key(x, y) { return x + ',' + y; }

    function screenToWorld(sx, sy) {
      return {
        x: Math.floor((sx - canvas.width  / 2) / cam.scale + cam.x),
        y: Math.floor((sy - canvas.height / 2) / cam.scale + cam.y),
      };
    }

    function worldToScreen(wx, wy) {
      return {
        x: (wx - cam.x) * cam.scale + canvas.width  / 2,
        y: (wy - cam.y) * cam.scale + canvas.height / 2,
      };
    }

    function getRect() { return canvas.getBoundingClientRect(); }

    // ── Logique Game of Life ──────────────────────────────────────────
    function step() {
      const counts = new Map();

      for (const k of cells.keys()) {
        const comma = k.indexOf(',');
        const cx = parseInt(k, 10);
        const cy = parseInt(k.slice(comma + 1), 10);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nk = key(cx + dx, cy + dy);
            counts.set(nk, (counts.get(nk) || 0) + 1);
          }
        }
      }

      const next = new Map();
      for (const k of cells.keys()) {
        const n = counts.get(k) || 0;
        if (n === 2 || n === 3) next.set(k, true);
      }
      for (const [k, n] of counts) {
        if (!cells.has(k) && n === 3) next.set(k, true);
      }

      cells = next;
      generation++;
    }

    // ── Rendu ─────────────────────────────────────────────────────────
    function render() {
      const W = canvas.width;
      const H = canvas.height;
      const s = cam.scale;

      ctx.fillStyle = '#101010';
      ctx.fillRect(0, 0, W, H);

      const wx0 = Math.floor(cam.x - W / (2 * s)) - 1;
      const wx1 = Math.ceil (cam.x + W / (2 * s)) + 1;
      const wy0 = Math.floor(cam.y - H / (2 * s)) - 1;
      const wy1 = Math.ceil (cam.y + H / (2 * s)) + 1;

      // Grille
      if (s >= 5) {
        ctx.strokeStyle = s >= 12 ? '#1e1e1e' : '#161616';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let gx = wx0; gx <= wx1; gx++) {
          const sx = Math.round((gx - cam.x) * s + W / 2) + 0.5;
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, H);
        }
        for (let gy = wy0; gy <= wy1; gy++) {
          const sy = Math.round((gy - cam.y) * s + H / 2) + 0.5;
          ctx.moveTo(0, sy);
          ctx.lineTo(W, sy);
        }
        ctx.stroke();
      }

      // Repère origine (croix subtile)
      const o = worldToScreen(0, 0);
      if (o.x > -20 && o.x < W + 20 && o.y > -20 && o.y < H + 20) {
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(o.x, o.y - 10); ctx.lineTo(o.x, o.y + 10);
        ctx.moveTo(o.x - 10, o.y); ctx.lineTo(o.x + 10, o.y);
        ctx.stroke();
      }

      // Cellules
      const pad = s > 8 ? 1 : 0;
      ctx.fillStyle = '#e8ff00';
      for (const k of cells.keys()) {
        const comma = k.indexOf(',');
        const cx = parseInt(k, 10);
        const cy = parseInt(k.slice(comma + 1), 10);
        if (cx < wx0 || cx > wx1 || cy < wy0 || cy > wy1) continue;
        const sx = (cx - cam.x) * s + W / 2;
        const sy = (cy - cam.y) * s + H / 2;
        ctx.fillRect(sx + pad, sy + pad, s - pad * 2, s - pad * 2);
      }
    }

    // ── UI ────────────────────────────────────────────────────────────
    function updateUI() {
      if (lblGen)   lblGen.textContent   = generation.toString();
      if (lblCells) lblCells.textContent = cells.size.toString();
      if (lblZoom)  lblZoom.textContent  = Math.round(cam.scale) + 'px';
    }

    function setStatus(isRunning) {
      if (statusDot) statusDot.style.background = isRunning ? '#e8ff00' : '#888';
      if (statusTxt) {
        statusTxt.textContent = isRunning ? 'Live' : 'Pause';
        statusTxt.style.color = isRunning ? '#e8ff00' : '#888';
      }
      if (btnPlay)  btnPlay.style.display  = isRunning ? 'none'  : 'flex';
      if (btnPause) btnPause.style.display = isRunning ? 'flex'  : 'none';
    }

    // ── Boucle principale ─────────────────────────────────────────────
    function loop(now) {
      animId = requestAnimationFrame(loop);
      if (running) {
        const interval = 1000 / fps;
        if (now - lastStepTime >= interval) {
          step();
          lastStepTime = now;
        }
      }
      render();
      updateUI();
    }

    animId = requestAnimationFrame(loop);

    // ── Contrôles ─────────────────────────────────────────────────────
    function startSim() {
      if (running) return;
      running = true;
      lastStepTime = performance.now();
      setStatus(true);
    }

    function pauseSim() {
      running = false;
      setStatus(false);
    }

    function resetSim() {
      pauseSim();
      cells = new Map();
      generation = 0;
    }

    function randomize() {
      cells = new Map();
      generation = 0;
      const W = canvas.width, H = canvas.height, s = cam.scale;
      const wx0 = Math.floor(cam.x - W / (2 * s)) + 2;
      const wx1 = Math.ceil (cam.x + W / (2 * s)) - 2;
      const wy0 = Math.floor(cam.y - H / (2 * s)) + 2;
      const wy1 = Math.ceil (cam.y + H / (2 * s)) - 2;
      for (let x = wx0; x <= wx1; x++)
        for (let y = wy0; y <= wy1; y++)
          if (Math.random() < 0.28) cells.set(key(x, y), true);
    }

    function centerView() {
      cam.x = 0;
      cam.y = 0;
    }

    if (btnPlay)   btnPlay.addEventListener  ('click', startSim);
    if (btnPause)  btnPause.addEventListener ('click', pauseSim);
    if (btnReset)  btnReset.addEventListener ('click', resetSim);
    if (btnRandom) btnRandom.addEventListener('click', randomize);
    if (btnCenter) btnCenter.addEventListener('click', centerView);

    if (sldSpeed) {
      sldSpeed.addEventListener('input', function () {
        fps = parseInt(this.value, 10);
        if (lblFps) lblFps.textContent = fps + ' fps';
      });
    }

    setStatus(false);

    // ── Souris ────────────────────────────────────────────────────────
    function posFromEvent(e) {
      const r = getRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    canvas.addEventListener('mousedown', function (e) {
      e.preventDefault();
      const pos = posFromEvent(e);

      if (e.button === 1 || e.button === 2 || spaceDown) {
        panActive = true;
        panStart = pos;
        panCamStart = { x: cam.x, y: cam.y };
        canvas.style.cursor = 'grabbing';
      } else if (e.button === 0) {
        drawActive = true;
        const wp = screenToWorld(pos.x, pos.y);
        const k = key(wp.x, wp.y);
        drawErase = cells.has(k);
        if (drawErase) cells.delete(k); else cells.set(k, true);
        lastDrawnCell = wp;
      }
    });

    window.addEventListener('mousemove', function (e) {
      const pos = posFromEvent(e);

      if (panActive) {
        cam.x = panCamStart.x - (pos.x - panStart.x) / cam.scale;
        cam.y = panCamStart.y - (pos.y - panStart.y) / cam.scale;
      } else if (drawActive) {
        const wp = screenToWorld(pos.x, pos.y);
        if (!lastDrawnCell || wp.x !== lastDrawnCell.x || wp.y !== lastDrawnCell.y) {
          const k = key(wp.x, wp.y);
          if (drawErase) cells.delete(k); else cells.set(k, true);
          lastDrawnCell = wp;
        }
      }
    });

    window.addEventListener('mouseup', function (e) {
      if (panActive && (e.button === 1 || e.button === 2 || !spaceDown)) {
        panActive = false;
        canvas.style.cursor = spaceDown ? 'grab' : 'crosshair';
      }
      if (e.button === 0) {
        drawActive = false;
        lastDrawnCell = null;
      }
    });

    // ── Molette — zoom centré sur le curseur ──────────────────────────
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      const pos = posFromEvent(e);

      const wx = (pos.x - canvas.width  / 2) / cam.scale + cam.x;
      const wy = (pos.y - canvas.height / 2) / cam.scale + cam.y;

      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      cam.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, cam.scale * factor));

      cam.x = wx - (pos.x - canvas.width  / 2) / cam.scale;
      cam.y = wy - (pos.y - canvas.height / 2) / cam.scale;
    }, { passive: false });

    // ── Espace — mode déplacement ─────────────────────────────────────
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space' && !e.target.closest('input, textarea, button')) {
        e.preventDefault();
        if (!spaceDown) {
          spaceDown = true;
          if (!panActive && !drawActive) canvas.style.cursor = 'grab';
          if (tooltip) tooltip.classList.add('visible');
        }
      }
      // Raccourcis clavier
      if (e.code === 'KeyP' && !e.target.closest('input, textarea')) {
        running ? pauseSim() : startSim();
      }
      if (e.code === 'KeyR' && !e.target.closest('input, textarea')) {
        resetSim();
      }
      if (e.code === 'KeyN' && !e.target.closest('input, textarea')) {
        if (!running) { step(); generation++; }
      }
    });

    window.addEventListener('keyup', function (e) {
      if (e.code === 'Space') {
        spaceDown = false;
        if (!panActive) canvas.style.cursor = 'crosshair';
        if (tooltip) tooltip.classList.remove('visible');
      }
    });

    canvas.style.cursor = 'crosshair';

    // ── Touch — 1 doigt pan, 2 doigts pinch-zoom ─────────────────────
    let lastTouchDist = null;
    let touchPanStart = null;
    let touchCamStart = null;

    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      const r = getRect();
      if (e.touches.length === 1) {
        const t = e.touches[0];
        touchPanStart = { x: t.clientX - r.left, y: t.clientY - r.top };
        touchCamStart = { x: cam.x, y: cam.y };
        lastTouchDist = null;
      } else if (e.touches.length === 2) {
        const [t0, t1] = [e.touches[0], e.touches[1]];
        lastTouchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const mx = (t0.clientX + t1.clientX) / 2 - r.left;
        const my = (t0.clientY + t1.clientY) / 2 - r.top;
        touchPanStart = { x: mx, y: my };
        touchCamStart = { x: cam.x, y: cam.y };
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      const r = getRect();
      if (e.touches.length === 2 && lastTouchDist !== null) {
        const [t0, t1] = [e.touches[0], e.touches[1]];
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const mx = (t0.clientX + t1.clientX) / 2 - r.left;
        const my = (t0.clientY + t1.clientY) / 2 - r.top;

        const wx = (mx - canvas.width  / 2) / cam.scale + cam.x;
        const wy = (my - canvas.height / 2) / cam.scale + cam.y;
        cam.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, cam.scale * dist / lastTouchDist));
        cam.x = wx - (mx - canvas.width  / 2) / cam.scale;
        cam.y = wy - (my - canvas.height / 2) / cam.scale;
        lastTouchDist = dist;

        // Pan avec 2 doigts
        cam.x = touchCamStart.x - (mx - touchPanStart.x) / cam.scale;
        cam.y = touchCamStart.y - (my - touchPanStart.y) / cam.scale;
      } else if (e.touches.length === 1 && touchPanStart) {
        const t = e.touches[0];
        const cx = t.clientX - r.left;
        const cy = t.clientY - r.top;
        cam.x = touchCamStart.x - (cx - touchPanStart.x) / cam.scale;
        cam.y = touchCamStart.y - (cy - touchPanStart.y) / cam.scale;
      }
    }, { passive: false });

    canvas.addEventListener('touchend', function (e) {
      if (e.touches.length === 0) {
        lastTouchDist = null;
        touchPanStart = null;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
