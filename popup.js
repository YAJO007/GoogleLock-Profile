(async () => {
  const s = await chrome.runtime.sendMessage({ type: 'status' });
  const status = document.getElementById('status');
  const lock = document.getElementById('lock');

  if (!s.hasPassword) {
    status.textContent = 'ยังไม่ได้ตั้งรหัสผ่าน';
  } else {
    status.textContent = 'ปลดล็อกอยู่ · Alt+Shift+L เพื่อล็อก';
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
