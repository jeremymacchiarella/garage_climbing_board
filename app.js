// ---------- Storage ----------
const STORAGE_KEY = "garageBoardClimbs_v2"; // includes foot + image path

function loadClimbs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveClimbs(climbs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(climbs));
}

// ---------- Helpers ----------
function defaultImagePath(id) {
  // Predictable path you’ll commit to GitHub Pages
  return `climb-images/${id}.png`;
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

let climbs = loadClimbs();

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

// ---------- Home ----------
function countMarks(c) {
  return (c.start?.length || 0) + (c.mid?.length || 0) + (c.finish?.length || 0) + (c.foot?.length || 0);
}

function normalizeClimb(c) {
  // Helps when older climbs exist (no foot/image)
  const out = { ...c };
  out.start = Array.isArray(out.start) ? out.start : [];
  out.mid = Array.isArray(out.mid) ? out.mid : [];
  out.finish = Array.isArray(out.finish) ? out.finish : [];
  out.foot = Array.isArray(out.foot) ? out.foot : [];
  out.id = String(out.id || "");
  out.image = String(out.image || "");
  out.createdAt = Number(out.createdAt) || Date.now();

  // If missing image but has id, auto-fill (non-destructive)
  if (!out.image && out.id) out.image = defaultImagePath(out.id);

  return out;
}

function renderHome() {
  // Normalize + persist once (so your JSON is consistent)
  const normalized = climbs.map(normalizeClimb);
  const changed = JSON.stringify(normalized) !== JSON.stringify(climbs);
  climbs = normalized;
  if (changed) saveClimbs(climbs);

  els.climbList.innerHTML = "";

  if (climbs.length === 0) {
    const empty = document.createElement("div");
    empty.style.color = "rgba(255,255,255,0.65)";
    empty.style.padding = "12px";
    empty.textContent = "No climbs yet. Tap “Create climb” to add your first one.";
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

    // Thumbnail if image exists
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
      saveClimbs(climbs);
      renderHome();
    });

    actions.appendChild(viewBtn);
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    row.appendChild(actions);

    card.appendChild(top);
    card.appendChild(meta);
    card.appendChild(row);

    els.climbList.appendChild(card);
  }
}

// Download climbs.json (real file)
els.downloadClimbsBtn.addEventListener("click", () => {
  const filename = "climbs.json";
  const text = JSON.stringify(climbs, null, 2);
  downloadTextFile(filename, text);
});

// Keep export box as well (optional convenience)
els.exportClimbsBtn.addEventListener("click", () => {
  els.climbsExportBox.value = JSON.stringify(climbs, null, 2);
});

els.clearClimbsBtn.addEventListener("click", () => {
  const ok = confirm("Clear all climbs from this device?");
  if (!ok) return;
  climbs = [];
  saveClimbs(climbs);
  els.climbsExportBox.value = "";
  renderHome();
});

// ---------- Create climb ----------
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

function newId() {
  return (crypto.randomUUID ? crypto.randomUUID() : `id_${Math.random().toString(16).slice(2)}`);
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

function newDraft() {
  const id = newId();
  draft = {
    id,
    name: "",
    grade: "",
    firstAscent: "",
    image: defaultImagePath(id), // ✅ auto-filled
    start: [],
    mid: [],
    finish: [],
    foot: [],
    createdAt: Date.now(),
  };

  els.climbName.value = "";
  els.climbGrade.value = "";
  els.climbFA.value = "";
  els.climbImagePath.value = draft.image; // ✅ auto-filled input
  els.editMode.checked = true;

  setEditorReadOnly(false);
  setType("start");
  renderDraft();
}

function setType(t) {
  currentType = t;
  els.typeButtons.forEach((b) => {
    b.classList.toggle("active", b.dataset.type === t);
  });
}

els.typeButtons.forEach((b) => {
  b.addEventListener("click", () => setType(b.dataset.type));
});
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
  if (draft[currentType] && draft[currentType].length > 0) {
    draft[currentType].pop();
  }
}

els.boardImage.addEventListener("click", (e) => {
  if (!els.editMode.checked) return;

  const pt = boardToNormalized(e.clientX, e.clientY);

  if (currentType === "start") pushPoint("start", pt);
  if (currentType === "mid") pushPoint("mid", pt);
  if (currentType === "finish") pushPoint("finish", pt);
  if (currentType === "foot") pushPoint("foot", pt);

  renderDraft();
});

els.undoBtn.addEventListener("click", () => {
  if (!els.editMode.checked) return;
  popLastPoint();
  renderDraft();
});

els.clearBtn.addEventListener("click", () => {
  if (!els.editMode.checked) return;
  draft.start = [];
  draft.mid = [];
  draft.finish = [];
  draft.foot = [];
  renderDraft();
});

function loadClimbIntoEditor(climb, { readOnly } = { readOnly: false }) {
  draft = normalizeClimb(JSON.parse(JSON.stringify(climb)));

  // ✅ auto-fill image path if missing
  if (!draft.image && draft.id) draft.image = defaultImagePath(draft.id);

  els.climbName.value = draft.name || "";
  els.climbGrade.value = draft.grade || "";
  els.climbFA.value = draft.firstAscent || "";
  els.climbImagePath.value = draft.image || "";

  setEditorReadOnly(readOnly);
  renderDraft();
}

// ---------- Image generation ----------
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
  const canvas = await makeClimbCanvas();
  const filename = `${draft.id}.png`; // ✅ matches defaultImagePath()

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
  downloadClimbImage().catch(console.error);
});

// ---------- Save ----------
els.saveBtn.addEventListener("click", () => {
  const name = (els.climbName.value || "").trim();
  const grade = (els.climbGrade.value || "").trim();
  const firstAscent = (els.climbFA.value || "").trim();

  // image path can be overridden, but defaults are auto
  const imagePath = (els.climbImagePath.value || "").trim() || defaultImagePath(draft.id);

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

  // upsert
  const idx = climbs.findIndex((c) => c.id === draft.id);
  if (idx >= 0) climbs[idx] = draft;
  else climbs.push(draft);

  saveClimbs(climbs);

  showView("home");
  newDraft();
});

// ---------- Boot ----------
function ensureExampleIfEmpty() {
  if (climbs.length > 0) return;

  const id = "p001";
  climbs = [
    {
      id,
      name: "Example: Warmup",
      grade: "V2",
      firstAscent: "You",
      image: defaultImagePath(id),
      start: [{ x: 0.25, y: 0.20 }],
      mid: [{ x: 0.55, y: 0.45 }],
      finish: [{ x: 0.75, y: 0.30 }],
      foot: [{ x: 0.30, y: 0.75 }],
      createdAt: Date.now(),
    },
  ];
  saveClimbs(climbs);
}

ensureExampleIfEmpty();
renderHome();
newDraft();
showView("home");
