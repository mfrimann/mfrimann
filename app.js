const STORAGE_KEY = 'podcast_tracker_v3';
const SPEED_OPTIONS = [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2];
const DEFAULT_CATEGORIES = [
  { name: 'Tech', icon: '💻', editable: false },
  { name: 'News', icon: '📰', editable: false },
  { name: 'Comedy', icon: '😂', editable: false },
  { name: 'Business', icon: '💼', editable: false },
  { name: 'Læring', icon: '📘', editable: false },
];

const state = {
  route: 'home',
  selectedPodcastId: null,
  selectedEpisodes: new Set(),
  mobileOpen: false,
  sort: { by: 'number', dir: 'asc' },
  db: loadDb(),
};

const els = {
  sidebar: document.getElementById('sidebar'),
  view: document.getElementById('view'),
  title: document.getElementById('pageTitle'),
  overlay: document.getElementById('overlay'),
  podcastModal: document.getElementById('podcastModal'),
  episodeModal: document.getElementById('episodeModal'),
  guideModal: document.getElementById('importGuideModal'),
  sheetModal: document.getElementById('sheetImportModal'),
  statusBadge: document.getElementById('statusBadge'),
  playbackSpeed: document.getElementById('playbackSpeed'),
};

function loadDb() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const fallback = {
    podcasts: [],
    episodes: [],
    categories: DEFAULT_CATEGORIES,
    darkMode: false,
    playbackSpeed: 1.2,
  };
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return {
      ...fallback,
      ...parsed,
      categories: Array.isArray(parsed.categories) ? parsed.categories : DEFAULT_CATEGORIES,
      playbackSpeed: SPEED_OPTIONS.includes(Number(parsed.playbackSpeed)) ? Number(parsed.playbackSpeed) : 1.2,
    };
  } catch {
    return fallback;
  }
}

function saveDb() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.db)); }
function uid() { return crypto.randomUUID(); }
function nowDate() { return new Date().toISOString().slice(0, 10); }
function podcastById(id) { return state.db.podcasts.find((p) => p.id === id); }
function episodesForPodcast(id) { return state.db.episodes.filter((e) => e.podcastId === id); }
function speedLabel(speed) { return `${String(speed).replace('.', ',')}x`; }
function listenedAtSpeed(minutes, speed = state.db.playbackSpeed) { return Math.round(minutes / speed); }
function savedAtSpeed(minutes, speed = state.db.playbackSpeed) { return Math.max(0, minutes - listenedAtSpeed(minutes, speed)); }

function parseDuration(value) {
  const cleaned = String(value || '').trim();
  const parts = cleaned.split(':').map(Number);
  if (parts.length === 3 && parts.every((p) => Number.isFinite(p))) return (parts[0] * 60) + parts[1] + Math.round(parts[2] / 60);
  if (parts.length === 2 && parts.every((p) => Number.isFinite(p))) return (parts[0] * 60) + parts[1];
  return Number(cleaned) || 0;
}

function formatMinutes(min) {
  const safe = Number(min) || 0;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}t ${m}m`;
}

function thumbMarkup(podcast, className = 'thumb') {
  const src = podcast.image ? podcast.image : '';
  return `<img class="${className}" src="${src}" alt="${podcast.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
  <div class="thumb-fallback" style="${src ? '' : 'display:flex;'}">🎙️</div>`;
}

function closeMobileMenu() {
  state.mobileOpen = false;
  els.sidebar.classList.remove('open');
  els.overlay.classList.add('hidden');
}

function setStatus(text = 'Klar') { els.statusBadge.textContent = text; }

function render() {
  document.body.classList.toggle('dark', !!state.db.darkMode);
  els.playbackSpeed.value = String(state.db.playbackSpeed);
  const titles = { home: 'Home', podcasts: 'Alle Podcasts', podcast: 'Podcast Detaljer', stats: 'Statistik', settings: 'Indstillinger' };
  els.title.textContent = titles[state.route] || 'Podcast Tracking Tool';
  if (state.route === 'home') return renderHome();
  if (state.route === 'podcasts') return renderPodcasts();
  if (state.route === 'podcast') return renderPodcastDetail();
  if (state.route === 'stats') return renderStats();
  if (state.route === 'settings') return renderSettings();
}

function renderHome() {
  const listened = state.db.episodes.filter((e) => e.listened);
  const totalListened = listened.reduce((a, e) => a + e.duration, 0);
  const listenedFast = listenedAtSpeed(totalListened);
  const saved = savedAtSpeed(totalListened);
  const podcastCount = new Map();
  listened.forEach((e) => podcastCount.set(e.podcastId, (podcastCount.get(e.podcastId) || 0) + 1));
  const mostListened = [...podcastCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const recentPodcasts = [...state.db.podcasts].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);

  els.view.innerHTML = `
    <section class="grid stats-grid">
      <article class="card kpi"><span class="small">Podcasts</span><strong>${state.db.podcasts.length}</strong></article>
      <article class="card kpi"><span class="small">Total lyttetid (1x)</span><strong>${formatMinutes(totalListened)}</strong></article>
      <article class="card kpi"><span class="small">Lyttetid (${speedLabel(state.db.playbackSpeed)})</span><strong>${formatMinutes(listenedFast)}</strong></article>
      <article class="card kpi"><span class="small">Tid sparet</span><strong>${formatMinutes(saved)}</strong></article>
    </section>

    <section class="grid" style="margin-top:1rem;grid-template-columns:2fr 2fr 3fr">
      <article class="card"><h3>Seneste Podcasts</h3><ul class="list">${recentPodcasts.map((p) => `<li><span class="card-thumb-row">${thumbMarkup(p, 'thumb')}<span>${p.title}</span></span><span class="small">${p.platform || '—'}</span></li>`).join('') || '<li>Ingen data</li>'}</ul></article>
      <article class="card"><h3>Mest lyttede Podcast</h3><p style="margin-top:.7rem">${mostListened ? (podcastById(mostListened[0])?.title || '—') : 'Ingen data'}</p></article>
      <article class="card">
        <h3>Seneste Episoder</h3>
        <div class="table-wrap" style="margin-top:.6rem"><table><thead><tr><th>Titel</th><th>Podcast</th><th>Dato</th></tr></thead>
          <tbody>${[...state.db.episodes].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5).map((e) => `<tr><td>${e.title}</td><td>${podcastById(e.podcastId)?.title || 'Ukendt'}</td><td>${e.date}</td></tr>`).join('') || '<tr><td colspan="3">Ingen episoder</td></tr>'}</tbody>
        </table></div>
      </article>
    </section>`;
}

function renderPodcasts() {
  els.view.innerHTML = `
    <section class="card"><div class="actions"><input id="searchInput" placeholder="Søg i titel eller beskrivelse" /><label><input id="favOnly" type="checkbox" /> Kun favoritter</label></div></section>
    <section id="podcastGrid" class="grid podcast-grid" style="margin-top:1rem"></section>`;

  const search = els.view.querySelector('#searchInput');
  const fav = els.view.querySelector('#favOnly');
  const grid = els.view.querySelector('#podcastGrid');

  const paint = () => {
    const q = search.value.toLowerCase();
    const list = state.db.podcasts.filter((p) => (!fav.checked || p.favorite) && `${p.title} ${p.description || ''}`.toLowerCase().includes(q));
    grid.innerHTML = list.map((p) => {
      const eps = episodesForPodcast(p.id);
      const rem = eps.filter((e) => !e.listened).reduce((a, e) => a + e.duration, 0);
      return `<article class="card">
        <div class="podcast-head">
          <div>${thumbMarkup(p)}</div>
          <div>
            <h3>${p.favorite ? '⭐ ' : ''}${p.title}</h3>
            <p class="small" style="margin-top:.4rem">${p.description || 'Ingen beskrivelse'}</p>
            <p class="small" style="margin-top:.5rem">${eps.filter((e) => e.listened).length}/${eps.length} lyttet • ${formatMinutes(rem)} tilbage</p>
          </div>
        </div>
        <div class="actions" style="margin-top:.7rem"><button data-open="${p.id}" class="primary">Åbn</button><button data-del="${p.id}" class="danger">Slet</button></div>
      </article>`;
    }).join('') || '<div class="card">Ingen podcasts fundet.</div>';
  };

  search.oninput = paint;
  fav.onchange = paint;
  paint();

  grid.onclick = (event) => {
    const open = event.target.dataset.open;
    const del = event.target.dataset.del;
    if (open) { state.route = 'podcast'; state.selectedPodcastId = open; state.selectedEpisodes.clear(); closeMobileMenu(); render(); }
    if (del && confirm('Slet podcast og alle tilknyttede episoder?')) {
      state.db.podcasts = state.db.podcasts.filter((p) => p.id !== del);
      state.db.episodes = state.db.episodes.filter((e) => e.podcastId !== del);
      saveDb();
      render();
    }
  };
}

function renderPodcastDetail() {
  const podcast = podcastById(state.selectedPodcastId);
  if (!podcast) { state.route = 'podcasts'; return render(); }
  const episodes = [...episodesForPodcast(podcast.id)].sort(sortEpisodes);
  const listened = episodes.filter((e) => e.listened);
  const listenedMinutes = listened.reduce((a, e) => a + e.duration, 0);

  els.view.innerHTML = `
    <section class="card">
      <div class="actions" style="justify-content:space-between">
        <div class="podcast-head" style="grid-template-columns:88px 1fr">
          <div>${thumbMarkup(podcast)}</div>
          <div>
            <h2>${podcast.title}</h2>
            <p class="small" style="margin-top:.45rem">${podcast.category || ''} • ${podcast.language || ''} • ${podcast.platform || ''}</p>
          </div>
        </div>
        <div class="actions"><button id="editPodcastBtn">Rediger Podcast</button><button id="sheetImportBtn">📄 Import fra Sheets</button></div>
      </div>
      <p class="small" style="margin-top:.65rem">${podcast.description || 'Ingen beskrivelse.'}</p>
      <details style="margin-top:.7rem"><summary>Vis/skjul statistik</summary>
        <div class="grid stats-grid" style="margin-top:.7rem">
          <article class="card kpi"><span class="small">Total episoder</span><strong>${listened.length}/${episodes.length}</strong></article>
          <article class="card kpi"><span class="small">Total lyttetid (1x)</span><strong>${formatMinutes(listenedMinutes)}</strong></article>
          <article class="card kpi"><span class="small">Lyttetid (${speedLabel(state.db.playbackSpeed)})</span><strong>${formatMinutes(listenedAtSpeed(listenedMinutes))}</strong></article>
          <article class="card kpi"><span class="small">Tid sparet</span><strong>${formatMinutes(savedAtSpeed(listenedMinutes))}</strong></article>
        </div>
      </details>
    </section>

    <section class="card" style="margin-top:1rem">
      <div class="actions" style="justify-content:space-between"><div class="actions"><button id="bulkListened" class="success">Markér som lyttet</button><button id="bulkUnlistened">Markér som ulyttet</button><button id="bulkDelete" class="danger">Slet valgte</button></div><span class="badge">${state.selectedEpisodes.size} valgt</span></div>
      <div class="table-wrap" style="margin-top:.8rem"><table><thead><tr>
        <th><input id="selectAll" type="checkbox" /></th>
        <th><button data-sort="number">Episode #</button></th>
        <th><button data-sort="title">Titel</button></th>
        <th><button data-sort="date">Dato</button></th>
        <th><button data-sort="duration">Varighed</button></th>
        <th class="hide-mobile">${speedLabel(state.db.playbackSpeed)}</th>
        <th class="hide-mobile">Sparet</th>
        <th>Status</th>
        <th class="hide-mobile">Lyttet dato</th>
        <th>Handling</th>
      </tr></thead><tbody>
        ${episodes.map((e) => `<tr class="${state.selectedEpisodes.has(e.id) ? 'selected' : ''}">
          <td><input type="checkbox" data-sel="${e.id}" ${state.selectedEpisodes.has(e.id) ? 'checked' : ''}/></td>
          <td>${e.number ?? '-'}</td><td>${e.title}</td><td>${e.date}</td><td>${formatMinutes(e.duration)}</td>
          <td class="hide-mobile">${formatMinutes(listenedAtSpeed(e.duration))}</td><td class="hide-mobile">${formatMinutes(savedAtSpeed(e.duration))}</td>
          <td>${e.listened ? '✅ Lyttet' : '🔴 Ulyttet'}</td><td class="hide-mobile">${e.listenedDate || '-'}</td>
          <td><button data-toggle="${e.id}" class="ghost">Toggle</button> <button data-edit="${e.id}" class="ghost">Rediger</button> <button data-del="${e.id}" class="danger">Slet</button></td>
        </tr>`).join('') || '<tr><td colspan="10">Ingen episoder endnu.</td></tr>'}
      </tbody></table></div>
    </section>`;

  els.view.querySelector('#editPodcastBtn').onclick = () => openPodcastModal(podcast);
  els.view.querySelector('#sheetImportBtn').onclick = () => openSheetsImport(podcast.id);
  const selectAll = els.view.querySelector('#selectAll');
  selectAll.checked = episodes.length > 0 && episodes.every((e) => state.selectedEpisodes.has(e.id));
  selectAll.onchange = (e) => { if (e.target.checked) episodes.forEach((ep) => state.selectedEpisodes.add(ep.id)); else state.selectedEpisodes.clear(); render(); };
  els.view.querySelectorAll('[data-sel]').forEach((box) => box.onchange = (e) => { const id = e.target.dataset.sel; e.target.checked ? state.selectedEpisodes.add(id) : state.selectedEpisodes.delete(id); render(); });
  els.view.querySelectorAll('[data-sort]').forEach((btn) => btn.onclick = () => { const by = btn.dataset.sort; if (state.sort.by === by) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc'; else { state.sort.by = by; state.sort.dir = 'asc'; } render(); });
  els.view.querySelector('#bulkListened').onclick = () => bulkToggleListened(true);
  els.view.querySelector('#bulkUnlistened').onclick = () => bulkToggleListened(false);
  els.view.querySelector('#bulkDelete').onclick = bulkDeleteEpisodes;
  els.view.querySelector('tbody').onclick = (event) => {
    const toggle = event.target.dataset.toggle;
    const edit = event.target.dataset.edit;
    const del = event.target.dataset.del;
    if (toggle) {
      state.db.episodes = state.db.episodes.map((ep) => ep.id === toggle ? { ...ep, listened: !ep.listened, listenedDate: !ep.listened ? nowDate() : '' } : ep);
      saveDb();
      render();
    }
    if (edit) openEpisodeModal(state.db.episodes.find((ep) => ep.id === edit));
    if (del && confirm('Slet episode?')) { state.db.episodes = state.db.episodes.filter((ep) => ep.id !== del); state.selectedEpisodes.delete(del); saveDb(); render(); }
  };
}

function sortEpisodes(a, b) {
  const key = state.sort.by;
  let x = a[key]; let y = b[key];
  if (key === 'date') { x = new Date(a.date).getTime(); y = new Date(b.date).getTime(); }
  if (key === 'title') { x = (a.title || '').toLowerCase(); y = (b.title || '').toLowerCase(); }
  if (x == null) x = -Infinity;
  if (y == null) y = -Infinity;
  const result = x > y ? 1 : x < y ? -1 : 0;
  return state.sort.dir === 'asc' ? result : -result;
}

function bulkToggleListened(listenValue) {
  const ids = [...state.selectedEpisodes];
  if (!ids.length) return;
  state.db.episodes = state.db.episodes.map((ep) => (!ids.includes(ep.id) || ep.listened === listenValue) ? ep : { ...ep, listened: listenValue, listenedDate: listenValue ? nowDate() : '' });
  state.selectedEpisodes.clear();
  saveDb();
  render();
}

function bulkDeleteEpisodes() {
  const ids = [...state.selectedEpisodes];
  if (!ids.length) return;
  if (!confirm(`Slet ${ids.length} valgte episoder?`)) return;
  state.db.episodes = state.db.episodes.filter((e) => !ids.includes(e.id));
  state.selectedEpisodes.clear();
  saveDb();
  render();
}

function renderStats() {
  const episodes = state.db.episodes;
  const listened = episodes.filter((e) => e.listened);
  const remaining = episodes.filter((e) => !e.listened);
  const listenedTotal = listened.reduce((a, e) => a + e.duration, 0);
  const remainingTotal = remaining.reduce((a, e) => a + e.duration, 0);
  const byPlatform = ['Pocket Casts', 'YouTube', 'Podimo'].map((p) => [p, state.db.podcasts.filter((x) => x.platform === p).length]);

  els.view.innerHTML = `
    <section class="grid stats-grid">
      <article class="card kpi"><span class="small">Resterende episoder</span><strong>${remaining.length}</strong></article>
      <article class="card kpi"><span class="small">Resterende tid</span><strong>${formatMinutes(remainingTotal)}</strong></article>
      <article class="card kpi"><span class="small">Lyttetid (${speedLabel(state.db.playbackSpeed)})</span><strong>${formatMinutes(listenedAtSpeed(listenedTotal))}</strong></article>
      <article class="card kpi"><span class="small">Tid sparet</span><strong>${formatMinutes(savedAtSpeed(listenedTotal))}</strong></article>
    </section>
    <section class="grid" style="grid-template-columns:2fr 2fr 2fr; margin-top:1rem">
      <article class="card"><h3>Total lyttetid (1x)</h3><p style="margin-top:.6rem">${formatMinutes(listenedTotal)}</p></article>
      <article class="card"><h3>Resterende tid (${speedLabel(state.db.playbackSpeed)})</h3><p style="margin-top:.6rem">${formatMinutes(listenedAtSpeed(remainingTotal))}</p></article>
      <article class="card"><h3>Platform statistik</h3><ul class="list">${byPlatform.map(([name,count]) => `<li><span>${name}</span><span>${count}</span></li>`).join('')}</ul></article>
    </section>`;
}

function renderSettings() {
  const sizeKB = (new Blob([JSON.stringify(state.db)]).size / 1024).toFixed(2);
  const customCategories = state.db.categories.filter((c) => c.editable !== false);
  els.view.innerHTML = `
    <section class="card">
      <h3>Import/Export <button id="guideBtn" class="icon-btn">❓</button></h3>
      <div class="actions" style="margin-top:.7rem"><button id="exportBtn">Eksport data (JSON)</button><input type="file" id="importInput" accept="application/json" /></div>
      <p class="small" style="margin-top:.65rem">Lagerplads i brug: ${sizeKB} KB</p>
      <button id="clearBtn" class="danger" style="margin-top:.6rem">Slet alle data</button>
    </section>
    <section class="card" style="margin-top:1rem">
      <h3>Kategori administration</h3>
      <div class="actions" style="margin-top:.6rem"><input id="newCatName" placeholder="Kategori navn" /><input id="newCatIcon" placeholder="Ikon (fx 🎙️)" maxlength="2" /><button id="addCatBtn" class="primary">Tilføj kategori</button></div>
      <ul class="list">${state.db.categories.map((c) => `<li><span>${c.icon || '🏷️'} ${c.name}</span>${c.editable === false ? '<span class="small">Standard</span>' : `<button data-delcat="${c.name}" class="danger">Slet</button>`}</li>`).join('')}</ul>
      ${customCategories.length ? '' : '<p class="small" style="margin-top:.5rem">Ingen custom kategorier endnu.</p>'}
    </section>`;

  els.view.querySelector('#guideBtn').onclick = openImportGuide;
  els.view.querySelector('#exportBtn').onclick = exportData;
  els.view.querySelector('#importInput').onchange = importData;
  els.view.querySelector('#clearBtn').onclick = clearAllData;
  els.view.querySelector('#addCatBtn').onclick = addCategory;
  els.view.querySelectorAll('[data-delcat]').forEach((btn) => btn.onclick = () => { state.db.categories = state.db.categories.filter((c) => c.name !== btn.dataset.delcat); saveDb(); render(); });
}

function exportData() {
  const blob = new Blob([JSON.stringify(state.db, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `podcast-backup-${nowDate()}.json`;
  a.click();
}

async function importData(event) {
  try {
    setStatus('Importerer…');
    const file = event.target.files[0];
    if (!file) return;
    const payload = JSON.parse(await file.text());
    if (!Array.isArray(payload.podcasts) || !Array.isArray(payload.episodes)) throw new Error('Ugyldig backup-fil');
    state.db = { ...loadDb(), ...payload };
    if (!SPEED_OPTIONS.includes(Number(state.db.playbackSpeed))) state.db.playbackSpeed = 1.2;
    saveDb();
    setStatus('Import færdig');
    render();
  } catch (error) {
    alert(error.message || 'Import fejlede');
    setStatus('Import fejlede');
  }
}

function clearAllData() {
  if (!confirm('Er du sikker? Dette kan ikke fortrydes.')) return;
  localStorage.removeItem(STORAGE_KEY);
  state.db = loadDb();
  state.selectedPodcastId = null;
  state.selectedEpisodes.clear();
  state.route = 'home';
  saveDb();
  render();
}

function addCategory() {
  const name = els.view.querySelector('#newCatName').value.trim();
  const icon = els.view.querySelector('#newCatIcon').value.trim() || '🏷️';
  if (!name) return;
  if (state.db.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) return alert('Kategori findes allerede.');
  state.db.categories.push({ name, icon, editable: true });
  saveDb();
  render();
}

function openPodcastModal(existing = null) {
  const isEdit = !!existing;
  els.podcastModal.innerHTML = `<form method="dialog"><h3>${isEdit ? 'Rediger Podcast' : 'Tilføj Podcast'}</h3>
    <div class="form-grid" style="margin-top:.7rem">
      <input class="full" name="title" placeholder="Titel" value="${existing?.title || ''}" required />
      <select name="category">${state.db.categories.map((c) => `<option ${existing?.category === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
      <input name="language" placeholder="Sprog" value="${existing?.language || ''}" />
      <input class="full" name="feedUrl" placeholder="Feed URL" value="${existing?.feedUrl || ''}" />
      <select name="platform">${['Pocket Casts', 'YouTube', 'Podimo'].map((p) => `<option ${existing?.platform === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
      <input name="image" placeholder="Billede URL" value="${existing?.image || ''}" />
      <textarea class="full" name="description" placeholder="Beskrivelse">${existing?.description || ''}</textarea>
      <label class="full"><input type="checkbox" name="favorite" ${existing?.favorite ? 'checked' : ''} /> Favorit</label>
    </div>
    <div class="actions" style="margin-top:.8rem"><button class="primary">Gem</button><button value="cancel">Annuller</button></div>
  </form>`;
  const form = els.podcastModal.querySelector('form');
  els.podcastModal.showModal();
  form.onsubmit = (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    data.favorite = form.favorite.checked;
    if (isEdit) state.db.podcasts = state.db.podcasts.map((p) => p.id === existing.id ? { ...p, ...data } : p);
    else state.db.podcasts.push({ id: uid(), ...data, createdAt: Date.now() });
    saveDb();
    els.podcastModal.close();
    render();
  };
}

function openEpisodeModal(existing = null) {
  const isEdit = !!existing;
  if (!state.db.podcasts.length) return alert('Opret en podcast først.');
  els.episodeModal.innerHTML = `<form method="dialog"><h3>${isEdit ? 'Rediger Episode' : 'Tilføj Episode'}</h3>
    <div class="form-grid" style="margin-top:.7rem">
      <select name="podcastId" ${isEdit ? 'disabled' : ''}>${state.db.podcasts.map((p) => `<option value="${p.id}" ${(existing?.podcastId === p.id || state.selectedPodcastId === p.id) ? 'selected' : ''}>${p.title}</option>`).join('')}</select>
      <input name="number" type="number" placeholder="Episode nr" value="${existing?.number ?? ''}" />
      <input class="full" name="title" placeholder="Titel" value="${existing?.title || ''}" required />
      <input name="date" type="date" value="${existing?.date || nowDate()}" />
      <input name="duration" placeholder="Varighed (tt:mm:ss)" value="${existing ? `${Math.floor(existing.duration / 60)}:${String(existing.duration % 60).padStart(2, '0')}:00` : '00:45:00'}" />
      <label><input type="checkbox" name="listened" ${existing?.listened ? 'checked' : ''} /> Lyttet</label>
    </div>
    <div class="actions" style="margin-top:.8rem"><button class="primary">Gem</button><button value="cancel">Annuller</button></div>
  </form>`;
  const form = els.episodeModal.querySelector('form');
  els.episodeModal.showModal();
  form.onsubmit = (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    data.listened = form.listened.checked;
    data.duration = parseDuration(data.duration);
    data.number = data.number ? Number(data.number) : null;
    if (isEdit) state.db.episodes = state.db.episodes.map((e) => e.id === existing.id ? { ...e, ...data, listenedDate: data.listened ? (existing.listenedDate || nowDate()) : '' } : e);
    else state.db.episodes.push({ id: uid(), podcastId: data.podcastId || state.selectedPodcastId, title: data.title, date: data.date, duration: data.duration, number: data.number, listened: data.listened, listenedDate: data.listened ? nowDate() : '', createdAt: Date.now() });
    saveDb();
    els.episodeModal.close();
    render();
  };
}

function openImportGuide() {
  els.guideModal.innerHTML = `<article class="card"><h3>Google Sheets Import Guide</h3>
    <ol style="margin-top:.8rem"><li>Kopiér rækker direkte fra Google Sheets.</li><li>Format: Episode nr | Titel | Dato | Varighed.</li><li>Både tab-separeret data og "|"-separeret data understøttes.</li><li>Datoformat understøtter både dd-mm-yyyy og yyyy-mm-dd.</li></ol>
    <pre style="margin-top:.8rem">12\tAI Intro\t14-02-2026\t00:42:30
13\tNæste emne\t2026-02-16\t01:10:00</pre>
    <p class="small" style="margin-top:.6rem">Brug knappen “📄 Import fra Sheets” på podcast-siden for at indsætte data.</p>
    <div class="actions" style="margin-top:.8rem"><button onclick="document.getElementById('importGuideModal').close()">Luk guide</button></div></article>`;
  els.guideModal.showModal();
}

function parseSheetLines(input, podcastId) {
  const rows = input.split('\n').map((r) => r.trim()).filter(Boolean);
  const created = [];
  rows.forEach((row) => {
    const columns = row.includes('\t') ? row.split('\t') : row.split('|');
    const [nrRaw, titleRaw, dateRaw, durRaw] = columns.map((x) => (x || '').trim());
    if (!titleRaw || !dateRaw || !durRaw) return;
    let finalDate = dateRaw;
    if (dateRaw.includes('-')) {
      const parts = dateRaw.split('-');
      if (parts[0].length === 4) finalDate = `${parts[0]}-${parts[1]}-${parts[2]}`;
      else if (parts[2]?.length === 4) finalDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    created.push({ id: uid(), podcastId, number: Number(nrRaw) || null, title: titleRaw, date: finalDate, duration: parseDuration(durRaw), listened: false, listenedDate: '', createdAt: Date.now() });
  });
  return created;
}

function openSheetsImport(podcastId) {
  els.sheetModal.innerHTML = `<form method="dialog"><h3>Import fra Google Sheets</h3>
    <p class="small" style="margin-top:.5rem">Indsæt kopierede rækker fra Google Sheets (tab-separeret eller | sepreret).</p>
    <textarea name="payload" class="full" style="width:100%;margin-top:.7rem;min-height:220px" placeholder="1\tEpisode titel\t14-02-2026\t00:35:00"></textarea>
    <div class="actions" style="margin-top:.8rem"><button class="primary">Importér</button><button value="cancel">Annuller</button></div>
  </form>`;
  const form = els.sheetModal.querySelector('form');
  els.sheetModal.showModal();
  form.onsubmit = (event) => {
    event.preventDefault();
    const payload = form.payload.value;
    const episodes = parseSheetLines(payload, podcastId);
    if (!episodes.length) return alert('Ingen gyldige rækker fundet.');
    state.db.episodes.push(...episodes);
    saveDb();
    setStatus(`${episodes.length} episoder importeret`);
    els.sheetModal.close();
    render();
  };
}

function wireEvents() {
  document.querySelectorAll('[data-route]').forEach((btn) => btn.onclick = () => { state.route = btn.dataset.route; if (state.route !== 'podcast') state.selectedPodcastId = null; closeMobileMenu(); render(); });
  document.getElementById('addPodcastBtn').onclick = () => openPodcastModal();
  document.getElementById('addEpisodeBtn').onclick = () => openEpisodeModal();
  document.getElementById('themeToggle').onclick = () => { state.db.darkMode = !state.db.darkMode; saveDb(); render(); };
  els.playbackSpeed.onchange = () => { state.db.playbackSpeed = Number(els.playbackSpeed.value); saveDb(); render(); };
  document.getElementById('mobileMenuBtn').onclick = () => { state.mobileOpen = !state.mobileOpen; els.sidebar.classList.toggle('open', state.mobileOpen); els.overlay.classList.toggle('hidden', !state.mobileOpen); };
  els.overlay.onclick = closeMobileMenu;
}

wireEvents();
render();
