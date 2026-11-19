const form = document.getElementById('form');
const pw = document.getElementById('pw');
const btn = document.getElementById('btn');
const msg = document.getElementById('msg');
const status = document.getElementById('status');
const count = document.getElementById('count');
const tag = document.getElementById('tag');
const title = document.getElementById('title');
let timer = null;

function setTitle(text) {
  title.textContent = text;
  title.dataset.text = text;
}

function alarm() {
  document.body.classList.remove('alarm');
  form.classList.remove('shake');
  void form.offsetWidth; // restart animations
  document.body.classList.add('alarm');
  form.classList.add('shake');
  setTitle('Access Denied');
  tag.textContent = '// INTRUSION ATTEMPT';
  clearTimeout(alarm.t);
  alarm.t = setTimeout(() => {
    document.body.classList.remove('alarm');
    setTitle('System Locked');
    tag.textContent = '// RESTRICTED ZONE';
  }, 2200);
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
    msg.textContent = `Lockout active · retry in ${left}s`;
    left--;
  };
  tick();
  timer = setInterval(tick, 1000);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  btn.disabled = true;
  msg.className = 'msg';
  msg.textContent = 'Verifying credentials…';
  const res = await chrome.runtime.sendMessage({ type: 'unlock', password: pw.value });
  pw.value = '';
  if (res?.ok) {
    document.body.classList.add('granted');
    setTitle('Access Granted');
    tag.textContent = '// IDENTITY VERIFIED';
    msg.className = 'msg ok';
    msg.textContent = 'Restoring session…';
    status.textContent = 'Unlocked';
    status.classList.add('on');
    count.textContent = '';
    return; // background restores this tab to its original page
  }
  alarm();
  msg.className = 'msg error';
  if (res?.fails) count.textContent = `Attempt ${res.fails}`;
  if (res?.waitSeconds) return countdown(res.waitSeconds);
  btn.disabled = false;
  msg.textContent = res?.error || 'Authentication failed.';
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
