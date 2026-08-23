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
const photoInput = el("photo-input");
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
const hourStrip = el("hour-strip");
const hourTableBody = el("hour-table-body");
const calibratePanel = el("calibrate-panel");
const observedTempInput = el("observed-temp-input");
const observedFrostInput = el("observed-frost-input");
const saveObservationBtn = el("save-observation-btn");
const calibrationStatus = el("calibration-status");
const calibrationLogEl = el("calibration-log");

let currentRows = [];

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

photoInput.addEventListener("change", () => {
  const file = photoInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      photoImg = img;
      trace = new Array(BUCKETS).fill(null);
      const wrapWidth = canvasWrap.clientWidth || 640;
      canvas.width = wrapWidth;
      canvas.height = Math.round((wrapWidth * img.height) / img.width);
      canvasWrap.hidden = false;
      headingRow.hidden = false;
      drawCanvas();
      recompute();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

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

// Fills gaps in the sparse trace array via linear interpolation between the
// nearest set buckets on each side; flat-extrapolates past the outer ones.
// Returns null if nothing has been traced yet.
function resolvedTrace() {
  const setIdx = [];
  for (let i = 0; i < BUCKETS; i++) if (trace[i] !== null) setIdx.push(i);
  if (setIdx.length === 0) return null;

  const dense = new Array(BUCKETS);
  for (let i = 0; i < BUCKETS; i++) {
    if (trace[i] !== null) {
      dense[i] = trace[i];
      continue;
    }
    let lo = null, hi = null;
    for (const j of setIdx) {
      if (j < i) lo = j;
      if (j > i && hi === null) hi = j;
    }
    if (lo === null) dense[i] = trace[hi];
    else if (hi === null) dense[i] = trace[lo];
    else dense[i] = trace[lo] + ((trace[hi] - trace[lo]) * (i - lo)) / (hi - lo);
  }
  return dense;
}

function drawCanvas() {
  if (!photoImg) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(photoImg, 0, 0, canvas.width, canvas.height);

  const dense = resolvedTrace();
  if (!dense) return;

  ctx.beginPath();
  ctx.strokeStyle = "#f4a940";
  ctx.lineWidth = 3;
  for (let i = 0; i < BUCKETS; i++) {
    const x = ((i + 0.5) / BUCKETS) * canvas.width;
    const y = dense[i] * canvas.height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "rgba(232,237,243,0.35)";
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

// Returns the blocked elevation (degrees) at a given compass azimuth, or
// null if that azimuth wasn't covered by the traced photo.
function blockedElevationAt(azimuthDeg) {
  const dense = resolvedTrace();
  if (!dense) return 0; // no trace yet: assume open horizon
  const rel = angleDiff(azimuthDeg, state.heading);
  if (Math.abs(rel) > state.fov / 2) return null;
  const xFrac = 0.5 + rel / state.fov;
  const pos = Math.min(BUCKETS - 1, Math.max(0, xFrac * BUCKETS - 0.5));
  const i0 = Math.floor(pos);
  const i1 = Math.min(BUCKETS - 1, i0 + 1);
  const t = pos - i0;
  const yFrac = dense[i0] + (dense[i1] - dense[i0]) * t;
  return VERTICAL_FOV / 2 - yFrac * VERTICAL_FOV;
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

  const rows = [];
  let sunHours = 0;
  for (let h = 0; h < 24; h++) {
    const { elevation, azimuth } = Solar.positionAtLocalHour(y, m, d, h, state.lat, state.lon);
    let status;
    if (elevation <= 0) {
      status = "night";
    } else {
      const blocked = blockedElevationAt(azimuth);
      if (blocked === null) status = "no-data";
      else if (elevation > blocked) { status = "sun"; sunHours += 1; }
      else status = "shade";
    }
    rows.push({ h, elevation, azimuth, status, risk: null });
  }

  currentRows = rows;
  renderResults(rows, sunHours);
  renderCalibrationLog();
  calibratePanel.hidden = false;
  loadWeatherAndRisk(token, rows, sunHours);
}

async function loadWeatherAndRisk(token, rows, sunHours) {
  weatherStatus.textContent = "Loading live forecast…";
  riskSummary.hidden = true;
  try {
    const hourly = await Weather.fetchHourly(state.lat, state.lon, state.date);
    if (token !== recomputeToken) return; // a newer request superseded this one

    const byHour = new Map(hourly.map((w) => [w.hour, w]));
    const biasC = computeBiasC();
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

    weatherStatus.textContent = "Live forecast loaded.";
    riskSummary.hidden = false;
    const parts = [];
    if (frostHours > 0) parts.push(`<span class="sun-count" style="color:var(--danger)">${frostHours} hour${frostHours === 1 ? "" : "s"} of frost risk</span> at this exact spot tonight — colder here than the general forecast, based on how little sun and how calm/clear it is.`);
    if (heatHours > 0) parts.push(`<span class="sun-count">${heatHours} hour${heatHours === 1 ? "" : "s"} of heat stress risk</span> — full sun during high heat.`);
    riskSummary.innerHTML = parts.length ? parts.join(" ") : "No elevated frost or heat risk detected for this spot on this date.";

    renderResults(rows, sunHours);
  } catch (err) {
    if (token !== recomputeToken) return;
    weatherStatus.textContent = `Forecast unavailable for this date (${err.message}). Live forecasts only cover the near-term window — sun-hours above are still accurate.`;
  }
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
        if (r.risk.frost !== "low") { riskText = `${r.risk.frost} frost`; riskCls = `risk-${r.risk.frost}`; }
        else if (r.risk.heat !== "low") { riskText = `${r.risk.heat} heat`; riskCls = `risk-${r.risk.heat}`; }
        else riskText = "none";
      }
      return `<tr><td>${String(r.h).padStart(2, "0")}:00</td><td>${elevText}</td><td>${azText}</td><td class="${cls}">${label}</td><td>${tempText}</td><td class="${riskCls}">${riskText}</td></tr>`;
    })
    .join("");
}

initInputs();
recompute();
