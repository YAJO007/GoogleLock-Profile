const form = document.getElementById('form');
const pw = document.getElementById('pw');
const btn = document.getElementById('btn');
const msg = document.getElementById('msg');
let timer = null;

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
    msg.textContent = `ใส่ผิดหลายครั้งเกินไป รออีก ${left} วินาที`;
    left--;
  };
  tick();
  timer = setInterval(tick, 1000);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  btn.disabled = true;
  msg.textContent = 'กำลังตรวจสอบ…';
  const res = await chrome.runtime.sendMessage({ type: 'unlock', password: pw.value });
  pw.value = '';
  if (res?.ok) {
    msg.textContent = '';
    return; // background restores this tab to its original page
  }
  if (res?.waitSeconds) return countdown(res.waitSeconds);
  btn.disabled = false;
  msg.textContent = res?.error || 'ปลดล็อกไม่สำเร็จ';
  pw.focus();
});

// If another tab unlocked the profile, this tab will be navigated away by background.
