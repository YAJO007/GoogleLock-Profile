const form = document.getElementById('form');
const pw = document.getElementById('pw');
const btn = document.getElementById('btn');
const msg = document.getElementById('msg');
const term = document.getElementById('term');
let timer = null;

/* boot-sequence typing effect */
const bootLines = [
  ['> initializing secure shell...', ''],
  ['> session tokens .......... ', 'SEALED'],
  ['> network traffic ......... ', 'BLOCKED'],
  ['> awaiting authentication_', '']
];
(async () => {
  for (const [text, tag] of bootLines) {
    const line = document.createElement('div');
    term.appendChild(line);
    for (const ch of text) {
      line.textContent += ch;
      await new Promise((r) => setTimeout(r, 12));
    }
    if (tag) {
      const s = document.createElement('span');
      s.className = 'warn';
      s.textContent = tag;
      line.appendChild(s);
    }
  }
})();

function flash(cls) {
  form.classList.remove('denied', 'granted');
  void form.offsetWidth; // restart animation
  form.classList.add(cls);
}

function countdown(seconds) {
  clearInterval(timer);
  btn.disabled = true;
  pw.disabled = true;
  let left = seconds;
  const tick = () => {
    if (left <= 0) {
      clearInterval(timer);
      btn.disabled = false;
      pw.disabled = false;
      msg.textContent = '';
      form.classList.remove('denied');
      pw.focus();
      return;
    }
    msg.textContent = `⚠ INTRUSION DETECTED · ระบบล็อกชั่วคราว ${left}s`;
    left--;
  };
  tick();
  timer = setInterval(tick, 1000);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  btn.disabled = true;
  msg.className = 'msg ok';
  msg.textContent = 'DECRYPTING...';
  const res = await chrome.runtime.sendMessage({ type: 'unlock', password: pw.value });
  pw.value = '';
  if (res?.ok) {
    flash('granted');
    msg.className = 'msg ok';
    msg.textContent = '✔ ACCESS GRANTED';
    return; // background restores this tab to its original page
  }
  flash('denied');
  msg.className = 'msg error';
  if (res?.waitSeconds) return countdown(res.waitSeconds);
  btn.disabled = false;
  msg.textContent = '✖ ACCESS DENIED · ' + (res?.error || 'ปลดล็อกไม่สำเร็จ');
  pw.focus();
});

// Deterrent only: discourage opening DevTools on the lock page.
// The real protection is the DeveloperToolsAvailability policy (see policy/).
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  const k = e.key.toUpperCase();
  if (k === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'C'].includes(k)) ||
      ((e.ctrlKey || e.metaKey) && k === 'U')) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);
