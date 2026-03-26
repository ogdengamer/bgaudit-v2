// ── State ─────────────────────────────────────────────────────────────────────
// This object holds everything the app needs to know at any given moment.
// When we switch devices, we reload this from the server via the session ID.
const state = {
  sessionId: null,
  locations: [],
  selectedLocations: [],
  games: [],
  reportData: null
};

// ── API ───────────────────────────────────────────────────────────────────────
// All communication with the server goes through these functions.
const api = {
  async createSession() {
    const r = await fetch('/api/session', { method: 'POST' });
    return r.json();
  },
  async getSession(id) {
    const r = await fetch(`/api/session/${id}`);
    return r.json();
  },
  async deleteSession(id) {
    await fetch(`/api/session/${id}`, { method: 'DELETE' });
  },
  async importCSV(id, games) {
    const r = await fetch(`/api/session/${id}/import/csv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ games })
    });
    return r.json();
  },
  async importBGG(id, username, password) {
    const r = await fetch(`/api/session/${id}/import/bgg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return r.json();
  },
  async startAudit(id, locations) {
    const r = await fetch(`/api/session/${id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations })
    });
    return r.json();
  },
  async toggleFound(id, gameId) {
    const r = await fetch(`/api/session/${id}/toggleFound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId })
    });
    return r.json();
  },
  async addGame(id, name, location) {
    const r = await fetch(`/api/session/${id}/addGame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, location })
    });
    return r.json();
  },
  async getReport(id) {
    const r = await fetch(`/api/session/${id}/report`);
    return r.json();
  }
};

// ── Screen Navigation ─────────────────────────────────────────────────────────
// Shows one screen, hides all others, and updates the browser URL.
function showScreen(screenId, urlPath) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  if (urlPath) window.history.pushState({}, '', urlPath);
}

function showSetup() {
  showScreen('screen-setup', '/');
}

function showAudit() {
  renderAudit();
  showScreen('screen-audit', `/s/${state.sessionId}`);
}

async function showReport() {
  const data = await api.getReport(state.sessionId);
  state.reportData = data;
  renderReport(data);
  showScreen('screen-report', `/s/${state.sessionId}/report`);
}

// ── Tab Switcher (Setup screen) ───────────────────────────────────────────────
function setTab(tab) {
  document.getElementById('panel-bgg').classList.toggle('hidden', tab !== 'bgg');
  document.getElementById('panel-csv').classList.toggle('hidden', tab !== 'csv');
  document.getElementById('tab-bgg').classList.toggle('btn-active', tab === 'bgg');
  document.getElementById('tab-csv').classList.toggle('btn-active', tab === 'csv');
}

// ── BGG Import ────────────────────────────────────────────────────────────────
async function importFromBGG() {
  const username = document.getElementById('bgg-username').value.trim();
  const password = document.getElementById('bgg-password').value.trim();

  if (!username || !password) {
    alert('Please enter your BGG username and password.');
    return;
  }

  const btn = document.getElementById('btn-bgg-import');
  btn.disabled = true;
  btn.textContent = 'Loading collection…';

  try {
    // Create a session if we don't have one yet
    if (!state.sessionId) {
      const sess = await api.createSession();
      state.sessionId = sess.id;
    }

    const result = await api.importBGG(state.sessionId, username, password);

    if (result.error) {
      alert(`BGG import failed: ${result.error}`);
      return;
    }

    state.locations = result.locations || [];
    renderLocationPicker();

  } catch (err) {
    alert('Something went wrong connecting to BGG. Please try again.');
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Load my collection';
  }
}

// ── CSV Import ────────────────────────────────────────────────────────────────
async function handleCSVUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const text = await file.text();
  const games = parseCSV(text);

  if (games.length === 0) {
    alert('No games found in CSV. Make sure it has objectid, objectname, and invlocation columns.');
    return;
  }

  if (!state.sessionId) {
    const sess = await api.createSession();
    state.sessionId = sess.id;
  }

  const result = await api.importCSV(state.sessionId, games);
  state.locations = result.locations || [];
  renderLocationPicker();
}

// Parses a BGG CSV export, handling multi-line quoted fields
function parseCSV(text) {
  const rows = splitCSVRows(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const col = (name) => headers.indexOf(name);

  const idCol       = col('objectid');
  const nameCol     = col('objectname');
  const locationCol = col('invlocation');

  if (idCol === -1 || nameCol === -1) {
    alert('CSV must have objectid and objectname columns.');
    return [];
  }

  return rows.slice(1)
    .filter(cols => cols.length > 1)
    .map(cols => ({
      objectid:    cols[idCol]?.trim() || '',
      objectname:  cols[nameCol]?.trim() || '',
      invlocation: locationCol !== -1 ? cols[locationCol]?.trim() || '' : ''
    }))
    .filter(g => g.objectid && g.objectname);
}

// Splits CSV text into rows of fields, correctly handling:
// - Quoted fields containing commas
// - Quoted fields containing newlines
// - Escaped quotes ("")
function splitCSVRows(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ("")
        if (text[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        // Everything inside quotes is part of the field, including newlines
        currentField += ch;
        i++;
        continue;
      }
    }

    // Not in quotes
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (ch === ',') {
      currentRow.push(currentField);
      currentField = '';
      i++;
      continue;
    }

    if (ch === '\n') {
      // End of row
      currentRow.push(currentField);
      currentField = '';
      // Skip \r if present (Windows line endings)
      if (currentRow.some(f => f.trim())) {
        rows.push(currentRow);
      }
      currentRow = [];
      i++;
      continue;
    }

    if (ch === '\r') {
      // Skip carriage returns
      i++;
      continue;
    }

    currentField += ch;
    i++;
  }

  // Handle last row if file doesn't end with newline
  if (currentField || currentRow.length) {
    currentRow.push(currentField);
    if (currentRow.some(f => f.trim())) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// ── Location Picker ───────────────────────────────────────────────────────────
function renderLocationPicker() {
  const panel = document.getElementById('panel-locations');
  const chipsEl = document.getElementById('location-chips');
  const startBtn = document.getElementById('btn-start');

  panel.classList.remove('hidden');
  state.selectedLocations = [];
  chipsEl.innerHTML = '';

  state.locations.forEach(loc => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = loc;
    chip.onclick = () => {
      const idx = state.selectedLocations.indexOf(loc);
      if (idx === -1) {
        state.selectedLocations.push(loc);
        chip.classList.add('selected');
      } else {
        state.selectedLocations.splice(idx, 1);
        chip.classList.remove('selected');
      }
      startBtn.disabled = state.selectedLocations.length === 0;
    };
    chipsEl.appendChild(chip);
  });
}

// ── Start Audit ───────────────────────────────────────────────────────────────
async function startAudit() {
  await api.startAudit(state.sessionId, state.selectedLocations);
  const sess = await api.getSession(state.sessionId);
  state.games = sess.games;
  showAudit();
}

// ── Audit Screen ──────────────────────────────────────────────────────────────
function renderAudit() {
  const inScope = (g) =>
    state.selectedLocations.length
      ? state.selectedLocations.includes(g.location)
      : true;

  const scoped = state.games.filter(inScope);
  const pending = scoped.filter(g => !g.found).sort((a, b) => a.name.localeCompare(b.name));
  const found   = scoped.filter(g => g.found).sort((a, b) => a.name.localeCompare(b.name));

  document.getElementById('count-pending').textContent = `${pending.length} remaining`;
  document.getElementById('count-found').textContent   = `${found.length} found`;

  renderGameList('list-pending', pending, false);
  renderGameList('list-found', found, true);

  // Session info sidebar
  document.getElementById('session-id').textContent        = state.sessionId;
  document.getElementById('session-locations').textContent = state.selectedLocations.join(', ') || 'All';

  // QR code for resuming on another device
  renderQR();

  // Default the new game location to the first selected location
  document.getElementById('new-game-location').value = state.selectedLocations[0] || '';
}

function renderGameList(listId, games, isFound) {
  const ul = document.getElementById(listId);
  ul.innerHTML = '';

  games.forEach(game => {
    const li = document.createElement('li');
    li.className = `game-item${isFound ? ' is-found' : ''}`;
    li.innerHTML = `
      <span class="game-name">${escapeHtml(game.name)}</span>
      <span class="game-location">${escapeHtml(game.location)}</span>
    `;
    li.onclick = () => toggleGame(game.id);
    ul.appendChild(li);
  });
}

async function toggleGame(gameId) {
  await api.toggleFound(state.sessionId, gameId);

  // Update local state so re-render is instant
  const game = state.games.find(g => g.id === gameId);
  if (game) game.found = !game.found;

  renderAudit();
}

async function addNewGame() {
  const nameEl     = document.getElementById('new-game-name');
  const locationEl = document.getElementById('new-game-location');
  const name       = nameEl.value.trim();
  const location   = locationEl.value.trim().toUpperCase();

  if (!name) {
    alert('Please enter a game name.');
    return;
  }

  const result = await api.addGame(state.sessionId, name, location);
  state.games.push(result.game);

  nameEl.value     = '';
  locationEl.value = '';

  renderAudit();
}

// ── QR Code ───────────────────────────────────────────────────────────────────
function renderQR() {
  const url         = `${window.location.origin}/s/${state.sessionId}`;
  const qrContainer = document.getElementById('qr-canvas');
  const urlEl       = document.getElementById('qr-url');

  urlEl.textContent  = url;
  qrContainer.innerHTML = '';

  new QRCode(qrContainer, {
    text: url,
    width: 160,
    height: 160,
    colorDark: '#000000',
    colorLight: '#ffffff'
  });
}

// ── Report Screen ─────────────────────────────────────────────────────────────
function renderReport(data) {
  document.getElementById('rpt-all').textContent     = data.counts.all;
  document.getElementById('rpt-found').textContent   = data.counts.found;
  document.getElementById('rpt-missing').textContent = data.counts.missing;
  document.getElementById('rpt-new').textContent     = data.counts.new;

  renderReportList('rpt-list-found',   data.found);
  renderReportList('rpt-list-missing', data.missing);
  renderReportList('rpt-list-new',     data.new);
}

function renderReportList(listId, games) {
  const ul = document.getElementById(listId);
  ul.innerHTML = '';
  games.forEach(g => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(g.name)}</span> <small>${escapeHtml(g.location)}</small>`;
    ul.appendChild(li);
  });
}

function copyCSV(section) {
  if (!state.reportData) return;
  const games  = state.reportData[section] || [];
  const header = 'id,name,location';
  const rows   = games.map(g =>
    [g.id, g.name, g.location]
      .map(v => `"${String(v || '').replaceAll('"', '""')}"`)
      .join(',')
  );
  const csv = [header, ...rows].join('\n');

  // Try the modern clipboard API first (requires https or localhost)
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(csv)
      .then(() => alert(`Copied ${rows.length} games to clipboard.`))
      .catch(() => showCSVFallback(csv));
  } else {
    // Fallback for http: select text from a temporary textarea
    showCSVFallback(csv);
  }
}

function showCSVFallback(csv) {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999;
  `;

  // Create modal
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: #141417; border: 1px solid #242429; border-radius: 12px;
    padding: 20px; width: 80%; max-width: 600px; display: flex;
    flex-direction: column; gap: 12px;
  `;

  const title = document.createElement('p');
  title.textContent = 'Select all and copy with Ctrl+C (or ⌘+C on Mac):';
  title.style.margin = '0';

  const ta = document.createElement('textarea');
  ta.value = csv;
  ta.style.cssText = `
    width: 100%; height: 200px; background: #0f0f12; color: #e8e8ea;
    border: 1px solid #2d6cdf; border-radius: 8px; padding: 10px;
    font-size: 0.85rem; font-family: monospace; resize: vertical;
  `;

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Done';
  closeBtn.style.alignSelf = 'flex-end';
  closeBtn.onclick = () => document.body.removeChild(overlay);

  modal.appendChild(title);
  modal.appendChild(ta);
  modal.appendChild(closeBtn);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Select all text after render
  requestAnimationFrame(() => {
    ta.focus();
    ta.select();
  });
}

// ── Delete Session ────────────────────────────────────────────────────────────
async function deleteSession() {
  if (!confirm('Delete this audit session? This cannot be undone.')) return;
  await api.deleteSession(state.sessionId);
  state.sessionId = null;
  state.games = [];
  showSetup();
}

// ── Utility ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// ── URL-based Routing ─────────────────────────────────────────────────────────
// When the page loads, check the URL to decide which screen to show.
// This is what makes sharing the URL (and scanning the QR code) work.
async function route() {
  try {
    const path = window.location.pathname;

    const auditMatch  = path.match(/^\/s\/([^/]+)$/);
    const reportMatch = path.match(/^\/s\/([^/]+)\/report$/);

    if (auditMatch || reportMatch) {
      const id = (auditMatch || reportMatch)[1];
      console.log('Routing to session:', id);
      const sess = await api.getSession(id);
      console.log('Session response:', JSON.stringify(sess));

      if (!sess || sess.error) {
        showSetup();
        return;
      }

      state.sessionId         = sess.id;
      state.games             = sess.games;
      state.selectedLocations = sess.filters?.locations || [];

      if (reportMatch) {
        await showReport();
      } else {
        showAudit();
      }
      return;
    }

    showSetup();
  } catch (err) {
    console.error('Routing error:', err);
    showSetup();
  }
}

// Kick everything off when the page loads
route();