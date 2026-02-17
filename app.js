const STORAGE_KEY = 'podcast_tracker_v1';
const DEFAULT_CATEGORIES = ['Tech', 'News', 'Comedy', 'Business', 'Læring'];

const state = {
  route: 'home',
  selectedPodcastId: null,
  selectedEpisodes: new Set(),
  mobileOpen: false,
  db: loadDb(),
};

function loadDb() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  return { podcasts: [], episodes: [], categories: [...DEFAULT_CATEGORIES], darkMode: false };
}
function saveDb() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.db)); }
function uid() { return crypto.randomUUID(); }

const els = {
  sidebar: document.getElementById('sidebar'),
  view: document.getElementById('view'),
  title: document.getElementById('pageTitle'),
  overlay: document.getElementById('overlay'),
  podcastModal: document.getElementById('podcastModal'),
  episodeModal: document.getElementById('episodeModal'),
  guideModal: document.getElementById('importGuideModal'),
};

function fmtMins(mins) {
  const h = Math.floor(mins / 60); const m = mins % 60;
  return `${h}t ${m}m`;
}
function parseDuration(v) {
  const parts = v.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 60 + parts[1] + Math.round(parts[2] / 60);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(v) || 0;
}
function dateNow() { return new Date().toISOString().slice(0,10); }

function render() {
  document.body.classList.toggle('dark', !!state.db.darkMode);
  els.title.textContent = state.route === 'podcast' ? 'Podcast detaljer' : ({home:'Home',podcasts:'Alle podcasts',stats:'Statistik',settings:'Indstillinger'})[state.route];
  const root = els.view;

  if (state.route === 'home') {
    const podcasts = state.db.podcasts;
    const listened = state.db.episodes.filter(e => e.listened);
    const saved = listened.reduce((a,e)=>a+Math.round(e.duration/6),0);
    root.innerHTML = `
      <div class="grid stats">
        <div class="card"><h3>Podcasts</h3><p>${podcasts.length}</p></div>
        <div class="card"><h3>Total lyttetid</h3><p>${fmtMins(listened.reduce((a,e)=>a+e.duration,0))}</p></div>
        <div class="card"><h3>Tid sparet (1.2x)</h3><p>${fmtMins(saved)}</p></div>
        <div class="card"><h3>Resterende episoder</h3><p>${state.db.episodes.filter(e=>!e.listened).length}</p></div>
      </div>`;
  }

  if (state.route === 'podcasts') {
    root.innerHTML = `
      <div class="actions" style="margin-bottom:.8rem">
        <input id="searchInput" placeholder="Søg podcasts..." />
        <label><input id="favFilter" type="checkbox" /> Kun favoritter</label>
      </div>
      <div id="podcastGrid" class="grid podcasts"></div>`;
    const search = root.querySelector('#searchInput');
    const fav = root.querySelector('#favFilter');
    const grid = root.querySelector('#podcastGrid');
    const paint = () => {
      const q = search.value.toLowerCase();
      const list = state.db.podcasts.filter(p => (!fav.checked || p.favorite) && (`${p.title} ${p.description}`.toLowerCase().includes(q)));
      grid.innerHTML = list.map(p => {
        const eps = state.db.episodes.filter(e=>e.podcastId===p.id);
        const listened = eps.filter(e=>e.listened).length;
        return `<div class="card">
            <h3>${p.favorite?'⭐ ':''}${p.title}</h3>
            <p>${p.description||''}</p>
            <p>${listened}/${eps.length} episoder</p>
            <div class="actions"><button data-open="${p.id}">Åbn</button><button data-del="${p.id}" class="danger">Slet</button></div>
          </div>`;
      }).join('') || '<p>Ingen podcasts.</p>';
    };
    paint();
    search.oninput = paint; fav.onchange = paint;
    grid.onclick = (e) => {
      const openId = e.target.dataset.open;
      const delId = e.target.dataset.del;
      if (openId) { state.route = 'podcast'; state.selectedPodcastId = openId; state.selectedEpisodes.clear(); render(); }
      if (delId && confirm('Slet podcast og alle episoder?')) {
        state.db.podcasts = state.db.podcasts.filter(p=>p.id!==delId);
        state.db.episodes = state.db.episodes.filter(ep=>ep.podcastId!==delId);
        saveDb(); render();
      }
    };
  }

  if (state.route === 'podcast') {
    const p = state.db.podcasts.find(x=>x.id===state.selectedPodcastId);
    if (!p) { state.route='podcasts'; return render(); }
    let eps = state.db.episodes.filter(e=>e.podcastId===p.id).sort((a,b)=>a.number-b.number);
    root.innerHTML = `
      <div class="card">
        <div class="actions" style="justify-content:space-between">
          <h3>${p.title}</h3>
          <div class="actions"><button id="editPodcast">Rediger podcast</button><button id="sheetImport">📄 Google Sheets</button></div>
        </div>
        <p>${p.description || ''}</p>
      </div>
      <div class="card" style="margin-top:1rem">
        <div class="actions">
          <button id="bulkListened" class="success">Markér som lyttet</button>
          <button id="bulkUnlistened">Markér som ulyttet</button>
          <button id="bulkDelete" class="danger">Slet valgte</button>
          <span>${state.selectedEpisodes.size} valgt</span>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th><input id="selAll" type="checkbox" /></th><th>Nr</th><th>Titel</th><th>Dato</th><th>Varighed</th><th class="hide-mobile">1.2x</th><th>Status</th><th>Handlinger</th></tr></thead>
          <tbody>
            ${eps.map(ep=>`<tr class="${state.selectedEpisodes.has(ep.id)?'selected':''}">
              <td><input data-sel="${ep.id}" type="checkbox" ${state.selectedEpisodes.has(ep.id)?'checked':''}></td>
              <td>${ep.number || '-'}</td><td>${ep.title}</td><td>${ep.date}</td><td>${fmtMins(ep.duration)}</td><td class="hide-mobile">${fmtMins(Math.round(ep.duration/1.2))}</td>
              <td>${ep.listened?'✅':'🔴'}</td>
              <td><button data-toggle="${ep.id}">Toggle</button> <button data-edit="${ep.id}">Rediger</button> <button data-del="${ep.id}" class="danger">Slet</button></td></tr>`).join('')}
          </tbody>
        </table></div>
      </div>`;

    root.querySelector('#editPodcast').onclick = () => openPodcastModal(p);
    root.querySelector('#sheetImport').onclick = () => openSheetsImport(p.id);

    root.querySelector('#selAll').checked = eps.length && state.selectedEpisodes.size === eps.length;
    root.querySelector('#selAll').onchange = (e)=>{
      if (e.target.checked) eps.forEach(ep=>state.selectedEpisodes.add(ep.id));
      else state.selectedEpisodes.clear();
      render();
    };

    root.querySelectorAll('[data-sel]').forEach(c => c.onchange = (e)=>{
      const id = e.target.dataset.sel;
      e.target.checked ? state.selectedEpisodes.add(id) : state.selectedEpisodes.delete(id);
      render();
    });

    const bulkToggle = (listenVal) => {
      const ids = [...state.selectedEpisodes];
      state.db.episodes = state.db.episodes.map(ep => ids.includes(ep.id) && ep.listened !== listenVal ? {...ep, listened: listenVal, listenedDate: listenVal ? dateNow() : ''} : ep);
      state.selectedEpisodes.clear(); saveDb(); render();
    };
    root.querySelector('#bulkListened').onclick = () => bulkToggle(true);
    root.querySelector('#bulkUnlistened').onclick = () => bulkToggle(false);
    root.querySelector('#bulkDelete').onclick = () => {
      const ids = [...state.selectedEpisodes];
      if (!ids.length) return;
      if (!confirm(`Slet ${ids.length} episoder?`)) return;
      state.db.episodes = state.db.episodes.filter(ep=>!ids.includes(ep.id));
      state.selectedEpisodes.clear(); saveDb(); render();
    };

    root.querySelector('tbody').onclick = (e)=>{
      const id = e.target.dataset.toggle || e.target.dataset.edit || e.target.dataset.del;
      if (!id) return;
      if (e.target.dataset.toggle) {
        state.db.episodes = state.db.episodes.map(ep=>ep.id===id ? {...ep, listened: !ep.listened, listenedDate: !ep.listened ? dateNow() : ''} : ep);
      }
      if (e.target.dataset.edit) openEpisodeModal(state.db.episodes.find(ep=>ep.id===id));
      if (e.target.dataset.del && confirm('Slet episode?')) state.db.episodes = state.db.episodes.filter(ep=>ep.id!==id);
      saveDb(); render();
    };
  }

  if (state.route === 'stats') {
    const eps = state.db.episodes;
    const remaining = eps.filter(e=>!e.listened);
    root.innerHTML = `<div class="grid stats">
      <div class="card"><h3>Resterende episoder</h3><p>${remaining.length}</p></div>
      <div class="card"><h3>Resterende tid</h3><p>${fmtMins(remaining.reduce((a,e)=>a+e.duration,0))}</p></div>
      <div class="card"><h3>Resterende tid 1.2x</h3><p>${fmtMins(Math.round(remaining.reduce((a,e)=>a+e.duration,0)/1.2))}</p></div>
      <div class="card"><h3>Total lyttetid</h3><p>${fmtMins(eps.filter(e=>e.listened).reduce((a,e)=>a+e.duration,0))}</p></div>
    </div>`;
  }

  if (state.route === 'settings') {
    const customCategories = state.db.categories.filter(c=>!DEFAULT_CATEGORIES.includes(c));
    root.innerHTML = `<div class="card">
      <h3>Import/Export <button id="guideBtn">❓</button></h3>
      <div class="actions"><button id="exportBtn">Eksport JSON</button><input type="file" id="importFile"/></div>
      <p>Lagerplads: ${(new Blob([JSON.stringify(state.db)]).size/1024).toFixed(2)} KB</p>
      <button id="clearAll" class="danger">Slet alle data</button>
    </div>
    <div class="card" style="margin-top:1rem">
      <h3>Kategorier</h3>
      <div class="actions"><input id="catInput" placeholder="Ny kategori"><button id="addCat">Tilføj</button></div>
      <ul>${state.db.categories.map(c=>`<li>${c} ${customCategories.includes(c)?`<button data-delcat="${c}">Slet</button>`:''}</li>`).join('')}</ul>
    </div>`;

    root.querySelector('#guideBtn').onclick = openImportGuide;
    root.querySelector('#exportBtn').onclick = () => {
      const blob = new Blob([JSON.stringify(state.db, null, 2)], {type:'application/json'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `podcast-backup-${dateNow()}.json`; a.click();
    };
    root.querySelector('#importFile').onchange = async (e)=> {
      const file = e.target.files[0]; if (!file) return;
      state.db = JSON.parse(await file.text()); saveDb(); render();
    };
    root.querySelector('#clearAll').onclick = ()=>{ if (confirm('Slet alle data?')) { localStorage.removeItem(STORAGE_KEY); state.db = loadDb(); render(); } };
    root.querySelector('#addCat').onclick = ()=>{ const v=root.querySelector('#catInput').value.trim(); if(v){ state.db.categories.push(v); saveDb(); render();}};
    root.querySelectorAll('[data-delcat]').forEach(b=>b.onclick=()=>{ state.db.categories = state.db.categories.filter(c=>c!==b.dataset.delcat); saveDb(); render();});
  }
}

function openPodcastModal(podcast=null) {
  const isEdit = !!podcast;
  els.podcastModal.innerHTML = `<form method="dialog">
      <h3>${isEdit?'Rediger':'Tilføj'} Podcast</h3>
      <div class="form-grid">
        <input class="full" name="title" placeholder="Titel" value="${podcast?.title||''}" required>
        <select name="category">${state.db.categories.map(c=>`<option ${podcast?.category===c?'selected':''}>${c}</option>`)}</select>
        <input name="language" placeholder="Sprog" value="${podcast?.language||''}">
        <select name="platform"><option>Pocket Casts</option><option>YouTube</option><option>Podimo</option></select>
        <input class="full" name="feedUrl" placeholder="Feed URL" value="${podcast?.feedUrl||''}">
        <input class="full" name="image" placeholder="Billede URL" value="${podcast?.image||''}">
        <textarea class="full" name="description" placeholder="Beskrivelse">${podcast?.description||''}</textarea>
        <label class="full"><input name="favorite" type="checkbox" ${podcast?.favorite?'checked':''}> Favorit</label>
      </div>
      <div class="actions" style="margin-top:.7rem"><button class="primary" value="ok">Gem</button><button value="cancel">Annuller</button></div>
    </form>`;
  const form = els.podcastModal.querySelector('form');
  els.podcastModal.showModal();
  form.onsubmit = (e)=>{
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form).entries());
    d.favorite = form.favorite.checked;
    if (isEdit) state.db.podcasts = state.db.podcasts.map(p=>p.id===podcast.id ? {...p,...d} : p);
    else state.db.podcasts.push({id:uid(),...d, createdAt:Date.now()});
    saveDb(); els.podcastModal.close(); render();
  };
}

function openEpisodeModal(ep=null) {
  const isEdit = !!ep;
  els.episodeModal.innerHTML = `<form method="dialog">
      <h3>${isEdit?'Rediger':'Tilføj'} Episode</h3>
      <div class="form-grid">
        <select name="podcastId" ${isEdit?'disabled':''}>${state.db.podcasts.map(p=>`<option value="${p.id}" ${ep?.podcastId===p.id||state.selectedPodcastId===p.id?'selected':''}>${p.title}</option>`)}</select>
        <input name="number" type="number" placeholder="Episode nr" value="${ep?.number||''}">
        <input class="full" name="title" placeholder="Titel" value="${ep?.title||''}" required>
        <input name="date" type="date" value="${ep?.date||dateNow()}">
        <input name="duration" placeholder="Varighed (hh:mm:ss)" value="${ep ? `${Math.floor(ep.duration/60)}:${String(ep.duration%60).padStart(2,'0')}:00` : '00:45:00'}">
        <label><input type="checkbox" name="listened" ${ep?.listened?'checked':''}> Lyttet</label>
      </div>
      <div class="actions" style="margin-top:.7rem"><button class="primary">Gem</button><button value="cancel">Annuller</button></div>
    </form>`;
  const form = els.episodeModal.querySelector('form');
  els.episodeModal.showModal();
  form.onsubmit = (e)=>{
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form).entries());
    d.listened = form.listened.checked;
    d.duration = parseDuration(d.duration);
    d.number = Number(d.number) || null;
    if (isEdit) state.db.episodes = state.db.episodes.map(x=>x.id===ep.id?{...x,...d}:x);
    else state.db.episodes.push({id:uid(), ...d, podcastId: d.podcastId || state.selectedPodcastId, listenedDate: d.listened ? dateNow() : ''});
    saveDb(); els.episodeModal.close(); render();
  };
}

function openImportGuide() {
  els.guideModal.innerHTML = `<article class="card">
      <h3>Guide: Import fra Google Sheets</h3>
      <ol>
        <li>Kopier rækker fra Google Sheets.</li>
        <li>Format: Episode nr | Titel | Dato (dd-mm-yyyy) | Varighed (tt:mm:ss).</li>
        <li>Klik på Google Sheets-ikon på podcast-siden og indsæt data.</li>
      </ol>
      <pre>12 | Intro til AI | 14-01-2026 | 00:42:30\n13 | Prompt tricks | 17-01-2026 | 01:10:00</pre>
      <p>Tip: Brug konsekvent datoformat og sørg for at episode nr er tal.</p>
      <button onclick="document.getElementById('importGuideModal').close()">Luk</button>
    </article>`;
  els.guideModal.showModal();
}

function openSheetsImport(podcastId) {
  const text = prompt('Indsæt linjer i format: nr|titel|dato|varighed');
  if (!text) return;
  const rows = text.split('\n').map(r=>r.trim()).filter(Boolean);
  const newEpisodes = [];
  for (const row of rows) {
    const [nr,title,date,duration] = row.split('|').map(v=>v.trim());
    if (!title || !date || !duration) continue;
    const [dd,mm,yy] = date.split('-');
    newEpisodes.push({id:uid(), podcastId, number:Number(nr)||null, title, date:`${yy}-${mm}-${dd}`, duration:parseDuration(duration), listened:false, listenedDate:''});
  }
  state.db.episodes.push(...newEpisodes);
  saveDb(); render();
}

function closeMobileMenu() { state.mobileOpen = false; els.sidebar.classList.remove('open'); els.overlay.classList.add('hidden'); }

function wireGlobalEvents() {
  document.querySelectorAll('[data-route]').forEach(btn => btn.onclick = () => {
    state.route = btn.dataset.route;
    if (state.route !== 'podcast') state.selectedPodcastId = null;
    closeMobileMenu(); render();
  });
  document.getElementById('themeToggle').onclick = () => { state.db.darkMode = !state.db.darkMode; saveDb(); render(); };
  document.getElementById('addPodcastBtn').onclick = () => openPodcastModal();
  document.getElementById('addEpisodeBtn').onclick = () => openEpisodeModal();
  document.getElementById('mobileMenuBtn').onclick = () => {
    state.mobileOpen = !state.mobileOpen;
    els.sidebar.classList.toggle('open', state.mobileOpen);
    els.overlay.classList.toggle('hidden', !state.mobileOpen);
  };
  els.overlay.onclick = closeMobileMenu;
}

wireGlobalEvents();
render();
