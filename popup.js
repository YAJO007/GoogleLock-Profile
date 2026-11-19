(async () => {
  const s = await chrome.runtime.sendMessage({ type: 'status' });
  const status = document.getElementById('status');
  const lock = document.getElementById('lock');

  if (!s.hasPassword) {
    status.textContent = 'No password set yet.';
  } else {
    status.textContent = 'Unlocked · Alt+Shift+L to lock';
    lock.classList.remove('hidden');
  }

  lock.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'lockNow' });
    window.close();
  });
  document.getElementById('settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
})();
