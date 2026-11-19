const form = document.getElementById('form');
const pw = document.getElementById('pw');
const btn = document.getElementById('btn');
const msg = document.getElementById('msg');
const status = document.getElementById('status');
let timer = null;

function shake() {
  form.classList.remove('shake');
  void form.offsetWidth; // restart animation
  form.classList.add('shake');
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
      pw.focus();
      return;
    }
    msg.textContent = `Too many attempts. Try again in ${left}s.`;
    left--;
  };
  tick();
  timer = setInterval(tick, 1000);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  btn.disabled = true;
  msg.className = 'msg';
  msg.textContent = 'Verifying…';
  const res = await chrome.runtime.sendMessage({ type: 'unlock', password: pw.value });
  pw.value = '';
  if (res?.ok) {
    msg.className = 'msg ok';
    msg.textContent = 'Unlocked';
    status.textContent = 'UNLOCKED';
    status.classList.add('on');
    return; // background restores this tab to its original page
  }
  shake();
  msg.className = 'msg error';
  if (res?.waitSeconds) return countdown(res.waitSeconds);
  btn.disabled = false;
  msg.textContent = res?.error || 'Unlock failed.';
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
