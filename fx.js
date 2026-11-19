// Visual effects: 3D particle globe, card tilt, HUD readouts, hex streams.
(() => {
  // Always animate, even if the OS has animation effects turned off.
  const reduce = false;
  const css = (name) => getComputedStyle(document.body).getPropertyValue(name).trim() || '#00f0ff';

  /* ---------- 3D particle globe ---------- */
  const canvas = document.getElementById('globe');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const N = 900;
    const pts = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = golden * i;
      pts.push([Math.cos(t) * r, y, Math.sin(t) * r]);
    }
    // orbit rings
    const rings = [
      { tilt: 1.15, speed: 0.6, r: 1.32, n: 160 },
      { tilt: -0.55, speed: -0.4, r: 1.5, n: 200 }
    ];
    let W, H, R, dpr;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      R = Math.min(W, H) * 0.34;
    }
    resize();
    window.addEventListener('resize', resize);

    function project(x, y, z) {
      const f = 3.2 / (3.2 + z);
      return [W / 2 + x * R * f, H * 0.5 + y * R * f, f];
    }
    function frame(t) {
      const a = t * 0.00018;
      const tiltX = -0.35;
      const c1 = css('--c1'), c2 = css('--c2');
      ctx.clearRect(0, 0, W, H);
      const ca = Math.cos(a), sa = Math.sin(a), cx = Math.cos(tiltX), sx = Math.sin(tiltX);
      for (const [x0, y0, z0] of pts) {
        const x1 = x0 * ca + z0 * sa;
        const z1 = -x0 * sa + z0 * ca;
        const y2 = y0 * cx - z1 * sx;
        const z2 = y0 * sx + z1 * cx;
        const [px, py, f] = project(x1, y2, z2);
        const depth = (1 - z2) / 2; // 0 back .. 1 front
        ctx.globalAlpha = 0.08 + depth * 0.55;
        ctx.fillStyle = depth > 0.5 ? c1 : c2;
        const s = 0.6 + depth * 1.6 * f;
        ctx.fillRect(px - s / 2, py - s / 2, s, s);
      }
      for (const ring of rings) {
        const ct = Math.cos(ring.tilt), st = Math.sin(ring.tilt);
        const off = t * 0.0006 * ring.speed;
        for (let i = 0; i < ring.n; i++) {
          const th = (i / ring.n) * Math.PI * 2 + off;
          const x = Math.cos(th) * ring.r, z0 = Math.sin(th) * ring.r;
          const y = -z0 * st, z = z0 * ct;
          const [px, py] = project(x, y, z);
          const head = (i / ring.n);
          ctx.globalAlpha = 0.05 + head * 0.5;
          ctx.fillStyle = c1;
          ctx.fillRect(px - 1, py - 1, 2, 2);
        }
      }
      ctx.globalAlpha = 1;
      if (!reduce) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- card tilt + holographic sheen ---------- */
  const tilt = document.getElementById('tilt');
  const card = tilt && tilt.querySelector('.card');
  if (tilt && card && !reduce) {
    tilt.addEventListener('animationend', () => { tilt.style.animation = 'none'; }, { once: true });
    window.addEventListener('pointermove', (e) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      tilt.style.transform = `rotateY(${nx * 18}deg) rotateX(${-ny * 14}deg)`;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
    document.addEventListener('pointerleave', () => { tilt.style.transform = ''; });
  }

  /* ---------- HUD ---------- */
  const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const sid = document.getElementById('sid');
  if (sid) sid.textContent = `${hex(2)}-${hex(2)}-${hex(2)}`;
  const clock = document.getElementById('clock');
  if (clock) {
    const tick = () => {
      const d = new Date();
      clock.textContent = d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    };
    tick();
    setInterval(tick, 1000);
  }
  const uptime = document.getElementById('uptime');
  if (uptime) {
    const start = performance.now();
    setInterval(() => {
      const s = Math.floor((performance.now() - start) / 1000);
      uptime.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }, 1000);
  }

  /* ---------- hex data streams ---------- */
  document.querySelectorAll('.stream').forEach((el) => {
    const lines = [];
    const push = () => {
      lines.push(`0x${hex(2)}  ${hex(4)}`);
      if (lines.length > 40) lines.shift();
      el.textContent = lines.join('\n');
    };
    for (let i = 0; i < 40; i++) push();
    if (!reduce) setInterval(push, 140 + Math.random() * 120);
  });
})();
