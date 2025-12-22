/**
 * Garage Board App
 *
 * Modes:
 *  - Setter mode (local, e.g. http://localhost:8000): uses localStorage, can create/edit/delete,
 *    can download climbs.json and climb images for publishing to GitHub Pages.
 *  - Viewer mode (hosted, e.g. https://<user>.github.io/<repo>/): loads climbs from climbs.json,
 *    disables/hides editing controls, shows climbs + images on phones.
 */

// ---------- Config ----------
const STORAGE_KEY = "garageBoardClimbs_v2";
const PUBLISHED_JSON_PATH = "climbs.json"; // in repo root
const IMAGES_FOLDER = "climb-images"; // in repo root

// ---------- Helpers ----------
function isLocalDev() {
  return (
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.protocol === "file:"
  );
}

function defaultImagePath(id) {
  return `${IMAGES_FOLDER}/${id}.png`;
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function loadClimbsLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveClimbsLocal(climbs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(climbs));
}

async function loadClimbsPublished() {
  const res = await fetch(PUBLISHED_JSON_PATH, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${PUBLISHED_JSON_PATH}: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("climbs.json is not an array");
  return data;
}

function normalizeClimb(c) {
  const out = { ...c };
  out.id = String(out.id || "");
  out.name = String(out.name || "");
  out.grade = String(out.grade || "");
  out.firstAscent = String(out.firstAscent || "");
  out.createdAt = Number(out.createdAt) || Date.now();

  out.start = Array.isArray(out.start) ? out.start : [];
  out.mid = Array.isArray(out.mid) ? out.mid : [];
  out.finish = Array.isArray(out.finish) ? out.finish : [];
  out.foot = Array.isArray(out.foot) ? out.foot : [];

  out.image = String(out.image || "");
  if (!out.image && out.id) out.image = defaultImagePath(out.id);

  return out;
}

function countMarks(c) {
  return (c.start?.length || 0) + (c.mid?.length || 0) + (c.finish?.length || 0) + (c.foot?.length || 0);
}

// ---------- UI refs ----------
const els = {
  subtitle: document.getElementById("subtitle"),

  homeBtn: document.getElementById("homeBtn"),
  createBtn: document.getElementById("createBtn"),

  homeView: document.getElementById("homeView"),
  createView: document.getElementById("createView"),

  climbList: document.getElementById("climbList"),
  downloadClimbsBtn: document.getElementById("downloadClimbsBtn"),
  exportClimbsBtn: document.getElementById("exportClimbsBtn"),
  clearClimbsBtn: document.getElementById("clearClimbsBtn"),
  climbsExportBox: document.getElementById("climbsExportBox"),

  board: document.getElementById("board"),
  boardImage: document.getElementById("boardImage"),

  editMode: document.getElementById("editMode"),
  typeButtons: Array.from(document.querySelectorAll(".pick")),

  climbName: document.getElementById("climbName"),
  climbGrade: document.getElementById("climbGrade"),
  climbFA: document.getElementById("climbFA"),
  climbImagePath: document.getElementById("climbImagePath"),

  undoBtn: document.getElementById("undoBtn"),
  clearBtn: document.getElementById("clearBtn"),
  downloadImgBtn: document.getElementById("downloadImgBtn"),
  saveBtn: document.getElementById("saveBtn"),

  lightbox: document.getElementById("lightbox"),
  lightboxImg: document.getElementById("lightboxImg"),
  lightboxClose: document.getElementById("lightboxClose"),
};

// ---------- State ----------
const SETTER_MODE = isLocalDev(); // local dev = setter mode; hosted = viewer mode
let climbs = [];
let currentType = "start";

let draft = {
  id: null,
  name: "",
  grade: "",
  firstAscent: "",
  image: "",
  start: [],
  mid: [],
  finish: [],
  foot: [],
  createdAt: null,
};

// ---------- Routing ----------
function setActiveNav(which) {
  els.homeBtn.classList.toggle("active", which === "home");
  els.createBtn.classList.toggle("active", which === "create");
}

function showView(which) {
  const isHome = which === "home";
  els.homeView.classList.toggle("hidden", !isHome);
  els.createView.classList.toggle("hidden", isHome);

  els.subtitle.textContent = isHome ? "Climbs" : "Create climb";
  setActiveNav(which);

  if (isHome) renderHome();
  else els.climbsExportBox.value = "";
}

els.homeBtn.addEventListener("click", () => showView("home"));
els.createBtn.addEventListener("click", () => showView("create"));

// ---------- Lightbox ----------
function openLightbox(src) {
  els.lightboxImg.src = src;
  els.lightbox.classList.remove("hidden");
}
function closeLightbox() {
  els.lightboxImg.src = "";
  els.lightbox.classList.add("hidden");
}
els.lightboxClose.addEventListener("click", closeLightbox);
els.lightbox.addEventListener("click", (e) => {
  if (e.target === els.lightbox) closeLightbox();
});

// ---------- Home render ----------
function renderHome() {
  els.climbList.innerHTML = "";

  if (climbs.length === 0) {
    const empty = document.createElement("div");
    empty.style.color = "rgba(255,255,255,0.65)";
    empty.style.padding = "12px";
    empty.textContent = SETTER_MODE
      ? "No climbs yet. Tap “Create climb” to add your first one."
      : "No climbs found. Make sure climbs.json is published in the repo root.";
    els.climbList.appendChild(empty);
    return;
  }

  const sorted = [...climbs].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  for (const c of sorted) {
    const card = document.createElement("div");
    card.className = "climbCard";

    const top = document.createElement("div");
    top.className = "climbTop";

    const name = document.createElement("div");
    name.className = "climbName";
    name.textContent = c.name || "Unnamed";

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = c.grade || "—";

    top.appendChild(name);
    top.appendChild(badge);

    const meta = document.createElement("div");
    meta.className = "climbMeta";
    meta.textContent = `First ascent: ${c.firstAscent || "—"} • Marks: ${countMarks(c)}`;

    const row = document.createElement("div");
    row.className = "thumbRow";

    if (c.image && c.image.trim()) {
      const thumb = document.createElement("div");
      thumb.className = "thumb";
      const img = document.createElement("img");
      img.src = c.image;
      img.alt = `${c.name || "Climb"} image`;
      img.loading = "lazy";
      thumb.appendChild(img);
      thumb.addEventListener("click", () => openLightbox(c.image));
      row.appendChild(thumb);
    }

    const actions = document.createElement("div");
    actions.className = "smallActions";

    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.textContent = "View on board";
    viewBtn.addEventListener("click", () => {
      showView("create");
      loadClimbIntoEditor(c, { readOnly: true });
    });
    actions.appendChild(viewBtn);

    if (SETTER_MODE) {
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => {
        showView("create");
        loadClimbIntoEditor(c, { readOnly: false });
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => {
        climbs = climbs.filter((x) => x.id !== c.id);
        saveClimbsLocal(climbs);
        renderHome();
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
    }

    row.appendChild(actions);

    card.appendChild(top);
    card.appendChild(meta);
    card.appendChild(row);

    els.climbList.appendChild(card);
  }
}

// ---------- Setter-only buttons ----------
if (els.downloadClimbsBtn) {
  els.downloadClimbsBtn.addEventListener("click", () => {
    const text = JSON.stringify(climbs, null, 2);
    downloadTextFile("climbs.json", text);
  });
}

if (els.exportClimbsBtn) {
  els.exportClimbsBtn.addEventListener("click", () => {
    els.climbsExportBox.value = JSON.stringify(climbs, null, 2);
  });
}

if (els.clearClimbsBtn) {
  els.clearClimbsBtn.addEventListener("click", () => {
    if (!SETTER_MODE) return;

    const ok = confirm("Clear all climbs from this device?");
    if (!ok) return;
    climbs = [];
    saveClimbsLocal(climbs);
    els.climbsExportBox.value = "";
    renderHome();
  });
}

// ---------- Create/editor ----------
function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : `id_${Math.random().toString(16).slice(2)}`;
}

function setEditorReadOnly(readOnly) {
  els.climbName.disabled = readOnly;
  els.climbGrade.disabled = readOnly;
  els.climbFA.disabled = readOnly;
  els.climbImagePath.disabled = readOnly;

  els.editMode.checked = !readOnly;
  els.undoBtn.disabled = readOnly;
  els.clearBtn.disabled = readOnly;
  els.downloadImgBtn.disabled = readOnly;
  els.saveBtn.disabled = readOnly;
  els.typeButtons.forEach((b) => (b.disabled = readOnly));
}

function setType(t) {
  currentType = t;
  els.typeButtons.forEach((b) => b.classList.toggle("active", b.dataset.type === t));
}

els.typeButtons.forEach((b) => b.addEventListener("click", () => setType(b.dataset.type)));
setType("start");

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function boardToNormalized(clientX, clientY) {
  const rect = els.boardImage.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  return { x: clamp01(x), y: clamp01(y) };
}

function clearRenderedMarkers() {
  els.board.querySelectorAll(".hold").forEach((m) => m.remove());
}

function addMarker(type, pt) {
  const marker = document.createElement("div");
  marker.className = `hold ${type}`;
  marker.style.left = `${pt.x * 100}%`;
  marker.style.top = `${pt.y * 100}%`;
  els.board.appendChild(marker);
}

function renderDraft() {
  clearRenderedMarkers();
  for (const pt of draft.start) addMarker("start", pt);
  for (const pt of draft.mid) addMarker("mid", pt);
  for (const pt of draft.finish) addMarker("finish", pt);
  for (const pt of draft.foot) addMarker("foot", pt);
}

function pushPoint(type, pt) {
  const item = { x: Number(pt.x.toFixed(4)), y: Number(pt.y.toFixed(4)) };
  draft[type].push(item);
}

function popLastPoint() {
  if (draft[currentType] && draft[currentType].length > 0) draft[currentType].pop();
}

els.boardImage.addEventListener("click", (e) => {
  if (!els.editMode.checked) return;
  if (!SETTER_MODE) return; // no placement on viewer mode

  const pt = boardToNormalized(e.clientX, e.clientY);

  if (currentType === "start") pushPoint("start", pt);
  if (currentType === "mid") pushPoint("mid", pt);
  if (currentType === "finish") pushPoint("finish", pt);
  if (currentType === "foot") pushPoint("foot", pt);

  renderDraft();
});

els.undoBtn.addEventListener("click", () => {
  if (!els.editMode.checked) return;
  if (!SETTER_MODE) return;
  popLastPoint();
  renderDraft();
});

els.clearBtn.addEventListener("click", () => {
  if (!els.editMode.checked) return;
  if (!SETTER_MODE) return;
  draft.start = [];
  draft.mid = [];
  draft.finish = [];
  draft.foot = [];
  renderDraft();
});

function newDraft() {
  const id = newId();
  draft = {
    id,
    name: "",
    grade: "",
    firstAscent: "",
    image: defaultImagePath(id),
    start: [],
    mid: [],
    finish: [],
    foot: [],
    createdAt: Date.now(),
  };

  els.climbName.value = "";
  els.climbGrade.value = "";
  els.climbFA.value = "";
  els.climbImagePath.value = draft.image;

  els.editMode.checked = true;
  setEditorReadOnly(!SETTER_MODE); // viewer mode always read-only
  setType("start");
  renderDraft();
}

function loadClimbIntoEditor(climb, { readOnly } = { readOnly: true }) {
  draft = normalizeClimb(JSON.parse(JSON.stringify(climb)));

  els.climbName.value = draft.name || "";
  els.climbGrade.value = draft.grade || "";
  els.climbFA.value = draft.firstAscent || "";
  els.climbImagePath.value = draft.image || defaultImagePath(draft.id);

  // In viewer mode, always readonly no matter what.
  setEditorReadOnly(!SETTER_MODE || readOnly);
  renderDraft();
}

// ---------- Image generation (setter mode only) ----------
function colorForType(type) {
  if (type === "start") return "#22c55e";
  if (type === "mid") return "#3b82f6";
  if (type === "finish") return "#ef4444";
  if (type === "foot") return "#ec4899";
  return "#ffffff";
}

function drawOutlinedCircle(ctx, x, y, color) {
  const r = 13;
  const lineW = 3;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = lineW + 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.stroke();

  ctx.restore();
}

async function makeClimbCanvas() {
  const img = els.boardImage;
  if (!img.complete) {
    await new Promise((resolve) => img.addEventListener("load", resolve, { once: true }));
  }

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const drawList = (type, arr) => {
    for (const pt of arr || []) {
      const x = pt.x * canvas.width;
      const y = pt.y * canvas.height;
      drawOutlinedCircle(ctx, x, y, colorForType(type));
    }
  };

  drawList("start", draft.start);
  drawList("mid", draft.mid);
  drawList("finish", draft.finish);
  drawList("foot", draft.foot);

  return canvas;
}

async function downloadClimbImage() {
  if (!SETTER_MODE) return;

  const canvas = await makeClimbCanvas();
  const filename = `${draft.id}.png`; // matches climb-images/<id>.png

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}

els.downloadImgBtn.addEventListener("click", () => {
  if (!SETTER_MODE) return;
  downloadClimbImage().catch(console.error);
});

// ---------- Save (setter mode only) ----------
els.saveBtn.addEventListener("click", () => {
  if (!SETTER_MODE) return;

  const name = (els.climbName.value || "").trim();
  const grade = (els.climbGrade.value || "").trim();
  const firstAscent = (els.climbFA.value || "").trim();
  const imagePath =
    (els.climbImagePath.value || "").trim() || defaultImagePath(draft.id);

  if (!name) {
    alert("Please enter a name.");
    return;
  }
  if (draft.start.length === 0) {
    alert("Please place at least one START hold.");
    return;
  }
  if (draft.finish.length === 0) {
    alert("Please place at least one FINISH hold.");
    return;
  }

  draft.name = name;
  draft.grade = grade;
  draft.firstAscent = firstAscent;
  draft.image = imagePath;

  const idx = climbs.findIndex((c) => c.id === draft.id);
  if (idx >= 0) climbs[idx] = draft;
  else climbs.push(draft);

  // Persist locally only (you publish via climbs.json)
  saveClimbsLocal(climbs);

  showView("home");
  newDraft();
});

// ---------- Boot ----------
function applyModeUI() {
  // In viewer mode, hide setter-only controls
  if (!SETTER_MODE) {
    // Hide create nav button + force home
    els.createBtn.style.display = "none";

    // Hide setter-only buttons
    if (els.downloadClimbsBtn) els.downloadClimbsBtn.style.display = "none";
    if (els.exportClimbsBtn) els.exportClimbsBtn.style.display = "none";
    if (els.clearClimbsBtn) els.clearClimbsBtn.style.display = "none";
    if (els.climbsExportBox) els.climbsExportBox.style.display = "none";
  }
}

function ensureExampleIfEmptyLocal() {
  if (climbs.length > 0) return;

  const id = "p001";
  climbs = [
    {
      id,
      name: "Example: Warmup",
      grade: "V2",
      firstAscent: "You",
      image: defaultImagePath(id),
      start: [{ x: 0.25, y: 0.2 }],
      mid: [{ x: 0.55, y: 0.45 }],
      finish: [{ x: 0.75, y: 0.3 }],
      foot: [{ x: 0.3, y: 0.75 }],
      createdAt: Date.now(),
    },
  ];

  saveClimbsLocal(climbs);
}

(async function boot() {
  applyModeUI();

  if (SETTER_MODE) {
    climbs = loadClimbsLocal().map(normalizeClimb);
    ensureExampleIfEmptyLocal();
    climbs = loadClimbsLocal().map(normalizeClimb);
    saveClimbsLocal(climbs); // normalize persisted
  } else {
    try {
      climbs = (await loadClimbsPublished()).map(normalizeClimb);
    } catch (e) {
      console.error(e);
      climbs = [];
    }
  }

  renderHome();
  newDraft();
  showView("home");
})();
