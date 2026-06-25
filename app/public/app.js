const grid = document.getElementById('grid');
const categoryList = document.getElementById('category-list');
const searchInput = document.getElementById('search');
const uploadInput = document.getElementById('upload-input');
const dropzone = document.getElementById('dropzone');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');

let activeCategory = null;
let searchTerm = '';

const ICONS = {
  'application/pdf': '📄',
  'text/plain': '📝',
  'text/markdown': '📝',
};

const CONTENT_TYPE_ICONS = {
  youtube: '🎬',
  webpage: '🔗',
  note: '🗒️',
};

function iconFor(item) {
  if (CONTENT_TYPE_ICONS[item.content_type]) return CONTENT_TYPE_ICONS[item.content_type];
  if (item.mimetype?.startsWith('image/')) return null;
  return ICONS[item.mimetype] || '📁';
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function fetchItems() {
  const params = new URLSearchParams();
  if (activeCategory) params.set('category', activeCategory);
  if (searchTerm) params.set('q', searchTerm);
  const res = await fetch(`/api/items?${params}`);
  return res.json();
}

async function fetchCategories() {
  const res = await fetch('/api/categories');
  return res.json();
}

function renderCategories(categories) {
  categoryList.innerHTML = '';
  const allLi = document.createElement('li');
  allLi.textContent = 'Toutes';
  allLi.className = activeCategory === null ? 'active' : '';
  allLi.onclick = () => { activeCategory = null; refresh(); };
  categoryList.appendChild(allLi);

  for (const c of categories) {
    const li = document.createElement('li');
    li.className = activeCategory === c.category ? 'active' : '';
    li.onclick = () => { activeCategory = c.category; refresh(); };
    li.innerHTML = `<span>${escapeHtml(c.category)}</span><span class="count">${c.count}</span>`;
    categoryList.appendChild(li);
  }
}

function renderGrid(items) {
  grid.innerHTML = '';
  for (const item of items) {
    const card = document.createElement('div');
    card.className = `card ${item.status}`;
    const icon = iconFor(item);
    card.innerHTML = `
      <div class="thumb">${icon ? icon : `<img src="/api/files/${item.id}" loading="lazy" />`}</div>
      <div class="info">
        <div class="filename">${escapeHtml(item.filename)}</div>
        <span class="category-badge">${escapeHtml(item.category || (item.status === 'pending' ? '⏳ analyse...' : 'sans catégorie'))}</span>
      </div>
    `;
    card.onclick = () => openModal(item);
    grid.appendChild(card);
  }
}

const OCR_LABELS = {
  youtube: 'Transcript complet',
  note: 'Texte original',
};

function openModal(item) {
  const tags = JSON.parse(item.tags || '[]');
  const icon = iconFor(item);
  const isFile = item.content_type === 'file' || !item.content_type;
  const ocrLabel = OCR_LABELS[item.content_type] || 'Texte détecté';
  modalBody.innerHTML = `
    ${icon ? `<div style="font-size:4rem">${icon}</div>` : `<img src="/api/files/${item.id}" />`}
    <h3>${escapeHtml(item.filename)}</h3>
    ${item.source_url ? `<p><a href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener noreferrer">🔗 Ouvrir la source</a></p>` : ''}
    <p style="white-space:pre-wrap">${escapeHtml(item.description)}</p>
    <div>${tags.map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>
    ${item.ocr_text ? `<details style="margin-top:10px"><summary>${ocrLabel}</summary><pre style="white-space:pre-wrap">${escapeHtml(item.ocr_text)}</pre></details>` : ''}
    <p style="color:#9ca3af;font-size:0.8rem;margin-top:10px">Source: ${escapeHtml(item.source)} · ${new Date(item.created_at).toLocaleString('fr-CA')}</p>
    ${isFile ? `<a href="/api/files/${item.id}" download="${escapeHtml(item.filename)}"><button>⬇️ Télécharger</button></a>` : ''}
    <button class="delete-btn" data-id="${item.id}">🗑️ Supprimer</button>
  `;
  modalBody.querySelector('.delete-btn').onclick = async () => {
    await fetch(`/api/items/${item.id}`, { method: 'DELETE' });
    closeModal();
    refresh();
  };
  modal.hidden = false;
}

function closeModal() { modal.hidden = true; }
document.getElementById('modal-close').onclick = closeModal;
modal.onclick = (e) => { if (e.target === modal) closeModal(); };

async function refresh() {
  const [items, categories] = await Promise.all([fetchItems(), fetchCategories()]);
  renderGrid(items);
  renderCategories(categories);
}

let searchDebounce;
searchInput.oninput = () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => { searchTerm = searchInput.value; refresh(); }, 300);
};

async function uploadFiles(files) {
  const formData = new FormData();
  for (const f of files) formData.append('file', f);
  await fetch('/api/upload', { method: 'POST', body: formData });
  refresh();
}

uploadInput.onchange = () => uploadFiles(uploadInput.files);

['dragenter', 'dragover'].forEach((evt) =>
  window.addEventListener(evt, (e) => { e.preventDefault(); dropzone.hidden = false; })
);
['dragleave', 'drop'].forEach((evt) =>
  window.addEventListener(evt, (e) => {
    e.preventDefault();
    if (evt === 'drop') {
      const files = e.dataTransfer?.files;
      if (files?.length) uploadFiles(files);
    }
    dropzone.hidden = true;
  })
);

document.getElementById('sync-drive-btn').onclick = async () => {
  const btn = document.getElementById('sync-drive-btn');
  btn.disabled = true;
  btn.textContent = '⏳ ...';
  try {
    const res = await fetch('/api/import/drive', { method: 'POST' });
    const data = await res.json();
    if (data.error) alert(data.error);
    else alert(`${data.imported} fichier(s) importé(s) depuis Drive.`);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Drive';
    refresh();
  }
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');

refresh();
setInterval(refresh, 5000); // pour voir les fichiers importés par le dossier surveillé / Drive en quasi temps réel
