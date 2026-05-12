// popup.js — kleine UI fuer das Browser-Action-Popup.
//
// Holt Heute-Counter via background-Worker und zeigt Per-Vendor-Liste.
// Verlinkt auf Options-Page wenn Tenant-Key fehlt.

async function loadStats() {
  const stats = await chrome.runtime.sendMessage({ type: 'rsd:get-stats' });
  const vendorEntries = Object.entries(stats || {})
    .filter(([k]) => k !== '_total')
    .sort((a, b) => b[1] - a[1]);
  const total = stats?._total ?? 0;

  document.getElementById('total').textContent = String(total);

  const ul = document.getElementById('vendors');
  ul.innerHTML = '';
  if (vendorEntries.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Noch keine AI-Nutzung erkannt heute.';
    ul.appendChild(li);
  } else {
    for (const [vendor, count] of vendorEntries) {
      const li = document.createElement('li');
      const v = document.createElement('span');
      v.className = 'vendor';
      v.textContent = vendor;
      const c = document.createElement('span');
      c.className = 'count';
      c.textContent = String(count);
      li.appendChild(v);
      li.appendChild(c);
      ul.appendChild(li);
    }
  }
}

async function checkTenantKey() {
  const stored = await chrome.storage.local.get('tenantKey');
  if (!stored.tenantKey) {
    document.getElementById('no-tenant').style.display = 'block';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  checkTenantKey();

  for (const id of ['open-options', 'open-options-2']) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
      });
    }
  }
});
