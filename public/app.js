// Microclime — Phase 1: real sun-hours engine.
//
// Combines actual solar-position astronomy (solar.js) with a user-traced
// horizon photo to compute, hour by hour, whether one specific spot is in
// sun or in shade. Everything here is real computation — no AI call yet.

const STORAGE_KEY = "microclime.v1";
const BUCKETS = 96; // resolution of the traced horizon across the photo width
const VERTICAL_FOV = 45; // assumed vertical field of view of a phone photo, degrees

function defaultState() {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  return {
    lat: null,
    lon: null,
    date: iso,
    heading: 180,
    fov: 60,
    log: [], // calibration observations: { date, observedC, predictedC, frost }
    spots: [], // saved zones: { id, name, lat, lon, trace, heading, fov }
    seenIntro: false,
  };
}

function cToF(c) {
  return (c * 9) / 5 + 32;
}
function fToC(f) {
  return ((f - 32) * 5) / 9;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

// Trace is session-only (not persisted): an array of length BUCKETS holding
// a y-fraction (0=top of photo, 1=bottom) or null where untouched.
let trace = new Array(BUCKETS).fill(null);
let photoImg = null;

const el = (id) => document.getElementById(id);

const latInput = el("lat-input");
const lonInput = el("lon-input");
const dateInput = el("date-input");
const useLocationBtn = el("use-location-btn");
const locationStatus = el("location-status");
const takePhotoBtn = el("take-photo-btn");
const uploadPhotoBtn = el("upload-photo-btn");
const cameraInput = el("camera-input");
const fileInput = el("file-input");
const cameraModal = el("camera-modal");
const cameraVideo = el("camera-video");
const cameraStatus = el("camera-status");
const cameraClose = el("camera-close");
const cameraCancelBtn = el("camera-cancel-btn");
const cameraCaptureBtn = el("camera-capture-btn");
const canvasWrap = el("canvas-wrap");
const canvas = el("trace-canvas");
const ctx = canvas.getContext("2d");
const headingRow = el("heading-row");
const headingInput = el("heading-input");
const fovInput = el("fov-input");
const clearTraceBtn = el("clear-trace-btn");
const resultsPanel = el("results-panel");
const resultsSummary = el("results-summary");
const weatherStatus = el("weather-status");
const riskSummary = el("risk-summary");
const plantCare = el("plant-care");
const plantCareBadge = el("plant-care-badge");
const plantCareRule = el("plant-care-rule");
const plantUseHorizonBtn = el("plant-use-horizon-btn");
const plantTakePhotoBtn = el("plant-take-photo-btn");
const plantUploadPhotoBtn = el("plant-upload-photo-btn");
const plantCameraInput = el("plant-camera-input");
const plantFileInput = el("plant-file-input");
const plantAnalysisResult = el("plant-analysis-result");
const summarizeBtn = el("summarize-btn");
const summarizeRow = el("summarize-row");
const aiSummary = el("ai-summary");
const hourStrip = el("hour-strip");
const hourTableBody = el("hour-table-body");
const calibratePanel = el("calibrate-panel");
const observedTempInput = el("observed-temp-input");
const observedFrostInput = el("observed-frost-input");
const saveObservationBtn = el("save-observation-btn");
const calibrationStatus = el("calibration-status");
const calibrationLogEl = el("calibration-log");
const whatifRow = el("whatif-row");
const saveBaselineBtn = el("save-baseline-btn");
const resetBaselineBtn = el("reset-baseline-btn");
const whatifPanel = el("whatif-panel");
const whatifCompare = el("whatif-compare");
const saveSpotRow = el("save-spot-row");
const spotNameInput = el("spot-name-input");
const saveSpotBtn = el("save-spot-btn");
const spotsPanel = el("spots-panel");
const spotsList = el("spots-list");
const communityPanel = el("community-panel");
const communityMap = el("community-map");
const howItWorksBtn = el("how-it-works-btn");
const resetDataBtn = el("reset-data-btn");
const introModal = el("intro-modal");
const introClose = el("intro-close");
const introStartBtn = el("intro-start-btn");

let currentRows = [];
let currentSunHours = 0;
let currentFrostHours = 0;
let currentHeatHours = 0;

// Phase 4 — what-if simulation. The baseline is a session-only snapshot of
// the horizon "as it really is right now" (trace + heading + fov). Once
// saved, further edits to the live trace are a hypothetical — plant a tree,
// trim one back — and every recompute shows both real and hypothetical
// side by side instead of just overwriting the real picture.
let baseline = null; // { trace, heading, fov } or null

function initInputs() {
  latInput.value = state.lat ?? "";
  lonInput.value = state.lon ?? "";
  dateInput.value = state.date;
  headingInput.value = state.heading;
  fovInput.value = state.fov;
}

function hasLocation() {
  return typeof state.lat === "number" && typeof state.lon === "number" && !Number.isNaN(state.lat) && !Number.isNaN(state.lon);
}

// --- Location ---

latInput.addEventListener("input", () => {
  state.lat = latInput.value.trim() === "" ? null : parseFloat(latInput.value);
  saveState();
  recompute();
});
lonInput.addEventListener("input", () => {
  state.lon = lonInput.value.trim() === "" ? null : parseFloat(lonInput.value);
  saveState();
  recompute();
});
dateInput.addEventListener("change", () => {
  state.date = dateInput.value;
  saveState();
  recompute();
});

useLocationBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    locationStatus.textContent = "Geolocation isn't available in this browser — enter coordinates manually.";
    return;
  }
  locationStatus.textContent = "Locating…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.lat = Math.round(pos.coords.latitude * 10000) / 10000;
      state.lon = Math.round(pos.coords.longitude * 10000) / 10000;
      initInputs();
      saveState();
      locationStatus.textContent = "Location set from your device.";
      recompute();
    },
    (err) => {
      locationStatus.textContent = `Couldn't get your location (${err.message}). Enter coordinates manually.`;
    }
  );
});

// --- Photo + horizon tracing ---

// "Take a photo" opens a real in-browser camera (works on laptops, where a
// file input's `capture` attribute is only a mobile hint and desktop
// browsers just show the ordinary file picker instead of the webcam). Falls
// back to the file-input capture flow if getUserMedia isn't available.
let cameraStream = null;
let cameraTarget = "horizon"; // "horizon" or "plant" — which flow the capture feeds into

async function openCameraModal(target, fallbackInput) {
  cameraTarget = target;
  cameraModal.hidden = false;
  cameraCaptureBtn.hidden = true;
  cameraStatus.textContent = "Starting your camera…";
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    cameraVideo.srcObject = cameraStream;
    cameraStatus.textContent =
      target === "plant"
        ? "Frame the plant clearly, then capture."
        : "Hold your phone or laptop level, point it at the horizon, then capture.";
    cameraCaptureBtn.hidden = false;
  } catch (err) {
    cameraModal.hidden = true;
    fallbackInput.click(); // fall back to the OS-level capture/upload picker
  }
}

function closeCameraModal() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  cameraVideo.srcObject = null;
  cameraModal.hidden = true;
}

function captureFromVideo() {
  const w = cameraVideo.videoWidth;
  const h = cameraVideo.videoHeight;
  if (!w || !h) return;
  const shot = document.createElement("canvas");
  shot.width = w;
  shot.height = h;
  shot.getContext("2d").drawImage(cameraVideo, 0, 0, w, h);
  const img = new Image();
  img.onload = () => {
    const target = cameraTarget;
    closeCameraModal();
    if (target === "plant") {
      handlePlantPhoto(img);
    } else if (target === "placement") {
      runPlacementLookup({ imageDataUrl: downscaleImage(img, 768) });
    } else {
      applyPhoto(img);
      tryLocationFromDevice(
        "Location set automatically from your device.",
        "Couldn't detect your location automatically — enter it above."
      );
    }
  };
  img.src = shot.toDataURL("image/jpeg", 0.92);
}

takePhotoBtn.addEventListener("click", () => openCameraModal("horizon", cameraInput));
cameraClose.addEventListener("click", closeCameraModal);
cameraCancelBtn.addEventListener("click", closeCameraModal);
cameraCaptureBtn.addEventListener("click", captureFromVideo);

uploadPhotoBtn.addEventListener("click", () => fileInput.click());
cameraInput.addEventListener("change", () => loadPhotoFrom(cameraInput));
fileInput.addEventListener("change", () => loadPhotoFrom(fileInput));

function applyPhoto(img) {
  photoImg = img;
  trace = new Array(BUCKETS).fill(null);
  const wrapWidth = canvasWrap.clientWidth || 640;
  canvas.width = wrapWidth;
  canvas.height = Math.round((wrapWidth * img.height) / img.width);
  canvasWrap.hidden = false;
  headingRow.hidden = false;
  whatifRow.hidden = false;
  saveSpotRow.hidden = false;
  baseline = null;
  resetBaselineBtn.hidden = true;
  saveBaselineBtn.textContent = 'Save as "how it is now"';
  drawCanvas();
  recompute();
}

// --- Auto-location: try the photo first, then the device, before asking ---

function setDetectedLocation(lat, lon, message) {
  state.lat = Math.round(lat * 10000) / 10000;
  state.lon = Math.round(lon * 10000) / 10000;
  initInputs();
  saveState();
  locationStatus.textContent = message;
  recompute();
}

function tryLocationFromDevice(successMessage, failMessage) {
  if (!navigator.geolocation) {
    locationStatus.textContent = failMessage;
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => setDetectedLocation(pos.coords.latitude, pos.coords.longitude, successMessage),
    () => { locationStatus.textContent = failMessage; }
  );
}

async function tryLocationFromFile(file) {
  try {
    const buf = await file.arrayBuffer();
    const gps = Exif.readGPS(buf);
    if (gps) {
      setDetectedLocation(gps.lat, gps.lon, "Location detected from your photo.");
      return;
    }
  } catch {
    // fall through to the "couldn't find it" message below
  }
  locationStatus.textContent = "Couldn't find location data in that photo — enter your location above.";
}

function loadPhotoFrom(input) {
  const file = input.files?.[0];
  if (!file) return;
  tryLocationFromFile(file);
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => applyPhoto(img);
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

let tracing = false;

function bucketFromEvent(evt) {
  const rect = canvas.getBoundingClientRect();
  const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
  const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
  const xFrac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  const yFrac = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
  const bucket = Math.min(BUCKETS - 1, Math.max(0, Math.floor(xFrac * BUCKETS)));
  return { bucket, yFrac };
}

function paintTraceAt(evt) {
  const { bucket, yFrac } = bucketFromEvent(evt);
  trace[bucket] = yFrac;
  drawCanvas();
}

canvas.addEventListener("pointerdown", (e) => {
  tracing = true;
  paintTraceAt(e);
});
canvas.addEventListener("pointermove", (e) => {
  if (tracing) paintTraceAt(e);
});
window.addEventListener("pointerup", () => {
  if (tracing) {
    tracing = false;
    recompute();
  }
});

clearTraceBtn.addEventListener("click", () => {
  trace = new Array(BUCKETS).fill(null);
  drawCanvas();
  recompute();
});

saveBaselineBtn.addEventListener("click", () => {
  baseline = { trace: trace.slice(), heading: state.heading, fov: state.fov };
  resetBaselineBtn.hidden = false;
  saveBaselineBtn.textContent = 'Update "how it is now"';
  recompute();
});

resetBaselineBtn.addEventListener("click", () => {
  if (!baseline) return;
  trace = baseline.trace.slice();
  state.heading = baseline.heading;
  state.fov = baseline.fov;
  initInputs();
  saveState();
  drawCanvas();
  recompute();
});

// --- Saved spots (Phase 5) ---
//
// A named snapshot of a traced horizon (trace + heading + fov + location),
// persisted so multiple spots in the same yard can be compared side by
// side. The photo itself isn't saved (too large for localStorage) — only
// the traced horizon, which is all the math actually needs.

// Computes one saved spot's real sun-hours for the currently selected date,
// using that spot's own saved location (falling back to the working
// location if the spot predates location tracking). Returns null if no
// location is available for it at all.
function computeSpotSunHours(spot) {
  const lat = typeof spot.lat === "number" ? spot.lat : state.lat;
  const lon = typeof spot.lon === "number" ? spot.lon : state.lon;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  const [y, m, d] = (state.date || defaultState().date).split("-").map(Number);
  const dense = resolveSparseTrace(spot.trace);
  const { sunHours } = computeSunRows(dense, spot.heading, spot.fov, lat, lon, y, m, d);
  return sunHours;
}

function renderSpots() {
  if (state.spots.length === 0) {
    spotsPanel.hidden = true;
    return;
  }
  spotsPanel.hidden = false;
  const [y, m, d] = (state.date || defaultState().date).split("-").map(Number);

  spotsList.innerHTML = state.spots
    .map((spot) => {
      const lat = typeof spot.lat === "number" ? spot.lat : state.lat;
      const lon = typeof spot.lon === "number" ? spot.lon : state.lon;
      if (typeof lat !== "number" || typeof lon !== "number") {
        return `<div class="spot-card" data-spot-id="${spot.id}">
          <div class="spot-info">
            <span class="spot-name">${spot.name}</span>
            <div class="spot-suggestion">No location saved for this spot — set a location above and reload it to compute sun-hours.</div>
          </div>
          <div class="spot-actions">
            <button class="btn-secondary spot-load-btn" type="button">Load</button>
            <button class="btn-secondary spot-delete-btn" type="button">Delete</button>
          </div>
        </div>`;
      }
      const dense = resolveSparseTrace(spot.trace);
      const { sunHours } = computeSunRows(dense, spot.heading, spot.fov, lat, lon, y, m, d);
      const zone = Zones.classify(sunHours);
      const zoneClass = zone.label === "Full sun" ? "full-sun" : zone.label === "Partial sun" ? "partial-sun" : "mostly-shade";
      return `<div class="spot-card" data-spot-id="${spot.id}">
        <div class="spot-info">
          <span class="spot-name">${spot.name}</span>
          <span class="spot-zone ${zoneClass}">${zone.label} — ${sunHours}h</span>
          <div class="spot-suggestion">${zone.suggestion}</div>
        </div>
        <div class="spot-actions">
          <button class="btn-secondary spot-load-btn" type="button">Load</button>
          <button class="btn-secondary spot-delete-btn" type="button">Delete</button>
        </div>
      </div>`;
    })
    .join("");
}

saveSpotBtn.addEventListener("click", () => {
  if (!resolvedTrace()) {
    calibrationStatus.textContent = "Trace the horizon in the photo above before saving this spot.";
    return;
  }
  const name = spotNameInput.value.trim() || `Spot ${state.spots.length + 1}`;
  state.spots.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    lat: state.lat,
    lon: state.lon,
    trace: trace.slice(),
    heading: state.heading,
    fov: state.fov,
  });
  saveState();
  spotNameInput.value = "";
  renderSpots();
});

spotsList.addEventListener("click", (e) => {
  const card = e.target.closest(".spot-card");
  if (!card) return;
  const id = card.dataset.spotId;
  const spot = state.spots.find((s) => s.id === id);
  if (!spot) return;

  if (e.target.classList.contains("spot-load-btn")) {
    photoImg = null; // the original photo isn't saved — just the traced line
    trace = spot.trace.slice();
    state.heading = spot.heading;
    state.fov = spot.fov;
    if (typeof spot.lat === "number") state.lat = spot.lat;
    if (typeof spot.lon === "number") state.lon = spot.lon;
    initInputs();
    saveState();
    canvas.width = canvasWrap.clientWidth || 640;
    canvas.height = Math.round(canvas.width * 0.625);
    canvasWrap.hidden = false;
    headingRow.hidden = false;
    whatifRow.hidden = false;
    saveSpotRow.hidden = false;
    spotNameInput.value = spot.name;
    baseline = null;
    resetBaselineBtn.hidden = true;
    saveBaselineBtn.textContent = 'Save as "how it is now"';
    drawCanvas();
    recompute();
  } else if (e.target.classList.contains("spot-delete-btn")) {
    state.spots = state.spots.filter((s) => s.id !== id);
    saveState();
    renderSpots();
  }
});

// --- Where should I plant this? ---
//
// Identifies a plant's general sun-need range (AI, textbook knowledge only —
// see api/plant-placement.js) and ranks it against every saved spot's REAL
// computed sun-hours for the current date. The AI never sees or touches the
// spot data; the ranking itself is plain deterministic comparison.

const placementNameInput = el("placement-name-input");
const placementFindBtn = el("placement-find-btn");
const placementTakePhotoBtn = el("placement-take-photo-btn");
const placementUploadPhotoBtn = el("placement-upload-photo-btn");
const placementCameraInput = el("placement-camera-input");
const placementFileInput = el("placement-file-input");
const placementResult = el("placement-result");

async function runPlacementLookup(payload) {
  placementResult.innerHTML = `<p class="plant-analysis-status">Looking up its sun needs…</p>`;
  try {
    const res = await fetch("/api/plant-placement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      placementResult.innerHTML = `<p class="plant-analysis-status error">Couldn't look that up (${data.error || res.status}).</p>`;
      return;
    }
    renderPlacementResult(data.plant, data.mode);
  } catch (err) {
    placementResult.innerHTML = `<p class="plant-analysis-status error">Couldn't reach the lookup service right now.</p>`;
  }
}

function renderPlacementResult(plant, mode) {
  if (!plant || typeof plant.idealSunHoursMin !== "number" || typeof plant.idealSunHoursMax !== "number") {
    placementResult.innerHTML = `<p class="plant-analysis-status error">Couldn't determine a sun-need range for that.</p>`;
    return;
  }

  const rankable = state.spots
    .map((spot) => ({ spot, sunHours: computeSpotSunHours(spot) }))
    .filter((r) => r.sunHours !== null);

  const plantCardHtml = `<div class="placement-plant-card">
    <span class="placement-species">${plant.species || "Unknown plant"}</span>
    ${mode === "demo" ? ' <span class="plant-analysis-status">(demo mode)</span>' : ""}
    — wants <span class="placement-range">${plant.idealSunHoursMin}-${plant.idealSunHoursMax} hours</span> of direct sun.
    ${plant.notes ? `<p>${plant.notes}</p>` : ""}
  </div>`;

  if (rankable.length === 0) {
    placementResult.innerHTML = plantCardHtml + `<p class="plant-analysis-status">Save at least one spot above to see how it stacks up.</p>`;
    return;
  }

  const ranked = rankable
    .map((r) => {
      const { sunHours } = r;
      let distance, verdict;
      if (sunHours >= plant.idealSunHoursMin && sunHours <= plant.idealSunHoursMax) {
        distance = 0;
        verdict = "Right in its sweet spot";
      } else if (sunHours < plant.idealSunHoursMin) {
        distance = plant.idealSunHoursMin - sunHours;
        verdict = `Falls short — needs ${plant.idealSunHoursMin}-${plant.idealSunHoursMax}h, gets ${sunHours}h`;
      } else {
        distance = sunHours - plant.idealSunHoursMax;
        verdict = `More sun than it needs — could mean extra water in the heat`;
      }
      return { ...r, distance, verdict };
    })
    .sort((a, b) => a.distance - b.distance || b.sunHours - a.sunHours);

  const medals = ["Best", "2nd", "3rd"];
  const rankingHtml = ranked
    .map((r, i) => {
      const medal = medals[i] || `${i + 1}th`;
      const bestClass = i === 0 ? " best" : "";
      return `<div class="placement-rank${bestClass}">
        <span class="placement-rank-medal">${medal}</span>
        <div class="placement-rank-info">
          <div class="placement-rank-name">${r.spot.name}</div>
          <div class="placement-rank-verdict">${r.verdict}</div>
        </div>
        <span class="placement-rank-hours">${r.sunHours}h</span>
      </div>`;
    })
    .join("");

  placementResult.innerHTML = plantCardHtml + `<div class="placement-ranking">${rankingHtml}</div>`;
}

placementFindBtn.addEventListener("click", () => {
  const name = placementNameInput.value.trim();
  if (!name) {
    placementResult.innerHTML = `<p class="plant-analysis-status error">Type a plant name first, or use a photo instead.</p>`;
    return;
  }
  runPlacementLookup({ plantName: name });
});

placementTakePhotoBtn.addEventListener("click", () => openCameraModal("placement", placementCameraInput));
placementUploadPhotoBtn.addEventListener("click", () => placementFileInput.click());

function loadPlacementPhotoFrom(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => runPlacementLookup({ imageDataUrl: downscaleImage(img, 768) });
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
placementCameraInput.addEventListener("change", () => loadPlacementPhotoFrom(placementCameraInput));
placementFileInput.addEventListener("change", () => loadPlacementPhotoFrom(placementFileInput));

headingInput.addEventListener("input", () => {
  state.heading = ((parseInt(headingInput.value, 10) || 0) % 360 + 360) % 360;
  saveState();
  recompute();
});
fovInput.addEventListener("input", () => {
  state.fov = Math.min(120, Math.max(20, parseInt(fovInput.value, 10) || 60));
  saveState();
  recompute();
});

// Resolves the live in-progress trace (gaps filled by linear interpolation
// between nearest set buckets, flat-extrapolated past the outer ones — see
// resolveSparseTrace). Returns null if nothing has been traced yet.
function resolvedTrace() {
  return resolveSparseTrace(trace);
}

function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (photoImg) {
    ctx.drawImage(photoImg, 0, 0, canvas.width, canvas.height);
  } else {
    // No photo loaded (e.g. a saved spot reopened without its original
    // photo) — still show the traced horizon line on a neutral background.
    ctx.fillStyle = "#fbf1e6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const dense = resolvedTrace();
  if (!dense) return;

  ctx.beginPath();
  ctx.strokeStyle = "#e8794f";
  ctx.lineWidth = 3;
  for (let i = 0; i < BUCKETS; i++) {
    const x = ((i + 0.5) / BUCKETS) * canvas.width;
    const y = dense[i] * canvas.height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "rgba(43,31,34,0.3)";
  ctx.setLineDash([4, 4]);
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

// --- Blocked-elevation lookup ---

function angleDiff(a, b) {
  let d = ((a - b + 180) % 360 + 360) % 360 - 180;
  return d;
}

// Returns the blocked elevation (degrees) at a given compass azimuth for an
// arbitrary dense trace/heading/fov, or null if that azimuth wasn't covered.
function blockedElevationFor(azimuthDeg, dense, heading, fov) {
  if (!dense) return 0; // no trace yet: assume open horizon
  const rel = angleDiff(azimuthDeg, heading);
  if (Math.abs(rel) > fov / 2) return null;
  const xFrac = 0.5 + rel / fov;
  const pos = Math.min(BUCKETS - 1, Math.max(0, xFrac * BUCKETS - 0.5));
  const i0 = Math.floor(pos);
  const i1 = Math.min(BUCKETS - 1, i0 + 1);
  const t = pos - i0;
  const yFrac = dense[i0] + (dense[i1] - dense[i0]) * t;
  return VERTICAL_FOV / 2 - yFrac * VERTICAL_FOV;
}

// Fills gaps the same way resolvedTrace() does, for an arbitrary sparse
// trace array (used to resolve a saved baseline independently of the live
// in-progress trace).
function resolveSparseTrace(sparse) {
  const setIdx = [];
  for (let i = 0; i < BUCKETS; i++) if (sparse[i] !== null) setIdx.push(i);
  if (setIdx.length === 0) return null;
  const dense = new Array(BUCKETS);
  for (let i = 0; i < BUCKETS; i++) {
    if (sparse[i] !== null) { dense[i] = sparse[i]; continue; }
    let lo = null, hi = null;
    for (const j of setIdx) {
      if (j < i) lo = j;
      if (j > i && hi === null) hi = j;
    }
    if (lo === null) dense[i] = sparse[hi];
    else if (hi === null) dense[i] = sparse[lo];
    else dense[i] = sparse[lo] + ((sparse[hi] - sparse[lo]) * (i - lo)) / (hi - lo);
  }
  return dense;
}

// Computes hour-by-hour sun/shade rows for an arbitrary horizon (used for
// the live trace, a saved baseline, and each saved spot — each with its own
// coordinates, since a spot's saved location shouldn't shift if the
// currently-loaded working location changes).
function computeSunRows(denseTrace, heading, fov, lat, lon, y, m, d) {
  const rows = [];
  let sunHours = 0;
  for (let h = 0; h < 24; h++) {
    const { elevation, azimuth } = Solar.positionAtLocalHour(y, m, d, h, lat, lon);
    let status;
    if (elevation <= 0) {
      status = "night";
    } else {
      const blocked = blockedElevationFor(azimuth, denseTrace, heading, fov);
      if (blocked === null) status = "no-data";
      else if (elevation > blocked) { status = "sun"; sunHours += 1; }
      else status = "shade";
    }
    rows.push({ h, elevation, azimuth, status, risk: null });
  }
  return { rows, sunHours };
}

// --- Calibration (Phase 3) ---
//
// Every logged entry captures both what the model predicted for that
// night's low at this exact spot AND what the user says actually happened.
// The bias is just the running average of (observed - predicted) across
// all logged entries — simple, but a real, honest self-correction: the
// model gets closer to this specific spot's truth the more it's used,
// instead of staying a static one-shot prediction forever.

function computeBiasC() {
  const usable = state.log.filter((e) => typeof e.predictedC === "number");
  if (usable.length === 0) return 0;
  const sum = usable.reduce((acc, e) => acc + (e.observedC - e.predictedC), 0);
  return sum / usable.length;
}

function nightPredictedLowC(rows) {
  const nightTemps = rows
    .filter((r) => r.status === "night" && r.risk && typeof r.risk.rawLocalTemp === "number")
    .map((r) => r.risk.rawLocalTemp);
  if (nightTemps.length === 0) return null;
  return Math.min(...nightTemps);
}

function renderCalibrationLog() {
  const bias = computeBiasC();
  const biasF = (bias * 9) / 5; // a temperature *difference* in Celsius converts to Fahrenheit by *9/5 only (no +32)
  const usableCount = state.log.filter((e) => typeof e.predictedC === "number").length;
  calibrationStatus.textContent =
    usableCount > 0
      ? `Calibrated using ${usableCount} logged observation${usableCount === 1 ? "" : "s"} — average adjustment: ${biasF >= 0 ? "+" : ""}${biasF.toFixed(1)}°F.`
      : "No observations logged yet — every estimate above is the unadjusted model.";

  calibrationLogEl.innerHTML = state.log
    .slice()
    .reverse()
    .map((e) => {
      const observedF = cToF(e.observedC).toFixed(1);
      const predictedF = typeof e.predictedC === "number" ? cToF(e.predictedC).toFixed(1) : null;
      const deltaF = predictedF !== null ? (e.observedC - e.predictedC) * 9 / 5 : null;
      const deltaText = deltaF !== null
        ? `<span class="${deltaF < 0 ? "delta-cold" : "delta-warm"}">${deltaF >= 0 ? "+" : ""}${deltaF.toFixed(1)}°F vs. predicted</span>`
        : "no prediction to compare (forecast wasn't loaded)";
      return `<div class="calib-entry"><span>${e.date} — observed ${observedF}°F${e.frost ? ", frost" : ""}</span><span>${deltaText}</span></div>`;
    })
    .join("");
}

saveObservationBtn.addEventListener("click", () => {
  const raw = observedTempInput.value.trim();
  if (raw === "" || Number.isNaN(parseFloat(raw))) {
    calibrationStatus.textContent = "Enter the actual temperature you observed (°F) first.";
    return;
  }
  const observedF = parseFloat(raw);
  const predictedC = nightPredictedLowC(currentRows);
  state.log.push({
    date: state.date,
    observedC: fToC(observedF),
    predictedC,
    frost: observedFrostInput.checked,
  });
  saveState();
  observedTempInput.value = "";
  observedFrostInput.checked = false;
  renderCalibrationLog();
  recompute(); // re-apply the updated bias to the current view
});

// --- Recompute + render ---

let recomputeToken = 0;

function recompute() {
  if (!hasLocation() || !state.date) {
    resultsPanel.hidden = true;
    return;
  }
  const token = ++recomputeToken;
  const [y, m, d] = state.date.split("-").map(Number);

  const { rows, sunHours } = computeSunRows(resolvedTrace(), state.heading, state.fov, state.lat, state.lon, y, m, d);

  let baselineResult = null;
  if (baseline) {
    baselineResult = computeSunRows(resolveSparseTrace(baseline.trace), baseline.heading, baseline.fov, state.lat, state.lon, y, m, d);
  }

  currentRows = rows;
  currentSunHours = sunHours;
  renderResults(rows, sunHours);
  renderCalibrationLog();
  renderSpots();
  calibratePanel.hidden = false;
  loadWeatherAndRisk(token, rows, sunHours, baselineResult);
}

function applyRisk(rows, sunHours, byHour, biasC) {
  let frostHours = 0;
  let heatHours = 0;
  for (const r of rows) {
    const w = byHour.get(r.h);
    if (!w) continue;
    const rawLocalTemp = Risk.estimateLocalTemp(w, sunHours);
    const localTemp = rawLocalTemp + biasC;
    const frost = Risk.frostLevel(localTemp);
    const heat = Risk.heatLevel(w, r.status === "sun");
    r.risk = { localTemp, rawLocalTemp, frost, heat };
    if (frost === "frost") frostHours += 1;
    if (heat === "high" || heat === "elevated") heatHours += 1;
  }
  return { frostHours, heatHours };
}

async function loadWeatherAndRisk(token, rows, sunHours, baselineResult) {
  weatherStatus.textContent = "Loading live forecast…";
  riskSummary.hidden = true;
  plantCare.hidden = true;
  try {
    const hourly = await Weather.fetchHourly(state.lat, state.lon, state.date);
    if (token !== recomputeToken) return; // a newer request superseded this one

    const byHour = new Map(hourly.map((w) => [w.hour, w]));
    const biasC = computeBiasC();
    const { frostHours, heatHours } = applyRisk(rows, sunHours, byHour, biasC);
    currentFrostHours = frostHours;
    currentHeatHours = heatHours;

    let baselineFrostHours = null;
    if (baselineResult) {
      const r = applyRisk(baselineResult.rows, baselineResult.sunHours, byHour, biasC);
      baselineFrostHours = r.frostHours;
    }

    weatherStatus.textContent = "Live forecast loaded.";
    riskSummary.hidden = false;
    const parts = [];
    if (frostHours > 0) parts.push(`<span class="sun-count" style="color:var(--danger)">${frostHours} hour${frostHours === 1 ? "" : "s"} of frost risk</span> at this exact spot tonight — colder here than the general forecast, based on how little sun and how calm/clear it is.`);
    if (heatHours > 0) parts.push(`<span class="sun-count">${heatHours} hour${heatHours === 1 ? "" : "s"} of heat stress risk</span> — full sun during high heat.`);
    riskSummary.innerHTML = parts.length ? parts.join(" ") : "No elevated frost or heat risk detected for this spot on this date.";

    renderResults(rows, sunHours);
    renderWhatif(sunHours, frostHours, baselineResult ? baselineResult.sunHours : null, baselineFrostHours);
    renderCommunity(frostHours);
    renderPlantCare(rows);
    scheduleSummarize();
  } catch (err) {
    if (token !== recomputeToken) return;
    weatherStatus.textContent = `Forecast unavailable for this date (${err.message}). Live forecasts only cover the near-term window — sun-hours above are still accurate.`;
    renderWhatif(sunHours, null, baselineResult ? baselineResult.sunHours : null, null);
    communityPanel.hidden = true;
    plantCare.hidden = true;
  }
}

// --- Plant/grass burn risk + watering suggestion ---

function formatHour(h) {
  const period = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${period}`;
}

// Turns a list of hour numbers (0-23) into a human range like "12:00 PM–4:00 PM",
// so the AI can say *when* something happens instead of just how many hours.
// Assumes a single contiguous block, which frost/heat windows normally are.
function formatHourRange(hours) {
  if (!hours.length) return null;
  const min = Math.min(...hours);
  const max = Math.max(...hours);
  return `${formatHour(min)}–${formatHour((max + 1) % 24)}`;
}

function hotSunHours(rows) {
  return rows.filter((r) => r.status === "sun" && r.risk && (r.risk.heat === "high" || r.risk.heat === "elevated")).map((r) => r.h);
}

function frostRiskHours(rows) {
  return rows.filter((r) => r.risk && r.risk.frost === "frost").map((r) => r.h);
}

function renderPlantCare(rows) {
  const result = PlantCare.assess(rows);
  plantCare.hidden = false;
  plantCareBadge.textContent = result.label;
  plantCareBadge.className = `plant-care-badge ${result.severity}`;

  let html = `<p>${result.summary}</p>`;
  if (result.waterBefore !== null) {
    html += `<div class="water-times">
      <span class="water-time">Water before <b>${formatHour(result.waterBefore)}</b> — before the heat hits</span>
      <span class="water-time">Water again after <b>${formatHour(result.waterAfter)}</b> — once it's cooled off</span>
    </div>`;
  }
  plantCareRule.innerHTML = html;
}

// --- AI plant-photo analysis ---
//
// Identifies the actual plant from a photo and asks the model to tailor
// advice using this spot's REAL already-computed sun/heat data (sent as
// context, never invented server-side). Downscales the photo client-side
// before sending so the request stays small.

function downscaleImage(img, maxDim) {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d").drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.85);
}

async function handlePlantPhoto(img) {
  const dataUrl = downscaleImage(img, 768);
  plantAnalysisResult.innerHTML = `<p class="plant-analysis-status">Identifying your plant…</p>`;

  const hotHourList = hotSunHours(currentRows);
  const frostHourList = frostRiskHours(currentRows);
  const severity = PlantCare.assess(currentRows).severity;

  try {
    const res = await fetch("/api/plant-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: dataUrl,
        context: {
          sunHours: currentSunHours,
          hotHours: hotHourList.length,
          hotHoursRange: formatHourRange(hotHourList),
          frostHours: frostHourList.length,
          frostHoursRange: formatHourRange(frostHourList),
          severity,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      plantAnalysisResult.innerHTML = `<p class="plant-analysis-status error">Couldn't analyze that photo (${data.error || res.status}).</p>`;
      return;
    }
    renderPlantAnalysis(data.analysis, data.mode);
  } catch (err) {
    plantAnalysisResult.innerHTML = `<p class="plant-analysis-status error">Couldn't reach the plant analysis right now.</p>`;
  }
}

function renderPlantAnalysis(a, mode) {
  if (!a) {
    plantAnalysisResult.innerHTML = `<p class="plant-analysis-status error">No analysis came back — try another photo.</p>`;
    return;
  }
  const tips = Array.isArray(a.tips) && a.tips.length ? `<ul class="plant-analysis-tips">${a.tips.map((t) => `<li>${t}</li>`).join("")}</ul>` : "";
  const demoNote = mode === "demo" ? `<p class="plant-analysis-status">Demo mode — connect a live AI key for real identification.</p>` : "";
  plantAnalysisResult.innerHTML = `
    <div class="plant-analysis-card">
      <div class="plant-analysis-head">
        <span class="plant-analysis-species">${a.species || "Unknown"}</span>
        <span class="plant-analysis-confidence ${a.confidence || "low"}">${a.confidence || "low"} confidence</span>
      </div>
      ${a.sunNeeds ? `<p><b>Sun:</b> ${a.sunNeeds}</p>` : ""}
      ${a.waterNeeds ? `<p><b>Water:</b> ${a.waterNeeds}</p>` : ""}
      ${a.heatTolerance ? `<p><b>At this spot today:</b> ${a.heatTolerance}</p>` : ""}
      ${tips}
      ${demoNote}
    </div>`;
}

plantUseHorizonBtn.addEventListener("click", () => {
  if (!photoImg) {
    plantAnalysisResult.innerHTML = `<p class="plant-analysis-status error">Take or upload a horizon photo in step 2 first.</p>`;
    return;
  }
  handlePlantPhoto(photoImg);
});
plantTakePhotoBtn.addEventListener("click", () => openCameraModal("plant", plantCameraInput));
plantUploadPhotoBtn.addEventListener("click", () => plantFileInput.click());

function loadPlantPhotoFrom(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => handlePlantPhoto(img);
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
plantCameraInput.addEventListener("change", () => loadPlantPhotoFrom(plantCameraInput));
plantFileInput.addEventListener("change", () => loadPlantPhotoFrom(plantFileInput));

// --- AI plain-English summary ---
//
// Runs automatically once results load, so the plain-language takeaway is
// the first thing shown — not something a user has to know to click for.
// The button becomes a "Regenerate" option once a summary has been shown.

async function runSummarize() {
  aiSummary.hidden = false;
  aiSummary.className = "ai-summary loading";
  aiSummary.textContent = "Putting this into plain English…";

  const plantResult = PlantCare.assess(currentRows);
  const plantSeverity = plantResult.severity;
  const hotHourList = hotSunHours(currentRows);
  const frostHourList = frostRiskHours(currentRows);

  try {
    const res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: {
          sunHours: currentSunHours,
          frostHours: currentFrostHours,
          frostHoursRange: formatHourRange(frostHourList),
          heatHours: currentHeatHours,
          heatHoursRange: formatHourRange(hotHourList),
          plantSeverity,
          waterBefore: plantResult.waterBefore,
          waterAfter: plantResult.waterAfter,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      aiSummary.className = "ai-summary error";
      aiSummary.textContent = `Couldn't generate a summary (${data.error || res.status}).`;
      return;
    }
    aiSummary.className = "ai-summary";
    const label = data.mode === "demo" ? "Summary (demo mode)" : "Summary";
    aiSummary.innerHTML = `<span class="ai-summary-label">${label}</span>${data.summary}`;
  } catch (err) {
    aiSummary.className = "ai-summary error";
    aiSummary.textContent = "Couldn't reach the summary service right now.";
  } finally {
    summarizeRow.hidden = false;
  }
}

summarizeBtn.addEventListener("click", runSummarize);

// Debounced so rapid changes (e.g. dragging the horizon trace, which fires
// a recompute on every pointerup) don't fire an AI call per micro-edit —
// only once things settle for a moment.
let summarizeDebounceTimer = null;
function scheduleSummarize() {
  clearTimeout(summarizeDebounceTimer);
  summarizeDebounceTimer = setTimeout(runSummarize, 1200);
}

// --- Community layer (Phase 6, demo/stretch) ---
//
// Real version would need a backend to aggregate other households' spots —
// out of scope for a solo build under deadline. This shows what the concept
// looks like: "You" is your real computed frost-risk hours; the rest are
// seeded demo neighbors so the shared-map idea can actually be seen and
// judged, not just described.
const DEMO_NEIGHBORS = [
  { name: "Corner lot — Birch St", offset: 2 },
  { name: "2 doors down", offset: -1 },
  { name: "The place behind the fence", offset: 4 },
];

function renderCommunity(yourFrostHours) {
  communityPanel.hidden = false;
  const rows = [
    { name: "You (this spot)", hours: yourFrostHours, you: true },
    ...DEMO_NEIGHBORS.map((n) => ({ name: n.name, hours: Math.max(0, yourFrostHours + n.offset), you: false })),
  ];
  communityMap.innerHTML = rows
    .map((r) => {
      const initial = r.name.trim().charAt(0).toUpperCase();
      const badgeCls = r.hours > 0 ? "" : "none";
      const badgeText = r.hours > 0 ? `${r.hours}h frost risk` : "no frost risk";
      return `<div class="community-row${r.you ? " you" : ""}">
        <span class="community-avatar">${initial}</span>
        <div class="community-info">
          <div class="community-name">${r.name}</div>
          <div class="community-detail">${r.you ? "Computed from your real trace + calibration" : "Demo data"}</div>
        </div>
        <span class="community-frost-badge ${badgeCls}">${badgeText}</span>
      </div>`;
    })
    .join("");
}

function statHtml(label, baseVal, curVal, unit, higherIsBetter) {
  const delta = curVal - baseVal;
  let cls = "same", arrow = "";
  if (delta !== 0) {
    const better = higherIsBetter ? delta > 0 : delta < 0;
    cls = better ? "better" : "worse";
    arrow = delta > 0 ? "+" : "";
  }
  return `<div class="whatif-stat">
    <div class="stat-label">${label}</div>
    <div class="stat-values">${baseVal}${unit}<span class="stat-arrow">→</span>${curVal}${unit}</div>
    <div class="stat-delta ${cls}">${delta === 0 ? "no change" : `${arrow}${delta}${unit}`}</div>
  </div>`;
}

function renderWhatif(sunHours, frostHours, baselineSunHours, baselineFrostHours) {
  if (baselineSunHours === null) {
    whatifPanel.hidden = true;
    return;
  }
  whatifPanel.hidden = false;
  const parts = [statHtml("Sun-hours per day", baselineSunHours, sunHours, "h", true)];
  if (frostHours !== null && baselineFrostHours !== null) {
    parts.push(statHtml("Hours of frost risk tonight", baselineFrostHours, frostHours, "h", false));
  }
  whatifCompare.innerHTML = parts.join("");
}

function renderResults(rows, sunHours) {
  resultsPanel.hidden = false;
  const untraced = rows.some((r) => r.status === "no-data");
  resultsSummary.innerHTML = `<span class="sun-count">${sunHours} hour${sunHours === 1 ? "" : "s"}</span> of direct sun today at this exact spot${untraced ? " (some hours have no horizon data — that direction wasn't in your photo)" : ""}.`;

  hourStrip.innerHTML = "";
  for (const r of rows) {
    const b = document.createElement("div");
    const frostClass = r.risk && r.risk.frost === "frost" ? " frost-risk" : "";
    b.className = `hour-block ${r.status === "no-data" ? "no-data" : r.status}${frostClass}`;
    b.title = `${String(r.h).padStart(2, "0")}:00 — ${r.status}${r.risk ? `, ${r.risk.frost} frost risk` : ""}`;
    hourStrip.appendChild(b);
  }

  hourTableBody.innerHTML = rows
    .map((r) => {
      const label = r.status === "no-data" ? "no data" : r.status;
      const cls = r.status === "sun" ? "status-sun" : r.status === "shade" ? "status-shade" : "";
      const elevText = r.elevation > 0 ? `${r.elevation.toFixed(1)}°` : "—";
      const azText = r.elevation > 0 ? `${r.azimuth.toFixed(0)}°` : "—";
      let tempText = "—";
      let riskText = "—";
      let riskCls = "";
      if (r.risk) {
        tempText = `${cToF(r.risk.localTemp).toFixed(1)}°F`;
        const frostLabels = { frost: "frost likely", marginal: "frost possible" };
        const heatLabels = { high: "very hot in full sun", elevated: "hot in full sun" };
        if (r.risk.frost !== "low") { riskText = frostLabels[r.risk.frost]; riskCls = `risk-${r.risk.frost}`; }
        else if (r.risk.heat !== "low") { riskText = heatLabels[r.risk.heat]; riskCls = `risk-${r.risk.heat}`; }
        else riskText = "nothing to worry about";
      }
      return `<tr><td>${String(r.h).padStart(2, "0")}:00</td><td>${elevText}</td><td>${azText}</td><td class="${cls}">${label}</td><td>${tempText}</td><td class="${riskCls}">${riskText}</td></tr>`;
    })
    .join("");
}

// --- Intro modal ---

function closeIntro() {
  introModal.hidden = true;
  if (!state.seenIntro) {
    state.seenIntro = true;
    saveState();
  }
}

howItWorksBtn.addEventListener("click", () => { introModal.hidden = false; });

resetDataBtn.addEventListener("click", () => {
  const ok = window.confirm(
    "This erases everything saved in Microclime on this device — location, calibration log, saved spots — and starts fresh from the tutorial. This can't be undone. Continue?"
  );
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});
introClose.addEventListener("click", closeIntro);
introStartBtn.addEventListener("click", closeIntro);
introModal.addEventListener("click", (e) => {
  if (e.target === introModal) closeIntro();
});

if (!state.seenIntro) introModal.hidden = false;

// --- Side nav: disable links to sections that aren't shown yet, and
// highlight whichever section is currently in view.
function setupSideNav() {
  const links = Array.from(document.querySelectorAll(".side-nav-link"));
  if (links.length === 0) return;

  function refreshAvailability() {
    for (const link of links) {
      const target = document.getElementById(link.dataset.target);
      link.classList.toggle("disabled", !target || target.hasAttribute("hidden"));
    }
  }

  for (const link of links) {
    link.addEventListener("click", (e) => {
      const target = document.getElementById(link.dataset.target);
      if (!target || target.hasAttribute("hidden")) e.preventDefault();
    });
  }

  const panels = document.querySelectorAll(".panel[id]");
  new MutationObserver(refreshAvailability).observe(document.body, {
    attributes: true,
    attributeFilter: ["hidden"],
    subtree: true,
  });
  refreshAvailability();

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const link = links.find((l) => l.dataset.target === entry.target.id);
        if (!link) continue;
        for (const l of links) l.classList.remove("active");
        link.classList.add("active");
      }
    },
    { rootMargin: "-35% 0px -55% 0px" }
  );
  panels.forEach((p) => sectionObserver.observe(p));
}
setupSideNav();

initInputs();
recompute();
renderSpots();
