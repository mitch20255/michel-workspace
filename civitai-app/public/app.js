/* Civitai Explorer — logique de l'interface (vanilla JS, aucune dépendance). */
'use strict';

const $ = (sel) => document.querySelector(sel);

const SORTS = {
  models: ['Highest Rated', 'Most Downloaded', 'Most Liked', 'Newest'],
  images: ['Most Reactions', 'Most Comments', 'Newest'],
  creators: [],
  favorites: [],
};

const state = {
  tab: 'models',
  query: '',
  username: '',
  cursor: null,
  page: 1,
  pageSize: Number(localStorage.getItem('civitai.pageSize') || 24),
  apiKey: localStorage.getItem('civitai.apiKey') || '',
  favorites: JSON.parse(localStorage.getItem('civitai.favorites') || '[]'),
  items: [],
  loading: false,
  exhausted: false,
};

// ---------------------------------------------------------------- utilitaires
const nf = new Intl.NumberFormat('fr-FR');

function compact(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + ' M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + ' k';
  return nf.format(n);
}

function bytes(kb) {
  if (!kb) return '';
  const mb = kb / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} Go` : `${mb.toFixed(1)} Mo`;
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function isAdult(entity) {
  if (!entity) return false;
  if (typeof entity.nsfwLevel === 'number') return entity.nsfwLevel > 1;
  if (typeof entity.nsfwLevel === 'string') return !['none', 'soft'].includes(entity.nsfwLevel.toLowerCase());
  return Boolean(entity.nsfw);
}

function firstImage(model) {
  for (const version of model.modelVersions || []) {
    const img = (version.images || [])[0];
    if (img?.url) return img;
  }
  return null;
}

async function copy(text, label = 'Copié') {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast(label);
}

let toastTimer;
function toast(message) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
      'background:#1e242e;border:1px solid #2a323e;padding:10px 18px;border-radius:999px;' +
      'z-index:99;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.4)';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 1800);
}

// ---------------------------------------------------------------- API client
async function api(resource, params = {}) {
  const url = new URL(`/api/civitai/${resource}`, location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value !== null && value !== undefined) url.searchParams.set(key, value);
  }
  const headers = {};
  if (state.apiKey) headers['x-civitai-key'] = state.apiKey;

  const res = await fetch(url, { headers });
  const data = await res.json().catch(() => ({ error: 'Réponse illisible du serveur.' }));
  if (!res.ok) throw new Error(data.error || `Erreur HTTP ${res.status}`);
  return data;
}

// ---------------------------------------------------------------- rendu
function showStatus(message, isError = false) {
  const el = $('#status');
  el.className = 'status' + (isError ? ' error' : '');
  el.innerHTML = message;
  el.hidden = false;
}

function hideStatus() { $('#status').hidden = true; }

function skeletons(count = 8) {
  $('#grid').innerHTML = Array.from({ length: count }, () => '<div class="skeleton"></div>').join('');
}

function cardModel(model) {
  const img = firstImage(model);
  const blur = $('#fBlur').checked && (isAdult(model) || isAdult(img));
  const stats = model.stats || {};
  const version = (model.modelVersions || [])[0];
  return `
    <article class="card" data-kind="model" data-id="${model.id}">
      <div class="thumb${blur ? ' blurred' : ''}" style="${img ? `background-image:url('${esc(img.url)}')` : ''}">
        ${isAdult(model) ? '<span class="nsfw-tag">18+</span>' : ''}
      </div>
      <div class="card-body">
        <div class="card-title">${esc(model.name)}</div>
        <div class="card-meta">
          <span class="pill accent">${esc(model.type)}</span>
          ${version?.baseModel ? `<span class="pill">${esc(version.baseModel)}</span>` : ''}
        </div>
        <div class="card-meta">
          <span>⬇ ${compact(stats.downloadCount)}</span>
          <span>👍 ${compact(stats.thumbsUpCount ?? stats.favoriteCount)}</span>
          <span>${esc(model.creator?.username || 'anonyme')}</span>
        </div>
      </div>
    </article>`;
}

function cardImage(image) {
  const blur = $('#fBlur').checked && isAdult(image);
  const stats = image.stats || {};
  const reactions = (stats.likeCount || 0) + (stats.heartCount || 0) + (stats.laughCount || 0);
  return `
    <article class="card" data-kind="image" data-id="${image.id}">
      <div class="thumb${blur ? ' blurred' : ''}" style="background-image:url('${esc(image.url)}')">
        ${isAdult(image) ? '<span class="nsfw-tag">18+</span>' : ''}
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span>❤ ${compact(reactions)}</span>
          <span>💬 ${compact(stats.commentCount)}</span>
          <span>${esc(image.username || '—')}</span>
        </div>
      </div>
    </article>`;
}

function cardCreator(creator) {
  return `
    <article class="card" data-kind="creator" data-id="${esc(creator.username)}">
      <div class="card-body" style="padding:18px 14px">
        <div class="card-title">${esc(creator.username)}</div>
        <div class="card-meta">
          <span class="pill accent">${compact(creator.modelCount)} modèle(s)</span>
        </div>
        <p class="muted small" style="margin:6px 0 0">Voir ses modèles →</p>
      </div>
    </article>`;
}

function renderItems(append = false) {
  const grid = $('#grid');
  const html = state.items.map((item) => {
    if (state.tab === 'images') return cardImage(item);
    if (state.tab === 'creators') return cardCreator(item);
    return cardModel(item);
  }).join('');

  if (append) grid.insertAdjacentHTML('beforeend', html);
  else grid.innerHTML = html;

  $('#loadMore').hidden = state.exhausted || state.tab === 'favorites' || state.items.length === 0;
  $('#resultInfo').textContent = state.items.length
    ? `${state.items.length} résultat(s) affiché(s)${state.exhausted ? ' — fin de liste' : ''}`
    : '';
}

// ---------------------------------------------------------------- chargement
function buildParams() {
  const base = {
    limit: state.pageSize,
    sort: $('#fSort').value,
    period: $('#fPeriod').value,
    nsfw: $('#fNsfw').checked ? 'true' : 'false',
  };

  if (state.tab === 'models') {
    return {
      ...base,
      query: state.query,
      username: state.username,
      types: $('#fType').value,
      baseModels: $('#fBaseModel').value,
      cursor: state.cursor,
    };
  }
  if (state.tab === 'images') {
    return { ...base, username: state.username, cursor: state.cursor };
  }
  // creators : pagination classique, pas de tri/période
  return { limit: state.pageSize, query: state.query, page: state.page };
}

async function load(append = false) {
  if (state.loading) return;

  if (state.tab === 'favorites') {
    state.items = state.favorites;
    state.exhausted = true;
    hideStatus();
    if (!state.items.length) showStatus('Aucun favori pour l’instant. Ouvre un modèle et clique sur ★ pour l’ajouter.');
    renderItems(false);
    return;
  }

  state.loading = true;
  if (!append) {
    state.cursor = null;
    state.page = 1;
    state.exhausted = false;
    hideStatus();
    skeletons();
  }

  try {
    const data = await api(state.tab, buildParams());
    const items = data.items || [];
    state.items = append ? state.items.concat(items) : items;

    const meta = data.metadata || {};
    state.cursor = meta.nextCursor || null;
    state.page = meta.currentPage ? meta.currentPage + 1 : state.page + 1;
    state.exhausted = items.length === 0 ||
      (state.tab === 'creators' ? !meta.nextPage : !meta.nextCursor && !meta.nextPage);

    if (!state.items.length) {
      showStatus('Aucun résultat. Essaie d’élargir les filtres ou de changer la période.');
    }
    renderItems(append);
  } catch (err) {
    $('#grid').innerHTML = '';
    showStatus(
      `<strong>Échec de la requête.</strong><br>${esc(err.message)}` +
      `<br><span class="muted small">Vérifie que le serveur peut joindre l’API ` +
      `(variable <code>CIVITAI_BASE_URL</code>) et que ta connexion est active.</span>`,
      true
    );
  } finally {
    state.loading = false;
  }
}

// ---------------------------------------------------------------- détail
function isFavorite(id) { return state.favorites.some((f) => f.id === id); }

function toggleFavorite(model) {
  if (isFavorite(model.id)) {
    state.favorites = state.favorites.filter((f) => f.id !== model.id);
    toast('Retiré des favoris');
  } else {
    state.favorites.unshift(model);
    toast('Ajouté aux favoris');
  }
  localStorage.setItem('civitai.favorites', JSON.stringify(state.favorites));
  $('#favCount').textContent = state.favorites.length;
  if (state.tab === 'favorites') load();
}

function versionBlock(version) {
  const files = (version.files || []).map((file) => `
    <div class="file-row">
      <span>${esc(file.name)} <span class="muted small">${bytes(file.sizeKB)}</span></span>
      ${file.downloadUrl ? `<a href="${esc(file.downloadUrl)}" target="_blank" rel="noopener">Télécharger</a>` : ''}
    </div>`).join('');

  const words = (version.trainedWords || []).map((word) =>
    `<span class="word" data-copy="${esc(word)}">${esc(word)}</span>`).join('');

  return `
    <div class="version">
      <div class="version-head">
        <strong>${esc(version.name)}</strong>
        <span class="pill">${esc(version.baseModel || '—')}</span>
      </div>
      <div class="card-meta" style="margin-top:6px">
        <span>⬇ ${compact(version.stats?.downloadCount)}</span>
        <span>${version.createdAt ? new Date(version.createdAt).toLocaleDateString('fr-FR') : ''}</span>
      </div>
      ${words ? `<div class="words">${words}</div>` : ''}
      ${files ? `<div class="files">${files}</div>` : ''}
    </div>`;
}

function openDrawer(html) {
  $('#drawerBody').innerHTML = html;
  $('#overlay').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  $('#overlay').hidden = true;
  document.body.style.overflow = '';
}

async function showModel(id) {
  openDrawer('<p class="muted">Chargement…</p>');
  let model;
  try {
    model = await api(`models/${id}`);
  } catch (err) {
    return openDrawer(`<p class="status error">${esc(err.message)}</p>`);
  }

  const img = firstImage(model);
  const blurClass = $('#fBlur').checked && isAdult(model) ? ' class="blurred"' : '';
  const stats = model.stats || {};
  const gallery = (model.modelVersions || [])
    .flatMap((v) => v.images || [])
    .slice(0, 12)
    .map((im) => `<img${$('#fBlur').checked && isAdult(im) ? ' class="blurred"' : ''} src="${esc(im.url)}" loading="lazy" alt="">`)
    .join('');

  openDrawer(`
    <div class="detail-head">
      ${img ? `<img${blurClass} src="${esc(img.url)}" alt="">` : ''}
      <div>
        <h2>${esc(model.name)}</h2>
        <div class="card-meta">
          <span class="pill accent">${esc(model.type)}</span>
          ${model.nsfw ? '<span class="pill" style="color:#ff6b6b">18+</span>' : ''}
          <span class="pill">par ${esc(model.creator?.username || 'anonyme')}</span>
        </div>
        <div class="stats">
          <span><b>${compact(stats.downloadCount)}</b> téléchargements</span>
          <span><b>${compact(stats.thumbsUpCount ?? stats.favoriteCount)}</b> likes</span>
          <span><b>${compact(stats.commentCount)}</b> commentaires</span>
        </div>
        <div class="row-end" style="justify-content:flex-start">
          <button class="ghost" id="favBtn">${isFavorite(model.id) ? '★ Retirer des favoris' : '☆ Ajouter aux favoris'}</button>
          <button class="ghost" data-copy="${esc(String(model.id))}">Copier l'ID</button>
        </div>
        <div class="tagline">${(model.tags || []).slice(0, 10).map((t) => `<span class="pill">${esc(t)}</span>`).join('')}</div>
      </div>
    </div>

    ${model.description ? `<div class="section"><h3>Description</h3><div class="desc">${model.description}</div></div>` : ''}

    <div class="section">
      <h3>Versions (${(model.modelVersions || []).length})</h3>
      ${(model.modelVersions || []).map(versionBlock).join('') || '<p class="muted">Aucune version.</p>'}
    </div>

    ${gallery ? `<div class="section"><h3>Aperçus</h3><div class="gallery">${gallery}</div></div>` : ''}
  `);

  $('#favBtn')?.addEventListener('click', () => {
    toggleFavorite({
      id: model.id,
      name: model.name,
      type: model.type,
      nsfw: model.nsfw,
      creator: model.creator,
      stats: model.stats,
      modelVersions: (model.modelVersions || []).slice(0, 1),
    });
    $('#favBtn').textContent = isFavorite(model.id) ? '★ Retirer des favoris' : '☆ Ajouter aux favoris';
  });
}

function showImage(id) {
  const image = state.items.find((i) => String(i.id) === String(id));
  if (!image) return;
  const meta = image.meta || {};
  const blurClass = $('#fBlur').checked && isAdult(image) ? ' class="blurred"' : '';
  const rows = [
    ['Modèle', meta.Model],
    ['Sampler', meta.sampler],
    ['Steps', meta.steps],
    ['CFG', meta.cfgScale],
    ['Seed', meta.seed],
    ['Taille', image.width && image.height ? `${image.width}×${image.height}` : null],
    ['Auteur', image.username],
  ].filter(([, v]) => v !== undefined && v !== null && v !== '');

  openDrawer(`
    <h2 style="margin-top:0;padding-right:40px">Image #${esc(image.id)}</h2>
    <img${blurClass} src="${esc(image.url)}" alt="" style="width:100%;border-radius:10px;margin-bottom:18px">

    ${meta.prompt ? `
      <div class="section">
        <h3>Prompt <button class="ghost small" data-copy="${esc(meta.prompt)}" style="padding:2px 8px;font-size:11px">copier</button></h3>
        <div class="prompt-box">${esc(meta.prompt)}</div>
      </div>` : '<p class="muted">Aucune métadonnée de génération publiée pour cette image.</p>'}

    ${meta.negativePrompt ? `
      <div class="section">
        <h3>Prompt négatif <button class="ghost small" data-copy="${esc(meta.negativePrompt)}" style="padding:2px 8px;font-size:11px">copier</button></h3>
        <div class="prompt-box">${esc(meta.negativePrompt)}</div>
      </div>` : ''}

    ${rows.length ? `
      <div class="section">
        <h3>Paramètres</h3>
        <div class="files">
          ${rows.map(([k, v]) => `<div class="file-row"><span class="muted">${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}
        </div>
      </div>` : ''}
  `);
}

// ---------------------------------------------------------------- onglets
function setSortOptions() {
  const select = $('#fSort');
  const options = SORTS[state.tab];
  select.innerHTML = options.map((o) => `<option>${o}</option>`).join('');
  select.closest('.field').classList.toggle('hidden', options.length === 0);
  $('#fPeriod').closest('.field').classList.toggle('hidden', options.length === 0);
  document.querySelectorAll('[data-for="models"]').forEach((el) => {
    el.classList.toggle('hidden', state.tab !== 'models');
  });
}

function setTab(tab) {
  state.tab = tab;
  state.items = [];
  state.username = '';
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.tab === tab);
  });
  setSortOptions();
  $('#searchInput').placeholder = tab === 'creators'
    ? 'Rechercher un créateur…'
    : 'Rechercher un modèle, un tag, un créateur…';
  $('#searchForm').hidden = tab === 'favorites' || tab === 'images';
  load();
}

// ---------------------------------------------------------------- événements
document.addEventListener('click', (event) => {
  const copyTarget = event.target.closest('[data-copy]');
  if (copyTarget) {
    copy(copyTarget.dataset.copy);
    return;
  }

  const card = event.target.closest('.card');
  if (card) {
    const { kind, id } = card.dataset;
    if (kind === 'model') showModel(id);
    else if (kind === 'image') showImage(id);
    else if (kind === 'creator') {
      setTab('models');
      state.username = id;
      state.query = '';
      $('#searchInput').value = '';
      showStatus(`Modèles de <strong>${esc(id)}</strong>`);
      load();
    }
  }
});

$('#tabs').addEventListener('click', (event) => {
  const btn = event.target.closest('.tab');
  if (btn) setTab(btn.dataset.tab);
});

$('#searchForm').addEventListener('submit', (event) => {
  event.preventDefault();
  state.query = $('#searchInput').value.trim();
  state.username = '';
  load();
});

['fType', 'fBaseModel', 'fSort', 'fPeriod', 'fNsfw'].forEach((id) => {
  $('#' + id).addEventListener('change', () => load());
});

$('#fBlur').addEventListener('change', () => renderItems(false));
$('#loadMore').addEventListener('click', () => load(true));
$('#drawerClose').addEventListener('click', closeDrawer);
$('#overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay') closeDrawer(); });

$('#settingsBtn').addEventListener('click', () => {
  $('#apiKeyInput').value = state.apiKey;
  $('#pageSizeInput').value = String(state.pageSize);
  $('#settingsOverlay').hidden = false;
});
$('#settingsCancel').addEventListener('click', () => { $('#settingsOverlay').hidden = true; });
$('#settingsSave').addEventListener('click', () => {
  state.apiKey = $('#apiKeyInput').value.trim();
  state.pageSize = Number($('#pageSizeInput').value);
  localStorage.setItem('civitai.apiKey', state.apiKey);
  localStorage.setItem('civitai.pageSize', String(state.pageSize));
  $('#settingsOverlay').hidden = true;
  toast('Réglages enregistrés');
  load();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeDrawer();
    $('#settingsOverlay').hidden = true;
  }
  if (event.key === '/' && document.activeElement !== $('#searchInput')) {
    event.preventDefault();
    $('#searchInput').focus();
  }
});

// ---------------------------------------------------------------- démarrage
(async function init() {
  $('#favCount').textContent = state.favorites.length;
  setSortOptions();
  try {
    const config = await fetch('/api/config').then((r) => r.json());
    $('#endpoint').textContent = `API : ${config.baseUrl}${config.hasServerKey ? ' · clé serveur active' : ''}`;
  } catch {
    $('#endpoint').textContent = 'serveur local injoignable';
    $('#endpoint').classList.add('error');
  }
  load();
})();
