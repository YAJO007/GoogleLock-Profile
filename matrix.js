// Matrix-style digital rain background
(() => {
  const canvas = document.getElementById('matrix');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const glyphs = 'アカサタナハマヤラワ0123456789ABCDEF<>/{}[]#$%&*+=ｱｲｳｴｵｶｷｸｹｺ01';
  const size = 16;
  let cols = 0;
  let drops = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cols = Math.ceil(canvas.width / size);
    drops = Array.from({ length: cols }, () => Math.floor(Math.random() * -50));
  }
  resize();
  window.addEventListener('resize', resize);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function draw() {
    ctx.fillStyle = 'rgba(2, 4, 3, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${size}px monospace`;
    for (let i = 0; i < cols; i++) {
      const ch = glyphs[Math.floor(Math.random() * glyphs.length)];
      const y = drops[i] * size;
      ctx.fillStyle = Math.random() > 0.975 ? '#d9fff0' : '#00ff9c';
      ctx.fillText(ch, i * size, y);
      if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
  }

  if (reduce) {
    for (let i = 0; i < 60; i++) draw();
    return;
  }
  let last = 0;
  (function loop(t) {
    if (t - last > 45) { draw(); last = t; }
    requestAnimationFrame(loop);
  })(0);
})();
