const grid = document.getElementById('grid');
const categoryList = document.getElementById('category-list');
const listList = document.getElementById('list-list');
const newListForm = document.getElementById('new-list-form');
const newListInput = document.getElementById('new-list-input');
const allListsDatalist = document.getElementById('all-lists-datalist');
const searchInput = document.getElementById('search');
const uploadInput = document.getElementById('upload-input');
const dropzone = document.getElementById('dropzone');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');

let activeCategory = null;
let activeList = null;
let searchTerm = '';

const ICONS = {
  'application/pdf': '📄',
  'text/plain': '📝',
  'text/markdown': '📝',
};

const CONTENT_TYPE_ICONS = {
  youtube: '🎬',
  vimeo: '🎥',
  tiktok: '🎵',
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
  if (activeList) params.set('list', activeList);
  if (searchTerm) params.set('q', searchTerm);
  const res = await fetch(`/api/items?${params}`);
  return res.json();
}

async function fetchCategories() {
  const res = await fetch('/api/categories');
  return res.json();
}

async function fetchLists() {
  const res = await fetch('/api/lists');
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

function renderLists(lists) {
  listList.innerHTML = '';
  allListsDatalist.innerHTML = lists.map((l) => `<option value="${escapeHtml(l.name)}"></option>`).join('');

  if (activeList) {
    const allLi = document.createElement('li');
    allLi.textContent = 'Toutes';
    allLi.onclick = () => { activeList = null; refresh(); };
    listList.appendChild(allLi);
  }

  for (const l of lists) {
    const li = document.createElement('li');
    li.className = activeList === l.id ? 'active' : '';
    li.onclick = () => { activeList = l.id; refresh(); };
    li.innerHTML = `<span>${escapeHtml(l.name)}</span><span class="count">${l.count}</span>`;
    listList.appendChild(li);
  }
}

function renderGrid(items) {
  grid.innerHTML = '';
  for (const item of items) {
    const card = document.createElement('div');
    card.className = `card ${item.status} ${item.is_read ? 'read' : ''}`;
    const icon = iconFor(item);
    card.innerHTML = `
      <div class="thumb">${icon ? icon : `<img src="/api/files/${item.id}" loading="lazy" />`}</div>
      <div class="info">
        <div class="filename">${escapeHtml(item.filename)}</div>
        <span class="category-badge">${escapeHtml(item.category || (item.status === 'pending' ? '⏳ analyse...' : 'sans catégorie'))}</span>
      </div>
    `;
    card.onclick = () => openModal(item, { markAsRead: true });
    grid.appendChild(card);
  }
}

const OCR_LABELS = {
  youtube: 'Transcript complet',
  note: 'Texte original',
};

function renderListChips(item) {
  const lists = JSON.parse(item.lists_json || '[]');
  return lists.map((l) => `<span class="tag list-chip">${escapeHtml(l.name)} <span class="remove-list" data-list-id="${l.id}">✕</span></span>`).join('');
}

function openModal(item, { markAsRead = false } = {}) {
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
    <div class="lists-section">
      <div class="current-lists">${renderListChips(item)}</div>
      <form class="add-to-list-form">
        <input type="text" class="add-to-list-input" list="all-lists-datalist" placeholder="Ajouter à une liste..." />
        <button type="submit">+</button>
      </form>
    </div>
    <div class="modal-actions">
      ${isFile ? `<a href="/api/files/${item.id}" download="${escapeHtml(item.filename)}"><button>⬇️ Télécharger</button></a>` : ''}
      <button class="toggle-read-btn">${item.is_read ? '◻️ Marquer non lu' : '✅ Marquer comme lu'}</button>
      <button class="delete-btn" data-id="${item.id}">🗑️ Supprimer</button>
    </div>
  `;
  modalBody.querySelector('.delete-btn').onclick = async () => {
    await fetch(`/api/items/${item.id}`, { method: 'DELETE' });
    closeModal();
    refresh();
  };
  modalBody.querySelector('.toggle-read-btn').onclick = async () => {
    item.is_read = item.is_read ? 0 : 1;
    await fetch(`/api/items/${item.id}/read`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isRead: !!item.is_read }),
    });
    openModal(item);
    refresh();
  };
  modalBody.querySelectorAll('.remove-list').forEach((el) => {
    el.onclick = async (e) => {
      e.stopPropagation();
      await fetch(`/api/items/${item.id}/lists/${el.dataset.listId}`, { method: 'DELETE' });
      item.lists_json = JSON.stringify(JSON.parse(item.lists_json || '[]').filter((l) => String(l.id) !== el.dataset.listId));
      openModal(item);
      refresh();
    };
  });
  modalBody.querySelector('.add-to-list-form').onsubmit = async (e) => {
    e.preventDefault();
    const input = modalBody.querySelector('.add-to-list-input');
    const name = input.value.trim();
    if (!name) return;
    const list = await (await fetch(`/api/items/${item.id}/lists`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    })).json();
    const existing = JSON.parse(item.lists_json || '[]');
    if (!existing.some((l) => l.id === list.id)) existing.push(list);
    item.lists_json = JSON.stringify(existing);
    openModal(item);
    refresh();
  };

  if (markAsRead && !item.is_read) {
    item.is_read = 1;
    fetch(`/api/items/${item.id}/read`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isRead: true }),
    }).then(refresh);
  }

  modal.hidden = false;
}

function closeModal() { modal.hidden = true; }
document.getElementById('modal-close').onclick = closeModal;
modal.onclick = (e) => { if (e.target === modal) closeModal(); };

async function refresh() {
  const [items, categories, lists] = await Promise.all([fetchItems(), fetchCategories(), fetchLists()]);
  renderGrid(items);
  renderCategories(categories);
  renderLists(lists);
}

newListForm.onsubmit = async (e) => {
  e.preventDefault();
  const name = newListInput.value.trim();
  if (!name) return;
  await fetch('/api/lists', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
  });
  newListInput.value = '';
  refresh();
};

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
