const $ = (id) => document.getElementById(id);
let existing = false;

(async () => {
  const s = await chrome.runtime.sendMessage({ type: 'status' });
  existing = s.hasPassword;
  $('idle').value = s.hasPassword ? s.idleMinutes : 10;
  if (existing) {
    $('title').textContent = 'CONFIG';
    $('title').dataset.text = 'CONFIG';
    $('currentWrap').classList.remove('hidden');
    $('pw1Label').textContent = 'NEW PASSPHRASE (เว้นว่างถ้าไม่เปลี่ยน)';
  }
  (existing ? $('current') : $('pw1')).focus();
})();

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('msg');
  msg.className = 'msg error';
  const pw1 = $('pw1').value;
  const pw2 = $('pw2').value;

  if (!existing && !pw1) return (msg.textContent = 'กรุณาตั้งรหัสผ่าน');
  if (pw1 !== pw2) return (msg.textContent = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน');

  $('btn').disabled = true;
  msg.className = 'msg';
  msg.textContent = 'DEPLOYING...';
  const res = await chrome.runtime.sendMessage({
    type: 'setPassword',
    current: $('current').value,
    newPassword: pw1,
    idleMinutes: $('idle').value
  });
  $('btn').disabled = false;

  if (res?.ok) {
    msg.className = 'msg ok';
    msg.textContent = '✔ DEPLOYED · กด Alt+Shift+L เพื่อลองล็อก';
    $('current').value = $('pw1').value = $('pw2').value = '';
    if (!existing) {
      existing = true;
      $('currentWrap').classList.remove('hidden');
      $('pw1Label').textContent = 'NEW PASSPHRASE (เว้นว่างถ้าไม่เปลี่ยน)';
    }
  } else {
    msg.className = 'msg error';
    msg.textContent = res?.error || 'บันทึกไม่สำเร็จ';
  }
});
