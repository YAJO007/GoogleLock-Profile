const $ = (id) => document.getElementById(id);
let existing = false;

function showExistingMode() {
  $('title').textContent = 'Settings';
  $('currentWrap').classList.remove('hidden');
  $('pw1Label').textContent = 'New password (leave blank to keep current)';
}

(async () => {
  const s = await chrome.runtime.sendMessage({ type: 'status' });
  existing = s.hasPassword;
  $('idle').value = s.hasPassword ? s.idleMinutes : 10;
  if (existing) showExistingMode();
  (existing ? $('current') : $('pw1')).focus();
})();

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('msg');
  msg.className = 'msg error';
  const pw1 = $('pw1').value;
  const pw2 = $('pw2').value;

  if (!existing && !pw1) return (msg.textContent = 'Please set a password.');
  if (pw1 !== pw2) return (msg.textContent = 'Passwords do not match.');

  $('btn').disabled = true;
  msg.className = 'msg';
  msg.textContent = 'Saving…';
  const res = await chrome.runtime.sendMessage({
    type: 'setPassword',
    current: $('current').value,
    newPassword: pw1,
    idleMinutes: $('idle').value
  });
  $('btn').disabled = false;

  if (res?.ok) {
    msg.className = 'msg ok';
    msg.textContent = 'Saved. Press Alt+Shift+L to try locking.';
    $('current').value = $('pw1').value = $('pw2').value = '';
    if (!existing) {
      existing = true;
      showExistingMode();
    }
  } else {
    msg.className = 'msg error';
    msg.textContent = res?.error || 'Could not save settings.';
  }
});
