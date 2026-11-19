// Profile Lock — background service worker
const LOCK_PAGE = chrome.runtime.getURL('lock.html');
const SETUP_PAGE = chrome.runtime.getURL('setup.html');
const NEW_TAB = 'chrome://newtab/';
const PBKDF2_ITERATIONS = 310000;
const MAX_FREE_ATTEMPTS = 5;

/* ---------- network-level lock ----------
 * A persistent *dynamic* rule blocks every http(s) request. Unlocking adds a
 * higher-priority *session* "allow" rule. Session rules are wiped by Chrome
 * whenever the browser shuts down, so after any restart (or crash) the block
 * is already active before this service worker even wakes up — pages such as
 * Gmail can't flash on screen while tabs are being restored.
 */
const BLOCK_RULE_ID = 1;
const ALLOW_RULE_ID = 2;
const ALL_TYPES = [
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object',
  'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'other'
];
const ruleFor = (id, priority, type) => ({
  id,
  priority,
  action: { type },
  condition: { urlFilter: '|http', resourceTypes: ALL_TYPES }
});

async function installBlockRule() {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [BLOCK_RULE_ID],
    addRules: [ruleFor(BLOCK_RULE_ID, 1, 'block')]
  });
}
async function allowTraffic() {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ALLOW_RULE_ID],
    addRules: [ruleFor(ALLOW_RULE_ID, 2, 'allow')]
  });
}
async function blockTraffic() {
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ALLOW_RULE_ID] });
}

/* ---------- crypto helpers ---------- */
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveHash(password, saltB64) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key, 256
  );
  return b64(new Uint8Array(bits));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function checkPassword(password) {
  const { hash, salt } = await chrome.storage.local.get(['hash', 'salt']);
  if (!hash || !salt) return false;
  return safeEqual(await deriveHash(password, salt), hash);
}

/* ---------- state ---------- */
// storage.session is wiped when Chrome closes → the profile is locked again on every start.
async function hasPassword() {
  const { hash } = await chrome.storage.local.get('hash');
  return !!hash;
}
async function isUnlocked() {
  const { unlocked } = await chrome.storage.session.get('unlocked');
  return unlocked === true;
}

// Serialise writes to the saved-URL map so concurrent tab events don't clobber each other.
let queue = Promise.resolve();
const serial = (fn) => (queue = queue.then(fn, fn));

function rememberUrl(tabId, url) {
  return serial(async () => {
    const { savedUrls = {} } = await chrome.storage.session.get('savedUrls');
    if (url && !url.startsWith(LOCK_PAGE) && !savedUrls[tabId]) savedUrls[tabId] = url;
    await chrome.storage.session.set({ savedUrls });
  });
}

/* ---------- guarding tabs ---------- */
async function guardTab(tab) {
  if (!tab || tab.id === undefined || tab.id < 0) return;
  const url = tab.pendingUrl || tab.url || '';
  if (url.startsWith(LOCK_PAGE)) return;
  if (!(await hasPassword())) return;
  if (await isUnlocked()) return;
  await rememberUrl(tab.id, url);
  try {
    await chrome.tabs.update(tab.id, { url: LOCK_PAGE });
  } catch (e) {
    // Tab may have closed in the meantime.
  }
}

async function guardAllTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(guardTab));
}

async function setLocked() {
  await blockTraffic();
  await chrome.storage.session.set({ unlocked: false });
}

async function lockNow() {
  if (!(await hasPassword())) return;
  await setLocked();
  await guardAllTabs();
}

async function restoreTabs() {
  const { savedUrls = {} } = await chrome.storage.session.get('savedUrls');
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    const url = tab.pendingUrl || tab.url || '';
    if (!url.startsWith(LOCK_PAGE)) continue;
    try {
      await chrome.tabs.update(tab.id, { url: savedUrls[tab.id] || NEW_TAB });
    } catch (e) {}
  }
  await chrome.storage.session.set({ savedUrls: {} });
}

/* ---------- unlock with brute-force throttling ----------
 * The failure counter lives in storage.local so restarting Chrome does NOT reset it.
 */
async function tryUnlock(password) {
  const { fails = 0, lockoutUntil = 0 } = await chrome.storage.local.get(['fails', 'lockoutUntil']);
  const now = Date.now();
  if (now < lockoutUntil) {
    return { ok: false, waitSeconds: Math.ceil((lockoutUntil - now) / 1000) };
  }
  if (await checkPassword(password || '')) {
    await chrome.storage.local.set({ fails: 0, lockoutUntil: 0 });
    await allowTraffic();
    await chrome.storage.session.set({ unlocked: true });
    await restoreTabs();
    return { ok: true };
  }
  const newFails = fails + 1;
  let until = 0;
  if (newFails >= MAX_FREE_ATTEMPTS) {
    const secs = Math.min(30 * 2 ** (newFails - MAX_FREE_ATTEMPTS), 15 * 60);
    until = now + secs * 1000;
  }
  await chrome.storage.local.set({ fails: newFails, lockoutUntil: until });
  return {
    ok: false,
    error: 'Incorrect password.',
    waitSeconds: until ? Math.ceil((until - now) / 1000) : 0
  };
}

/* ---------- settings ---------- */
async function setPassword({ current, newPassword, idleMinutes }) {
  const existing = await hasPassword();
  if (existing) {
    if (!(await isUnlocked())) return { ok: false, error: 'Unlock the profile first.' };
    if (!(await checkPassword(current || ''))) return { ok: false, error: 'Current password is incorrect.' };
  }
  const update = {};
  if (newPassword) {
    if (newPassword.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
    const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    update.salt = salt;
    update.hash = await deriveHash(newPassword, salt);
  } else if (!existing) {
    return { ok: false, error: 'Please set a password.' };
  }
  update.idleMinutes = Math.max(0, Math.min(240, parseInt(idleMinutes, 10) || 0));
  await chrome.storage.local.set(update);
  // Order matters: allow first, then install the persistent block.
  await allowTraffic();
  await installBlockRule();
  await chrome.storage.session.set({ unlocked: true });
  await applyIdleSetting();
  return { ok: true };
}

async function applyIdleSetting() {
  const { idleMinutes = 0 } = await chrome.storage.local.get('idleMinutes');
  if (idleMinutes > 0) chrome.idle.setDetectionInterval(Math.max(15, idleMinutes * 60));
}

// Keep network rules consistent with the stored state every time the worker wakes.
async function syncRules() {
  if (!(await hasPassword())) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [BLOCK_RULE_ID] });
    return;
  }
  await installBlockRule();
  if (!(await isUnlocked())) await blockTraffic();
}

/* ---------- events ---------- */
chrome.runtime.onInstalled.addListener(async (details) => {
  await syncRules();
  applyIdleSetting();
  if (!(await hasPassword())) {
    chrome.tabs.create({ url: SETUP_PAGE });
  } else {
    // Extension updated/reloaded: lock right away.
    await lockNow();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await setLocked();
  await syncRules();
  applyIdleSetting();
  guardAllTabs();
});

// Last window of this profile closed (e.g. back to the profile picker) → lock.
chrome.windows.onRemoved.addListener(async () => {
  const wins = await chrome.windows.getAll();
  if (wins.length === 0 && (await hasPassword())) {
    await setLocked();
    await chrome.storage.session.set({ savedUrls: {} });
  }
});

// A new window opened while locked (e.g. profile re-opened from the picker) → guard it.
chrome.windows.onCreated.addListener(async () => {
  if ((await hasPassword()) && !(await isUnlocked())) guardAllTabs();
});

chrome.tabs.onCreated.addListener(guardTab);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'loading') guardTab(tab);
});
chrome.tabs.onRemoved.addListener((tabId) =>
  serial(async () => {
    const { savedUrls = {} } = await chrome.storage.session.get('savedUrls');
    delete savedUrls[tabId];
    await chrome.storage.session.set({ savedUrls });
  })
);

chrome.idle.onStateChanged.addListener(async (state) => {
  const { idleMinutes = 0 } = await chrome.storage.local.get('idleMinutes');
  // 'locked' = the OS screen was locked; always lock the profile then.
  if (state === 'locked' || (state === 'idle' && idleMinutes > 0)) lockNow();
});

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === 'lock-now') lockNow();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only accept messages from this extension's own pages.
  if (sender.id !== chrome.runtime.id || (sender.url && !sender.url.startsWith(chrome.runtime.getURL('')))) {
    return false;
  }
  (async () => {
    switch (msg?.type) {
      case 'unlock':
        return tryUnlock(msg.password);
      case 'lockNow':
        await lockNow();
        return { ok: true };
      case 'setPassword':
        return setPassword(msg);
      case 'status': {
        const { idleMinutes = 0 } = await chrome.storage.local.get('idleMinutes');
        return { hasPassword: await hasPassword(), unlocked: await isUnlocked(), idleMinutes };
      }
      default:
        return { ok: false, error: 'unknown message' };
    }
  })().then(sendResponse, (e) => sendResponse({ ok: false, error: String(e) }));
  return true;
});

// Service worker can be restarted at any time — re-apply settings each time it wakes.
applyIdleSetting();
syncRules();
