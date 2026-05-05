// Animation de fond — page d'accueil
// Petite simulation Game of Life très subtile en arrière-plan

(function () {
  function init() {
    const canvas = document.getElementById('hero-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const S = 10; // taille d'une cellule en px
    let cols, rows, cells, next;

    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      cols = Math.ceil(canvas.width  / S) + 2;
      rows = Math.ceil(canvas.height / S) + 2;
      cells = new Uint8Array(cols * rows);
      next  = new Uint8Array(cols * rows);
      for (let i = 0; i < cells.length; i++)
        cells[i] = Math.random() < 0.22 ? 1 : 0;
    }

    window.addEventListener('resize', resize);
    resize();

    function idx(c, r) { return r * cols + c; }

    function step() {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let n = 0;
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              n += cells[idx((c + dc + cols) % cols, (r + dr + rows) % rows)];
            }
          const alive = cells[idx(c, r)];
          next[idx(c, r)] = (alive ? (n === 2 || n === 3) : n === 3) ? 1 : 0;
        }
      }
      [cells, next] = [next, cells];
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(232,255,0,0.12)';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (cells[idx(c, r)]) {
            ctx.fillRect(c * S, r * S, S - 1, S - 1);
          }
        }
      }
    }

    let last = 0;
    function loop(now) {
      requestAnimationFrame(loop);
      if (now - last < 120) return; // ~8 fps
      last = now;
      step();
      draw();
    }

    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
