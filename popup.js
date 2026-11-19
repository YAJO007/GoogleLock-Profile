(async () => {
  const s = await chrome.runtime.sendMessage({ type: 'status' });
  const status = document.getElementById('status');
  const lock = document.getElementById('lock');

  if (!s.hasPassword) {
    status.textContent = 'STATUS: NOT CONFIGURED';
  } else {
    status.textContent = 'STATUS: UNLOCKED · Alt+Shift+L';
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
