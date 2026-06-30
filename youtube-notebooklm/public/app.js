/* ═══════════════════════════════════════════════════
   YouTube → NotebookLM  |  app.js
   All YouTube Data API v3 calls happen client-side.
   The API key is stored in localStorage.
═══════════════════════════════════════════════════ */

const YT_API = 'https://www.googleapis.com/youtube/v3';

/* ── State ── */
const state = {
  videos: [],
  selected: new Set(),
  nextPageToken: null,
  loading: false,
  playlistId: null,
  apiKey: localStorage.getItem('yt_api_key') || '',
};

/* ── DOM ── */
const $ = (id) => document.getElementById(id);
const playlistInput   = $('playlist-url');
const fetchBtn        = $('fetch-btn');
const fetchLabel      = $('fetch-label');
const fetchSpinner    = $('fetch-spinner');
const errorBox        = $('error-box');
const resultsSection  = $('results-section');
const playlistTitleEl = $('playlist-title');
const videoCountEl    = $('video-count');
const videoList       = $('video-list');
const loadMoreSection = $('loading-more');
const loadMoreBtn     = $('load-more-btn');
const actionBar       = $('action-bar');
const selectedCountEl = $('selected-count');
const copyBtn         = $('copy-btn');
const pasteBtn        = $('paste-btn');
const selectAllBtn    = $('select-all-btn');
const toast           = $('toast');
const apiKeyInput     = $('api-key-input');
const apiKeySaveBtn   = $('api-key-save');
const apiKeySection   = $('api-key-section');
const apiKeyStatus    = $('api-key-status');

/* ── Init ── */
if (state.apiKey) {
  apiKeyInput.value = state.apiKey;
  showApiKeyStatus(true);
}

/* ── Utils ── */
function extractPlaylistId(url) {
  try {
    return new URL(url).searchParams.get('list');
  } catch {
    const m = url.match(/[?&]list=([^&]+)/);
    return m ? m[1] : null;
  }
}

let toastTimer;
function showToast(msg, type = '') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast${type ? ' ' + type : ''}`;
  toast.classList.remove('hidden');
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

function showError(msg) {
  errorBox.innerHTML = msg;
  errorBox.classList.remove('hidden');
}

function clearError() {
  errorBox.classList.add('hidden');
}

function setLoading(on) {
  state.loading = on;
  fetchBtn.disabled = on;
  fetchLabel.classList.toggle('hidden', on);
  fetchSpinner.classList.toggle('hidden', !on);
}

function showApiKeyStatus(saved) {
  apiKeyStatus.textContent = saved ? '✅ Clé sauvegardée' : '';
  apiKeyStatus.style.color = 'var(--success)';
}

/* ── API Key management ── */
apiKeySaveBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showToast('Entre ta clé API YouTube', 'error');
    return;
  }
  state.apiKey = key;
  localStorage.setItem('yt_api_key', key);
  showApiKeyStatus(true);
  showToast('Clé API sauvegardée !', 'success');
});

/* ── YouTube Data API v3 calls ── */
async function ytFetch(endpoint, params) {
  const key = state.apiKey;
  if (!key) throw new Error('Clé API manquante. Entre ta clé YouTube Data API v3 ci-dessous.');

  const p = new URLSearchParams({ ...params, key });
  const resp = await fetch(`${YT_API}/${endpoint}?${p}`);
  const data = await resp.json();
  if (!resp.ok) {
    const msg = data.error?.message || resp.statusText;
    throw new Error(msg);
  }
  return data;
}

async function getPlaylistInfo(playlistId) {
  const data = await ytFetch('playlists', {
    part: 'snippet',
    id: playlistId,
    maxResults: '1',
  });
  return data.items?.[0]?.snippet?.title || 'Playlist';
}

async function getPlaylistItems(playlistId, pageToken = null) {
  const params = {
    part: 'snippet,contentDetails',
    playlistId,
    maxResults: '50',
  };
  if (pageToken) params.pageToken = pageToken;
  return ytFetch('playlistItems', params);
}

/* ── Load playlist ── */
async function loadPlaylist() {
  clearError();
  const raw = playlistInput.value.trim();
  if (!raw) { showError('Colle une URL de playlist YouTube.'); return; }

  const id = extractPlaylistId(raw);
  if (!id) { showError("URL invalide — elle doit contenir <code>?list=...</code>"); return; }

  if (!state.apiKey) {
    showError('Entre ta clé <strong>YouTube Data API v3</strong> dans la section ci-dessous pour continuer. C\'est gratuit !');
    apiKeySection.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  state.playlistId = id;
  state.videos = [];
  state.selected.clear();
  state.nextPageToken = null;
  videoList.innerHTML = '';
  resultsSection.classList.add('hidden');
  actionBar.classList.add('hidden');
  setLoading(true);

  try {
    const [title, data] = await Promise.all([
      getPlaylistInfo(id),
      getPlaylistItems(id),
    ]);

    playlistTitleEl.textContent = title;
    processPageData(data);
    resultsSection.classList.remove('hidden');
  } catch (err) {
    showError(`Erreur : ${err.message}`);
  } finally {
    setLoading(false);
  }
}

function processPageData(data) {
  const newVideos = (data.items || [])
    .filter((item) => item.snippet.resourceId?.kind === 'youtube#video')
    .map((item) => ({
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      channelName: item.snippet.videoOwnerChannelTitle || '',
      thumbnail:
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url ||
        null,
      url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
    }));

  state.videos.push(...newVideos);
  state.nextPageToken = data.nextPageToken || null;
  renderVideos(newVideos, state.videos.length > newVideos.length);
  updateCount();

  if (state.nextPageToken) {
    loadMoreSection.classList.remove('hidden');
  } else {
    loadMoreSection.classList.add('hidden');
  }
}

async function loadMore() {
  if (!state.nextPageToken || state.loading) return;
  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = 'Chargement…';
  setLoading(true);

  try {
    const data = await getPlaylistItems(state.playlistId, state.nextPageToken);
    processPageData(data);
  } catch (err) {
    showError(`Erreur : ${err.message}`);
  } finally {
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = 'Charger plus…';
    setLoading(false);
  }
}

/* ── Render ── */
function renderVideos(videos, append = false) {
  if (!append) videoList.innerHTML = '';

  for (const video of videos) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.dataset.id = video.videoId;

    card.innerHTML = `
      <div class="video-thumb">
        ${video.thumbnail ? `<img src="${escapeHtml(video.thumbnail)}" alt="" loading="lazy" />` : '<div class="thumb-placeholder"></div>'}
      </div>
      <div class="video-info">
        <div class="video-title">${escapeHtml(video.title)}</div>
        ${video.channelName ? `<div class="video-channel">${escapeHtml(video.channelName)}</div>` : ''}
      </div>
      <div class="video-check">✓</div>
    `;

    card.addEventListener('click', () => toggleVideo(video.videoId, card));
    videoList.appendChild(card);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Selection ── */
function toggleVideo(videoId, card) {
  if (state.selected.has(videoId)) {
    state.selected.delete(videoId);
    card.classList.remove('selected');
  } else {
    state.selected.add(videoId);
    card.classList.add('selected');
  }
  updateActionBar();
}

function updateCount() {
  const total = state.videos.length;
  const more = state.nextPageToken ? '+' : '';
  videoCountEl.textContent = `${total}${more} vidéo${total > 1 ? 's' : ''}`;
}

function updateActionBar() {
  const count = state.selected.size;
  selectedCountEl.textContent = count;
  actionBar.classList.toggle('hidden', count === 0);

  const allSelected =
    state.videos.length > 0 &&
    state.videos.every((v) => state.selected.has(v.videoId));
  selectAllBtn.textContent = allSelected ? 'Tout désélectionner' : 'Tout sélectionner';
}

function toggleSelectAll() {
  const allSelected =
    state.videos.length > 0 &&
    state.videos.every((v) => state.selected.has(v.videoId));

  if (allSelected) {
    state.selected.clear();
    document.querySelectorAll('.video-card').forEach((c) => c.classList.remove('selected'));
  } else {
    state.videos.forEach((v) => state.selected.add(v.videoId));
    document.querySelectorAll('.video-card').forEach((c) => c.classList.add('selected'));
  }
  updateActionBar();
}

/* ── Copy ── */
async function copySelectedUrls() {
  const urls = state.videos
    .filter((v) => state.selected.has(v.videoId))
    .map((v) => v.url)
    .join('\n');

  if (!urls) return;

  try {
    await navigator.clipboard.writeText(urls);
  } catch {
    // Fallback
    const ta = Object.assign(document.createElement('textarea'), {
      value: urls,
      style: 'position:fixed;opacity:0',
    });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  showToast(`✅ ${state.selected.size} URL${state.selected.size > 1 ? 's' : ''} copiée${state.selected.size > 1 ? 's' : ''} !`, 'success');
}

/* ── Paste ── */
async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) playlistInput.value = text;
  } catch {
    showToast('Colle manuellement (Ctrl+V / appui long)', 'error');
  }
}

/* ── Listeners ── */
fetchBtn.addEventListener('click', loadPlaylist);
pasteBtn.addEventListener('click', pasteFromClipboard);
selectAllBtn.addEventListener('click', toggleSelectAll);
loadMoreBtn.addEventListener('click', loadMore);
copyBtn.addEventListener('click', copySelectedUrls);
playlistInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadPlaylist(); });

/* ── PWA ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  );
}
