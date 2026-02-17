const STORAGE_KEY = 'podcast_tracker_v2';
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
  loading: false,
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
  statusBadge: document.getElementById('statusBadge'),
};

function loadDb() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  return {
    podcasts: [],
    episodes: [],
    categories: DEFAULT_CATEGORIES,
    darkMode: false,
  };
}
function saveDb() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.db)); }
function uid() { return crypto.randomUUID(); }
function nowDate() { return new Date().toISOString().slice(0, 10); }
function parseDuration(v) {
  const parts = String(v).split(':').map(Number);
  if (parts.length === 3) return (parts[0] * 60) + parts[1] + Math.round(parts[2] / 60);
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  return Number(v) || 0;
}
function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}t ${m}m`;
}
function podcastById(id) { return state.db.podcasts.find((p) => p.id === id); }
function episodesForPodcast(id) { return state.db.episodes.filter((e) => e.podcastId === id); }
function setLoading(flag, text = 'Klar') {
  state.loading = flag;
  els.statusBadge.textContent = flag ? 'Arbejder…' : text;
}

function closeMobileMenu() {
  state.mobileOpen = false;
  els.sidebar.classList.remove('open');
  els.overlay.classList.add('hidden');
}

function render() {
  document.body.classList.toggle('dark', !!state.db.darkMode);
  const titles = {
    home: 'Home',
    podcasts: 'Alle Podcasts',
    podcast: 'Podcast Detaljer',
    stats: 'Statistik',
    settings: 'Indstillinger',
  };
  els.title.textContent = titles[state.route] || 'Podcast Tracking Tool';

  if (state.route === 'home') return renderHome();
  if (state.route === 'podcasts') return renderPodcasts();
  if (state.route === 'podcast') return renderPodcastDetail();
  if (state.route === 'stats') return renderStats();
  if (state.route === 'settings') return renderSettings();
}

function renderHome() {
  const listened = state.db.episodes.filter((e) => e.listened);
  const totalListened = listened.reduce((acc, e) => acc + e.duration, 0);
  const savedAt12 = listened.reduce((acc, e) => acc + Math.round(e.duration / 6), 0);

  const podcastCount = new Map();
  listened.forEach((e) => podcastCount.set(e.podcastId, (podcastCount.get(e.podcastId) || 0) + 1));
  const mostListened = [...podcastCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const mostListenedName = mostListened ? podcastById(mostListened[0])?.title || '—' : '—';

  const recentPodcasts = [...state.db.podcasts].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
  const topPodcasts = [...state.db.podcasts]
    .map((p) => ({ ...p, listened: episodesForPodcast(p.id).filter((e) => e.listened).length }))
    .sort((a, b) => b.listened - a.listened)
    .slice(0, 4);
  const recentEpisodes = [...state.db.episodes]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 5);

  els.view.innerHTML = `
    <section class="grid stats-grid">
      <article class="card kpi"><span class="small">Podcasts</span><strong>${state.db.podcasts.length}</strong></article>
      <article class="card kpi"><span class="small">Total lyttetid</span><strong>${formatMinutes(totalListened)}</strong></article>
      <article class="card kpi"><span class="small">Tid sparet ved 1.2x</span><strong>${formatMinutes(savedAt12)}</strong></article>
      <article class="card kpi"><span class="small">Mest lyttet</span><strong>${mostListenedName}</strong></article>
    </section>

    <section class="grid" style="margin-top:1rem;grid-template-columns:2fr 2fr 3fr">
      <article class="card"><h3>Seneste Podcasts</h3><ul class="list">${recentPodcasts.map((p) => `<li><span>${p.title}</span><span class="small">${p.platform || '—'}</span></li>`).join('') || '<li>Ingen data</li>'}</ul></article>
      <article class="card"><h3>Mest lyttede Podcasts</h3><ul class="list">${topPodcasts.map((p) => `<li><span>${p.title}</span><span class="small">${p.listened} lyttet</span></li>`).join('') || '<li>Ingen data</li>'}</ul></article>
      <article class="card">
        <h3>Seneste Episoder</h3>
        <div class="table-wrap" style="margin-top:.6rem"><table><thead><tr><th>Titel</th><th>Podcast</th><th>Dato</th></tr></thead>
          <tbody>${recentEpisodes.map((e) => `<tr><td>${e.title}</td><td>${podcastById(e.podcastId)?.title || 'Ukendt'}</td><td>${e.date}</td></tr>`).join('') || '<tr><td colspan="3">Ingen episoder</td></tr>'}</tbody>
        </table></div>
      </article>
    </section>`;
}

function renderPodcasts() {
  els.view.innerHTML = `
    <section class="card">
      <div class="actions">
        <input id="searchInput" placeholder="Søg i titel eller beskrivelse" />
        <label><input id="favOnly" type="checkbox" /> Kun favoritter</label>
      </div>
    </section>
    <section id="podcastGrid" class="grid podcast-grid" style="margin-top:1rem"></section>`;

  const search = els.view.querySelector('#searchInput');
  const fav = els.view.querySelector('#favOnly');
  const grid = els.view.querySelector('#podcastGrid');

  const paint = () => {
    const q = search.value.toLowerCase();
    const list = state.db.podcasts.filter((p) => {
      if (fav.checked && !p.favorite) return false;
      return `${p.title} ${p.description || ''}`.toLowerCase().includes(q);
    });

    grid.innerHTML = list.map((p) => {
      const eps = episodesForPodcast(p.id);
      const listened = eps.filter((e) => e.listened).length;
      const remainingMin = eps.filter((e) => !e.listened).reduce((a, e) => a + e.duration, 0);
      return `<article class="card">
        <h3>${p.favorite ? '⭐ ' : ''}${p.title}</h3>
        <p class="small" style="margin-top:.4rem">${p.description || 'Ingen beskrivelse'}</p>
        <p class="small" style="margin-top:.5rem">${listened}/${eps.length} lyttet • ${formatMinutes(remainingMin)} tilbage</p>
        <div class="actions" style="margin-top:.7rem">
          <button data-open="${p.id}" class="primary">Åbn</button>
          <button data-del="${p.id}" class="danger">Slet</button>
        </div>
      </article>`;
    }).join('') || '<div class="card">Ingen podcasts fundet.</div>';
  };

  search.oninput = paint;
  fav.onchange = paint;
  paint();

  grid.onclick = (event) => {
    const open = event.target.dataset.open;
    const del = event.target.dataset.del;
    if (open) {
      state.route = 'podcast';
      state.selectedPodcastId = open;
      state.selectedEpisodes.clear();
      closeMobileMenu();
      render();
    }
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
  if (!podcast) {
    state.route = 'podcasts';
    return render();
  }

  const episodes = [...episodesForPodcast(podcast.id)].sort(sortEpisodes);
  const listened = episodes.filter((e) => e.listened);
  const statsHtml = `
    <details>
      <summary>Vis/skjul statistik</summary>
      <div class="grid stats-grid" style="margin-top:.7rem">
        <article class="card kpi"><span class="small">Total episoder</span><strong>${listened.length}/${episodes.length}</strong></article>
        <article class="card kpi"><span class="small">Total lyttetid</span><strong>${formatMinutes(listened.reduce((a,e)=>a+e.duration,0))}</strong></article>
        <article class="card kpi"><span class="small">1.2x lyttetid</span><strong>${formatMinutes(Math.round(listened.reduce((a,e)=>a+e.duration,0)/1.2))}</strong></article>
        <article class="card kpi"><span class="small">Tid sparet</span><strong>${formatMinutes(listened.reduce((a,e)=>a+Math.round(e.duration/6),0))}</strong></article>
      </div>
    </details>`;

  els.view.innerHTML = `
    <section class="card">
      <div class="actions" style="justify-content:space-between">
        <div>
          <h2>${podcast.title}</h2>
          <p class="small" style="margin-top:.45rem">${podcast.category || ''} • ${podcast.language || ''} • ${podcast.platform || ''}</p>
        </div>
        <div class="actions">
          <button id="editPodcastBtn">Rediger Podcast</button>
          <button id="sheetImportBtn">📄 Import fra Sheets</button>
        </div>
      </div>
      <p class="small" style="margin-top:.65rem">${podcast.description || 'Ingen beskrivelse.'}</p>
      ${statsHtml}
    </section>

    <section class="card" style="margin-top:1rem">
      <div class="actions" style="justify-content:space-between">
        <div class="actions">
          <button id="bulkListened" class="success">Markér som lyttet</button>
          <button id="bulkUnlistened">Markér som ulyttet</button>
          <button id="bulkDelete" class="danger">Slet valgte</button>
        </div>
        <span class="badge">${state.selectedEpisodes.size} valgt</span>
      </div>

      <div class="table-wrap" style="margin-top:.8rem">
        <table>
          <thead>
            <tr>
              <th><input id="selectAll" type="checkbox" /></th>
              <th><button data-sort="number">Episode #</button></th>
              <th><button data-sort="title">Titel</button></th>
              <th><button data-sort="date">Dato</button></th>
              <th><button data-sort="duration">Varighed</button></th>
              <th class="hide-mobile">1.2x</th>
              <th class="hide-mobile">Sparet</th>
              <th>Status</th>
              <th class="hide-mobile">Lyttet dato</th>
              <th>Handling</th>
            </tr>
          </thead>
          <tbody>
            ${episodes.map((e) => `
              <tr class="${state.selectedEpisodes.has(e.id) ? 'selected' : ''}">
                <td><input type="checkbox" data-sel="${e.id}" ${state.selectedEpisodes.has(e.id) ? 'checked' : ''} /></td>
                <td>${e.number ?? '-'}</td>
                <td>${e.title}</td>
                <td>${e.date}</td>
                <td>${formatMinutes(e.duration)}</td>
                <td class="hide-mobile">${formatMinutes(Math.round(e.duration / 1.2))}</td>
                <td class="hide-mobile">${formatMinutes(Math.round(e.duration / 6))}</td>
                <td>${e.listened ? '✅ Lyttet' : '🔴 Ulyttet'}</td>
                <td class="hide-mobile">${e.listenedDate || '-'}</td>
                <td>
                  <button data-toggle="${e.id}" class="ghost">Toggle</button>
                  <button data-edit="${e.id}" class="ghost">Rediger</button>
                  <button data-del="${e.id}" class="danger">Slet</button>
                </td>
              </tr>`).join('') || '<tr><td colspan="10">Ingen episoder endnu.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>`;

  els.view.querySelector('#editPodcastBtn').onclick = () => openPodcastModal(podcast);
  els.view.querySelector('#sheetImportBtn').onclick = () => openSheetsImport(podcast.id);

  const selectAll = els.view.querySelector('#selectAll');
  selectAll.checked = episodes.length > 0 && episodes.every((e) => state.selectedEpisodes.has(e.id));
  selectAll.onchange = (event) => {
    if (event.target.checked) episodes.forEach((e) => state.selectedEpisodes.add(e.id));
    else state.selectedEpisodes.clear();
    render();
  };

  els.view.querySelectorAll('[data-sel]').forEach((box) => {
    box.onchange = (event) => {
      const id = event.target.dataset.sel;
      event.target.checked ? state.selectedEpisodes.add(id) : state.selectedEpisodes.delete(id);
      render();
    };
  });

  els.view.querySelectorAll('[data-sort]').forEach((headerBtn) => {
    headerBtn.onclick = () => {
      const by = headerBtn.dataset.sort;
      if (state.sort.by === by) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      else { state.sort.by = by; state.sort.dir = 'asc'; }
      render();
    };
  });

  els.view.querySelector('#bulkListened').onclick = () => bulkToggleListened(true);
  els.view.querySelector('#bulkUnlistened').onclick = () => bulkToggleListened(false);
  els.view.querySelector('#bulkDelete').onclick = bulkDeleteEpisodes;

  els.view.querySelector('tbody').onclick = (event) => {
    const toggle = event.target.dataset.toggle;
    const edit = event.target.dataset.edit;
    const del = event.target.dataset.del;

    if (toggle) {
      state.db.episodes = state.db.episodes.map((e) => {
        if (e.id !== toggle) return e;
        const listened = !e.listened;
        return { ...e, listened, listenedDate: listened ? nowDate() : '' };
      });
      saveDb();
      return render();
    }
    if (edit) {
      const episode = state.db.episodes.find((e) => e.id === edit);
      return openEpisodeModal(episode);
    }
    if (del && confirm('Slet episode?')) {
      state.db.episodes = state.db.episodes.filter((e) => e.id !== del);
      state.selectedEpisodes.delete(del);
      saveDb();
      return render();
    }
  };
}

function sortEpisodes(a, b) {
  const key = state.sort.by;
  let x = a[key];
  let y = b[key];
  if (key === 'date') {
    x = new Date(a.date).getTime();
    y = new Date(b.date).getTime();
  }
  if (key === 'title') {
    x = (a.title || '').toLowerCase();
    y = (b.title || '').toLowerCase();
  }
  if (x == null) x = -Infinity;
  if (y == null) y = -Infinity;
  const result = x > y ? 1 : x < y ? -1 : 0;
  return state.sort.dir === 'asc' ? result : -result;
}

function bulkToggleListened(listenValue) {
  const ids = [...state.selectedEpisodes];
  if (!ids.length) return;
  state.db.episodes = state.db.episodes.map((e) => {
    if (!ids.includes(e.id) || e.listened === listenValue) return e;
    return { ...e, listened: listenValue, listenedDate: listenValue ? nowDate() : '' };
  });
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

  const byCategory = new Map();
  const byPlatform = new Map();
  listened.forEach((e) => {
    const p = podcastById(e.podcastId);
    if (!p) return;
    byCategory.set(p.category, (byCategory.get(p.category) || 0) + 1);
    byPlatform.set(p.platform, (byPlatform.get(p.platform) || 0) + 1);
  });

  const topCat = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  const topPlatformRows = ['Pocket Casts', 'YouTube', 'Podimo'].map((name) => `<li><span>${name}</span><span>${byPlatform.get(name) || 0}</span></li>`).join('');

  const podcastCounts = new Map();
  listened.forEach((e) => podcastCounts.set(e.podcastId, (podcastCounts.get(e.podcastId) || 0) + 1));
  const topPodcast = [...podcastCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  els.view.innerHTML = `
    <section class="grid stats-grid">
      <article class="card kpi"><span class="small">Resterende episoder</span><strong>${remaining.length}</strong></article>
      <article class="card kpi"><span class="small">Resterende tid</span><strong>${formatMinutes(remaining.reduce((a,e)=>a+e.duration,0))}</strong></article>
      <article class="card kpi"><span class="small">Total lyttetid</span><strong>${formatMinutes(listened.reduce((a,e)=>a+e.duration,0))}</strong></article>
      <article class="card kpi"><span class="small">Tid sparet 1.2x</span><strong>${formatMinutes(listened.reduce((a,e)=>a+Math.round(e.duration/6),0))}</strong></article>
    </section>
    <section class="grid" style="grid-template-columns:2fr 2fr 2fr; margin-top:1rem">
      <article class="card"><h3>Mest lyttede podcast</h3><p style="margin-top:.6rem">${topPodcast ? `${podcastById(topPodcast[0])?.title || '—'} (${topPodcast[1]} episoder)` : 'Ingen data'}</p></article>
      <article class="card"><h3>Mest populære kategori</h3><p style="margin-top:.6rem">${topCat ? `${topCat[0]} (${topCat[1]})` : 'Ingen data'}</p></article>
      <article class="card"><h3>Platform statistik</h3><ul class="list">${topPlatformRows}</ul></article>
    </section>`;
}

function renderSettings() {
  const customCategories = state.db.categories.filter((c) => c.editable !== false);
  const sizeKB = (new Blob([JSON.stringify(state.db)]).size / 1024).toFixed(2);

  els.view.innerHTML = `
    <section class="card">
      <h3>Import/Export <button id="guideBtn" class="icon-btn">❓</button></h3>
      <div class="actions" style="margin-top:.7rem">
        <button id="exportBtn">Eksport data (JSON)</button>
        <input type="file" id="importInput" accept="application/json" />
      </div>
      <p class="small" style="margin-top:.65rem">Lagerplads i brug: ${sizeKB} KB</p>
      <button id="clearBtn" class="danger" style="margin-top:.6rem">Slet alle data</button>
    </section>

    <section class="card" style="margin-top:1rem">
      <h3>Kategori administration</h3>
      <div class="actions" style="margin-top:.6rem">
        <input id="newCatName" placeholder="Kategori navn" />
        <input id="newCatIcon" placeholder="Ikon (fx 🎙️)" maxlength="2" />
        <button id="addCatBtn" class="primary">Tilføj kategori</button>
      </div>
      <ul class="list">${state.db.categories.map((c) => `<li><span>${c.icon || '🏷️'} ${c.name}</span>${c.editable === false ? '<span class="small">Standard</span>' : `<button data-delcat="${c.name}" class="danger">Slet</button>`}</li>`).join('')}</ul>
      ${customCategories.length ? '' : '<p class="small" style="margin-top:.5rem">Ingen custom kategorier endnu.</p>'}
    </section>`;

  els.view.querySelector('#guideBtn').onclick = openImportGuide;
  els.view.querySelector('#exportBtn').onclick = exportData;
  els.view.querySelector('#importInput').onchange = importData;
  els.view.querySelector('#clearBtn').onclick = clearAllData;
  els.view.querySelector('#addCatBtn').onclick = addCategory;

  els.view.querySelectorAll('[data-delcat]').forEach((btn) => {
    btn.onclick = () => {
      state.db.categories = state.db.categories.filter((c) => c.name !== btn.dataset.delcat);
      saveDb();
      render();
    };
  });
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
    setLoading(true);
    const file = event.target.files[0];
    if (!file) return;
    const payload = JSON.parse(await file.text());
    if (!payload.podcasts || !payload.episodes) throw new Error('Ugyldig backup-fil');
    state.db = payload;
    saveDb();
    render();
  } catch (error) {
    alert(error.message || 'Import fejlede');
  } finally {
    setLoading(false);
  }
}

function clearAllData() {
  if (!confirm('Er du sikker? Dette kan ikke fortrydes.')) return;
  localStorage.removeItem(STORAGE_KEY);
  state.db = loadDb();
  state.selectedPodcastId = null;
  state.selectedEpisodes.clear();
  state.route = 'home';
  render();
}

function addCategory() {
  const nameEl = els.view.querySelector('#newCatName');
  const iconEl = els.view.querySelector('#newCatIcon');
  const name = nameEl.value.trim();
  const icon = iconEl.value.trim() || '🏷️';
  if (!name) return;
  if (state.db.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    alert('Kategori findes allerede.');
    return;
  }
  state.db.categories.push({ name, icon, editable: true });
  saveDb();
  render();
}

function openPodcastModal(existing = null) {
  const isEdit = Boolean(existing);
  els.podcastModal.innerHTML = `
    <form method="dialog">
      <h3>${isEdit ? 'Rediger Podcast' : 'Tilføj Podcast'}</h3>
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
      <div class="actions" style="margin-top:.8rem">
        <button class="primary">Gem</button>
        <button value="cancel">Annuller</button>
      </div>
    </form>`;

  const form = els.podcastModal.querySelector('form');
  els.podcastModal.showModal();

  form.onsubmit = (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    data.favorite = form.favorite.checked;
    if (isEdit) {
      state.db.podcasts = state.db.podcasts.map((p) => (p.id === existing.id ? { ...p, ...data } : p));
    } else {
      state.db.podcasts.push({ id: uid(), ...data, createdAt: Date.now() });
    }
    saveDb();
    els.podcastModal.close();
    render();
  };
}

function openEpisodeModal(existing = null) {
  const isEdit = Boolean(existing);
  if (!state.db.podcasts.length) {
    alert('Opret en podcast først.');
    return;
  }

  els.episodeModal.innerHTML = `
    <form method="dialog">
      <h3>${isEdit ? 'Rediger Episode' : 'Tilføj Episode'}</h3>
      <div class="form-grid" style="margin-top:.7rem">
        <select name="podcastId" ${isEdit ? 'disabled' : ''}>${state.db.podcasts.map((p) => `<option value="${p.id}" ${(existing?.podcastId === p.id || state.selectedPodcastId === p.id) ? 'selected' : ''}>${p.title}</option>`).join('')}</select>
        <input name="number" type="number" placeholder="Episode nr" value="${existing?.number ?? ''}" />
        <input class="full" name="title" placeholder="Titel" value="${existing?.title || ''}" required />
        <input name="date" type="date" value="${existing?.date || nowDate()}" />
        <input name="duration" placeholder="Varighed (tt:mm:ss)" value="${existing ? `${Math.floor(existing.duration / 60)}:${String(existing.duration % 60).padStart(2, '0')}:00` : '00:45:00'}" />
        <label><input type="checkbox" name="listened" ${existing?.listened ? 'checked' : ''} /> Lyttet</label>
      </div>
      <div class="actions" style="margin-top:.8rem">
        <button class="primary">Gem</button>
        <button value="cancel">Annuller</button>
      </div>
    </form>`;

  const form = els.episodeModal.querySelector('form');
  els.episodeModal.showModal();

  form.onsubmit = (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    data.listened = form.listened.checked;
    data.duration = parseDuration(data.duration);
    data.number = data.number ? Number(data.number) : null;

    if (isEdit) {
      state.db.episodes = state.db.episodes.map((e) => (e.id === existing.id ? { ...e, ...data, listenedDate: data.listened ? existing.listenedDate || nowDate() : '' } : e));
    } else {
      state.db.episodes.push({
        id: uid(),
        podcastId: data.podcastId || state.selectedPodcastId,
        title: data.title,
        date: data.date,
        duration: data.duration,
        number: data.number,
        listened: data.listened,
        listenedDate: data.listened ? nowDate() : '',
        createdAt: Date.now(),
      });
    }
    saveDb();
    els.episodeModal.close();
    render();
  };
}

function openImportGuide() {
  els.guideModal.innerHTML = `
    <article class="card">
      <h3>Google Sheets Import Guide</h3>
      <ol style="margin-top:.8rem">
        <li>Åbn dit Google Sheet med episoder.</li>
        <li>Kopiér rækker i formatet: <strong>Episode nr | Titel | Dato | Varighed</strong>.</li>
        <li>Dato skal være <strong>dd-mm-yyyy</strong>, varighed <strong>tt:mm:ss</strong>.</li>
        <li>Gå til en podcast-side og klik på <strong>📄 Import fra Sheets</strong>.</li>
        <li>Indsæt alle linjer og godkend import.</li>
      </ol>
      <pre style="margin-top:.8rem">1 | Velkommen | 14-02-2026 | 00:32:10
2 | Interview med gæst | 18-02-2026 | 01:04:55</pre>
      <p class="small" style="margin-top:.6rem">Tip: Dublet-titler er tilladt, men sørg for at datoformatet er ens på alle rækker.</p>
      <div class="actions" style="margin-top:.8rem"><button onclick="document.getElementById('importGuideModal').close()">Luk guide</button></div>
    </article>`;
  els.guideModal.showModal();
}

function openSheetsImport(podcastId) {
  const input = prompt('Indsæt rækker i format: nr|titel|dato(dd-mm-yyyy)|varighed(tt:mm:ss)');
  if (!input) return;

  setLoading(true);
  let success = 0;
  const rows = input.split('\n').map((row) => row.trim()).filter(Boolean);

  rows.forEach((row) => {
    const [nr, title, dateRaw, durationRaw] = row.split('|').map((v) => v?.trim());
    if (!title || !dateRaw || !durationRaw) return;

    const [dd, mm, yyyy] = dateRaw.split('-');
    if (!dd || !mm || !yyyy) return;

    state.db.episodes.push({
      id: uid(),
      podcastId,
      number: Number(nr) || null,
      title,
      date: `${yyyy}-${mm}-${dd}`,
      duration: parseDuration(durationRaw),
      listened: false,
      listenedDate: '',
      createdAt: Date.now(),
    });
    success += 1;
  });

  saveDb();
  setLoading(false, `${success} episoder importeret`);
  render();
}

function wireEvents() {
  document.querySelectorAll('[data-route]').forEach((btn) => {
    btn.onclick = () => {
      state.route = btn.dataset.route;
      if (state.route !== 'podcast') state.selectedPodcastId = null;
      closeMobileMenu();
      render();
    };
  });

  document.getElementById('addPodcastBtn').onclick = () => openPodcastModal();
  document.getElementById('addEpisodeBtn').onclick = () => openEpisodeModal();
  document.getElementById('themeToggle').onclick = () => {
    state.db.darkMode = !state.db.darkMode;
    saveDb();
    render();
  };

  document.getElementById('mobileMenuBtn').onclick = () => {
    state.mobileOpen = !state.mobileOpen;
    els.sidebar.classList.toggle('open', state.mobileOpen);
    els.overlay.classList.toggle('hidden', !state.mobileOpen);
  };
  els.overlay.onclick = closeMobileMenu;
}

wireEvents();
render();
