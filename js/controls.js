// ═══════════════════════════════════════════
//  ASTRO-CTRL — Controls, Collision Detection
//  Dynamic Add/Remove, Predictive Analysis
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  COLLISION DETECTION
// ═══════════════════════════════════════════
let lastCritCount = 0;
let lastWarnCount = 0;


// ═══════════════════════════════════════════
//  DYNAMIC ADD/REMOVE SATELLITES & DEBRIS
// ═══════════════════════════════════════════

const SAT_COLORS = [0x00e5ff, 0x00ccff, 0x33ddff, 0x00aaff, 0x66eeff,
                    0xff88aa, 0xffcc00, 0x88ff44, 0xaa66ff, 0x00ffcc,
                    0xff6644, 0x44bbff, 0xffee88, 0x88ffdd, 0xcc88ff,
                    0xff8844, 0x44ff88, 0xffaacc, 0x88ccff, 0xaaffaa];

function createSatellite(index) {
  const radius    = 6.0 + Math.random() * 5.5;
  const speed     = 0.005 + Math.random() * 0.010;
  const inclination = (Math.random() - 0.5) * 1.2;
  const node      = Math.random() * Math.PI * 2;
  const phase     = Math.random() * Math.PI * 2;
  const color     = SAT_COLORS[index % SAT_COLORS.length];

  const orbitPivot = new THREE.Group();
  orbitPivot.rotation.x = inclination;
  orbitPivot.rotation.y = node;
  scene.add(orbitPivot);

  const ring = makeOrbitRing(radius, 0x00e5ff, 0.22);
  orbitPivot.add(ring);

  const geo  = new THREE.SphereGeometry(0.22, 12, 12);
  const mat  = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.8, shininess: 80 });
  const body = new THREE.Mesh(geo, mat);

  const wingGeo = new THREE.BoxGeometry(0.6, 0.04, 0.18);
  const wingMat = new THREE.MeshPhongMaterial({ color: 0x224466, emissive: 0x001133 });
  const wing1 = new THREE.Mesh(wingGeo, wingMat); wing1.position.x =  0.4;
  const wing2 = new THREE.Mesh(wingGeo, wingMat); wing2.position.x = -0.4;

  const satGroup = new THREE.Group();
  satGroup.add(body, wing1, wing2);
  orbitPivot.add(satGroup);

  const sat = {
    radius, speed, inclination, node, color,
    angle: phase, orbitPivot, mesh: satGroup, ring,
    status: 'SAFE', critSphere: null, rerouting: false, rerouteArc: null,
    id: `SAT-${index + 1}`,
  };
  return sat;
}

function destroySatellite(sat) {
  // Remove critical sphere if present
  if (sat.critSphere) sat.mesh.remove(sat.critSphere);
  // Remove the whole pivot (contains ring + mesh)
  scene.remove(sat.orbitPivot);
  sat.orbitPivot.clear();
}

function addSatellite() {
  if (satellites.length >= MAX_SAT) return;
  const sat = createSatellite(satellites.length);
  satellites.push(sat);
  updateCountUI();
  logEntry(`> [${getSimTime()}] Satellite ${sat.id} deployed into orbit.`, 'info');
}

function removeSatellite() {
  if (satellites.length <= 1) return;
  const sat = satellites.pop();
  destroySatellite(sat);
  updateCountUI();
  logEntry(`> [${getSimTime()}] ${sat.id} decommissioned.`, 'warn');
}

function createDebrisPiece() {
  const radius      = 5.5 + Math.random() * 6.5;
  const speed       = (Math.random() < 0.5 ? 1 : -1) * (0.008 + Math.random() * 0.018);
  const inclination = (Math.random() - 0.5) * 1.4;
  const node        = Math.random() * Math.PI * 2;
  const phase       = Math.random() * Math.PI * 2;
  const sz          = 0.06 + Math.random() * 0.12;

  const pivot = new THREE.Group();
  pivot.rotation.x = inclination;
  pivot.rotation.y = node;
  scene.add(pivot);

  const geo = new THREE.OctahedronGeometry(sz, 0);
  const hue = Math.random() < 0.6 ? 0xff4422 : 0xff8833;
  const mat = new THREE.MeshPhongMaterial({ color: hue, emissive: hue, emissiveIntensity: 0.4 });
  const mesh = new THREE.Mesh(geo, mat);
  pivot.add(mesh);

  return { radius, speed, inclination, node, phase, angle: phase, pivot, mesh };
}

// Store all debris in a unified array of objects with both data and mesh refs
// We need to reconcile with the existing debrisData / debrisMeshes / debrisPivots arrays
// Build a unified debrisList from the existing arrays on init
let debrisList = [];

function syncDebrisLists() {
  // Called once after initial debris creation
  for (let i = 0; i < debrisData.length; i++) {
    debrisList.push({
      ...debrisData[i],
      mesh: debrisMeshes[i],
      pivot: debrisPivots[i]
    });
  }
}

function addDebris() {
  if (debrisList.length >= MAX_DEBRIS) return;
  const d = createDebrisPiece();
  debrisList.push(d);
  updateCountUI();
}

function removeDebris() {
  if (debrisList.length <= 0) return;
  const d = debrisList.pop();
  scene.remove(d.pivot);
  d.pivot.clear();
  updateCountUI();
}

function updateCountUI() {
  const sc = satellites.length;
  const dc = debrisList.length;
  document.getElementById('sat-count').textContent  = sc;
  document.getElementById('deb-count').textContent  = dc;
  document.getElementById('sat-fill').style.width   = Math.min(100, (sc / MAX_SAT) * 100) + '%';
  document.getElementById('deb-fill').style.width   = Math.min(100, (dc / MAX_DEBRIS) * 100) + '%';
  document.getElementById('hud-sat').textContent    = sc;
  document.getElementById('hud-deb').textContent    = dc;
  document.getElementById('db-sat').textContent     = sc;
  document.getElementById('db-deb').textContent     = dc;
}

// Speed & pause controls
function onSpeedChange(val) {
  // val 0-100 mapped to 0.05x - 5x (log scale feels natural)
  const t = val / 100;
  speedMultiplier = Math.pow(10, -1.3 + t * 2.0); // ~0.05 to ~5
  document.getElementById('speed-val').textContent = speedMultiplier.toFixed(2) + 'x';
}

function togglePause() {
  isPaused = !isPaused;
  const btn = document.getElementById('pause-btn');
  btn.textContent = isPaused ? '▶ RESUME SIMULATION' : '⏸ PAUSE SIMULATION';
  btn.classList.toggle('paused', isPaused);
  logEntry(`> [${getSimTime()}] Simulation ${isPaused ? 'PAUSED' : 'RESUMED'}.`, 'info');
}

window.addSatellite   = addSatellite;
window.removeSatellite = removeSatellite;
window.addDebris      = addDebris;
window.removeDebris   = removeDebris;
window.onSpeedChange  = onSpeedChange;
window.togglePause    = togglePause;

// Helper: get world position of a mesh that may be inside a pivot group
const _wp = new THREE.Vector3();
function worldPos(mesh) {
  mesh.getWorldPosition(_wp);
  return _wp.clone();
}

function checkCollisions() {
  let critCount = 0, warnCount = 0, safeCount = 0;

  // Cache world positions for this frame
  const satWP  = satellites.map(s => worldPos(s.mesh));
  const debWP  = debrisList.map(d => worldPos(d.mesh));

  for (let i = 0; i < satellites.length; i++) {
    const sat = satellites[i];
    let minDist = Infinity;

    // Check against debris
    for (let j = 0; j < debWP.length; j++) {
      const dist = satWP[i].distanceTo(debWP[j]);
      if (dist < minDist) minDist = dist;
    }

    // Check against other satellites
    for (let j = 0; j < satellites.length; j++) {
      if (i === j) continue;
      const dist = satWP[i].distanceTo(satWP[j]);
      if (dist < minDist) minDist = dist;
    }

    if (minDist < 2.0) {
      sat.status = 'CRITICAL';
      critCount++;
      if (!sat.critSphere) {
        sat.critSphere = makeCritSphere(0.7);
        sat.mesh.add(sat.critSphere);
      }
    } else if (minDist < 4.0) {
      sat.status = 'WARNING';
      warnCount++;
      if (sat.critSphere) { sat.mesh.remove(sat.critSphere); sat.critSphere = null; }
    } else {
      sat.status = 'SAFE';
      safeCount++;
      if (sat.critSphere) { sat.mesh.remove(sat.critSphere); sat.critSphere = null; }
    }
  }

  document.getElementById('hud-crit').textContent = critCount;
  document.getElementById('hud-warn').textContent = warnCount;
  document.getElementById('db-crit').textContent = critCount;
  document.getElementById('db-safe').textContent = safeCount;

  const critCard = document.getElementById('db-crit-card');
  if (critCount > 0) { critCard.classList.add('alerting'); }
  else { critCard.classList.remove('alerting'); }

  // Auto-trigger A* if new critical
  if (critCount > lastCritCount && !isRunningAstar) {
    const critSat = satellites.find(s => s.status === 'CRITICAL');
    if (critSat) autoTriggerAstar(critSat.id);
  }
  lastCritCount = critCount;
}

function autoTriggerAstar(satId) {
  if (isRunningAstar) return;
  randomizeGridPositions(satId);
  document.getElementById('stat-sat').textContent = satId;
  runAstar(gridStart, gridGoal, satId);
}

function randomizeGridPositions(satId) {
  initGrid();
  // Random start on left side, goal on right side
  gridStart = { x: 1 + Math.floor(Math.random() * 3), y: 2 + Math.floor(Math.random() * 16) };
  gridGoal  = { x: 16 + Math.floor(Math.random() * 3), y: 2 + Math.floor(Math.random() * 16) };
  grid[gridStart.y][gridStart.x] = SAT_START;
  grid[gridGoal.y][gridGoal.x] = GOAL;
  drawGrid();
}

// Manual trigger
function triggerAvoidance() {
  if (isRunningAstar) return;
  const idx = Math.floor(Math.random() * satellites.length);
  const sat = satellites[idx];
  const satId = sat.id;
  sat.status = 'CRITICAL';
  if (!sat.critSphere) {
    sat.critSphere = makeCritSphere(0.7);
    sat.mesh.add(sat.critSphere);
  }
  randomizeGridPositions(satId);
  document.getElementById('stat-sat').textContent = satId;
  logEntry(`> [${getSimTime()}] Manual override: ${satId} flagged CRITICAL`, 'crit');
  runAstar(gridStart, gridGoal, satId);
}
window.triggerAvoidance = triggerAvoidance;

// ═══════════════════════════════════════════
//  PREDICTIVE ANALYSIS
// ═══════════════════════════════════════════
function predictiveAnalysis() {
  const STEPS = 30;
  for (let i = 0; i < satellites.length; i++) {
    const sat = satellites[i];
    const futureAngle = sat.angle + sat.speed * STEPS;
    // Compute future local position then transform by orbitPivot matrix
    const localFuture = new THREE.Vector3(
      Math.cos(futureAngle) * sat.radius, 0, Math.sin(futureAngle) * sat.radius
    );
    const futurePos = localFuture.clone().applyEuler(sat.orbitPivot.rotation);

    for (let j = i + 1; j < satellites.length; j++) {
      const sat2 = satellites[j];
      const fa2 = sat2.angle + sat2.speed * STEPS;
      const lf2 = new THREE.Vector3(
        Math.cos(fa2) * sat2.radius, 0, Math.sin(fa2) * sat2.radius
      );
      const fp2 = lf2.clone().applyEuler(sat2.orbitPivot.rotation);
      if (futurePos.distanceTo(fp2) < 3.0 && sat.status === 'SAFE') {
        if (Math.random() < 0.02) logEntry(`> [${getSimTime()}] Predictive: ${sat.id} & ${sat2.id} converging in ~2s`, 'warn');
      }
    }
  }
}

