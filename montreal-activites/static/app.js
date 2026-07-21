"use strict";

const CATEGORIES = [
  "Plein air", "Culture", "Musique", "Resto / Bar", "Sport", "Famille",
  "Festival", "Atelier", "Nature", "Nocturne", "Autre",
];
const STATUS_LABEL = { a_faire: "À faire", favori: "Favori", fait: "Fait", archive: "Archivé" };
const CAT_ICON = {
  "Plein air": "🌳", "Culture": "🎨", "Musique": "🎶", "Resto / Bar": "🍽️",
  "Sport": "🏃", "Famille": "👨‍👩‍👧", "Festival": "🎉", "Atelier": "🛠️",
  "Nature": "🍃", "Nocturne": "🌙", "Autre": "📌",
};

const $ = (sel) => document.querySelector(sel);
const state = { activities: [] };

// ---------- Utils ----------
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), 2600);
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

// ---------- Populate selects ----------
function fillCategorySelects() {
  const opts = CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
  $("#a-category").innerHTML = opts;
  $("#f-category").innerHTML = `<option value="">Toutes catégories</option>` + opts;
}

// ---------- Load + render ----------
async function load() {
  const params = new URLSearchParams();
  if ($("#f-search").value.trim()) params.set("search", $("#f-search").value.trim());
  if ($("#f-category").value) params.set("category", $("#f-category").value);
  if ($("#f-status").value) params.set("status", $("#f-status").value);
  const data = await api(`/api/activities?${params.toString()}`);
  state.activities = data.activities;
  renderStats(data.stats);
  renderGrid(data.activities);
}

function renderStats(stats) {
  const s = stats.by_status || {};
  const cells = [
    ["Total", stats.total],
    ["À faire", s.a_faire || 0],
    ["Favoris", s.favori || 0],
    ["Faites", s.fait || 0],
  ];
  $("#statbar").innerHTML = cells
    .map(([lbl, num]) => `<div class="stat"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`)
    .join("");
}

function stars(n) {
  n = Number(n) || 0;
  return n ? `<span class="stars">${"★".repeat(n)}${"☆".repeat(5 - n)}</span>` : "";
}

function renderGrid(items) {
  const grid = $("#grid");
  $("#empty").classList.toggle("hidden", items.length > 0);
  grid.innerHTML = items.map(cardHTML).join("");
}

function cardHTML(a) {
  const icon = CAT_ICON[a.category] || "📌";
  const thumb = a.image_url
    ? `<div class="thumb" style="background-image:url('${esc(a.image_url)}')"></div>`
    : `<div class="thumb">${icon}</div>`;
  const tags = (a.tags || "").split(",").map((t) => t.trim()).filter(Boolean)
    .slice(0, 4).map((t) => `<span class="badge">#${esc(t)}</span>`).join("");
  const meta = [
    a.neighborhood ? `📍 ${esc(a.neighborhood)}` : "",
    a.price ? `💲 ${esc(a.price)}` : "",
    a.start_date ? `📅 ${esc(a.start_date)}` : "",
  ].filter(Boolean).join(" ");
  const src = a.source_url
    ? `<a class="icon-btn" href="${esc(a.source_url)}" target="_blank" rel="noopener">↗ Source</a>` : "";
  return `
  <article class="card">
    ${thumb}
    <div class="body">
      <div class="badges">
        <span class="badge cat">${icon} ${esc(a.category)}</span>
        <span class="badge status-${esc(a.status)}">${STATUS_LABEL[a.status] || a.status}</span>
      </div>
      <h3>${esc(a.title)}</h3>
      ${a.description ? `<p class="desc">${esc(a.description)}</p>` : ""}
      ${meta ? `<div class="meta">${meta}</div>` : ""}
      ${a.author_handle ? `<div class="meta">${esc(a.author_handle)}</div>` : ""}
      ${stars(a.rating)}
      <div class="badges">${tags}</div>
      <div class="actions">
        <button class="icon-btn" data-edit="${a.id}">✎ Éditer</button>
        ${src}
        <button class="icon-btn" data-fav="${a.id}">♥</button>
      </div>
    </div>
  </article>`;
}

// ---------- Modal ----------
const FIELDS = ["id", "title", "description", "category", "neighborhood", "address",
  "price", "start_date", "end_date", "tags", "author_handle", "rating",
  "source_url", "image_url", "notes", "status", "source_platform"];

function openModal(activity) {
  const editing = !!activity;
  $("#modal-title").textContent = editing ? "Modifier l'activité" : "Nouvelle activité";
  FIELDS.forEach((f) => {
    const el = $(`#a-${f}`);
    if (el) el.value = activity ? (activity[f] ?? "") : (f === "rating" ? 0 : "");
  });
  if (!editing) $("#a-status").value = "a_faire";
  $("#btn-delete").classList.toggle("hidden", !editing);
  $("#ig-url").value = "";
  $("#ig-note").textContent = "Respecte les règles de Meta : on n'aspire rien, on lit l'aperçu officiel du lien.";
  $("#modal").classList.remove("hidden");
}

function closeModal() { $("#modal").classList.add("hidden"); }

function collectForm() {
  const data = {};
  FIELDS.forEach((f) => {
    if (f === "id") return;
    const el = $(`#a-${f}`);
    if (el) data[f] = el.value;
  });
  return data;
}

async function saveForm(e) {
  e.preventDefault();
  const data = collectForm();
  if (!data.title.trim()) { toast("Le titre est obligatoire."); return; }
  const id = $("#a-id").value;
  try {
    if (id) {
      await api(`/api/activities/${id}`, { method: "PUT", body: JSON.stringify(data) });
      toast("Fiche mise à jour ✓");
    } else {
      await api("/api/activities", { method: "POST", body: JSON.stringify(data) });
      toast("Activité ajoutée ✓");
    }
    closeModal();
    load();
  } catch (err) { toast(err.message); }
}

async function deleteActivity() {
  const id = $("#a-id").value;
  if (!id) return;
  if (!confirm("Supprimer cette activité ?")) return;
  try {
    await api(`/api/activities/${id}`, { method: "DELETE" });
    toast("Supprimée");
    closeModal();
    load();
  } catch (err) { toast(err.message); }
}

// ---------- Instagram import ----------
async function fetchInstagram() {
  const url = $("#ig-url").value.trim();
  if (!url) { toast("Colle d'abord un lien de post."); return; }
  $("#ig-note").textContent = "Récupération…";
  try {
    const d = await api("/api/instagram/preview", { method: "POST", body: JSON.stringify({ url }) });
    if (d.source_url) $("#a-source_url").value = d.source_url;
    if (d.author_handle) $("#a-author_handle").value = d.author_handle;
    if (d.image_url) $("#a-image_url").value = d.image_url;
    if (d.title && !$("#a-title").value) $("#a-title").value = d.title.slice(0, 120);
    $("#a-source_platform").value = "instagram";
    $("#ig-note").textContent = d.oembed_available
      ? "Aperçu officiel récupéré ✓ Complète et enregistre."
      : (d.note || "Lien enregistré. Complète la fiche à la main.");
    toast("Lien importé");
  } catch (err) {
    $("#ig-note").textContent = err.message;
    toast(err.message);
  }
}

// ---------- Events ----------
function bind() {
  $("#btn-add").addEventListener("click", () => openModal(null));
  $("#btn-import").addEventListener("click", () => { openModal(null); $("#ig-url").focus(); });
  $("#modal-close").addEventListener("click", closeModal);
  $("#btn-cancel").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  $("#form").addEventListener("submit", saveForm);
  $("#btn-delete").addEventListener("click", deleteActivity);
  $("#ig-fetch").addEventListener("click", fetchInstagram);

  let deb;
  $("#f-search").addEventListener("input", () => { clearTimeout(deb); deb = setTimeout(load, 250); });
  $("#f-category").addEventListener("change", load);
  $("#f-status").addEventListener("change", load);
  $("#f-clear").addEventListener("click", () => {
    $("#f-search").value = ""; $("#f-category").value = ""; $("#f-status").value = ""; load();
  });

  $("#grid").addEventListener("click", async (e) => {
    const editId = e.target.getAttribute("data-edit");
    const favId = e.target.getAttribute("data-fav");
    if (editId) {
      const a = state.activities.find((x) => String(x.id) === editId);
      if (a) openModal(a);
    } else if (favId) {
      const a = state.activities.find((x) => String(x.id) === favId);
      if (!a) return;
      const next = a.status === "favori" ? "a_faire" : "favori";
      await api(`/api/activities/${favId}`, { method: "PUT", body: JSON.stringify({ status: next }) });
      load();
    }
  });
}

// ---------- Init ----------
fillCategorySelects();
bind();
load().catch((e) => toast(e.message));
