// ═══════════════════════════════════════════
//  GLOBAL STATE
// ═══════════════════════════════════════════
const GRID_SIZE = 20;
const CELL_SIZE = 20;
const MAX_SAT = 20;
const MAX_DEBRIS = 50;

let frameCount = 0;
let maneuversExecuted = 0;
let isRunningAstar = false;
let simTime = 0;
const startTime = Date.now();
let speedMultiplier = 1.0;
let isPaused = false;
let successfulRoutes = 0;
let plansGenerated = 0;
let activeRouteSat = null;
let activePlannerRows = 20;
let activePlannerCols = 20;
let blockedCells = 0;
let currentPlannerSatId = '--';
let currentPlannerGoalRow = null;
let autoDemoTriggered = false;
let lastRiskSignature = '';

// Cell types
const EMPTY = 0, DEBRIS_CELL = 1, SAT_START = 2, GOAL = 3,
      EXPLORED = 4, FINAL_PATH = 5, SAT_MOVING = 6;

let grid = [];
let gridStart = {x:1, y:1};
let gridGoal = {x:18, y:18};
let currentSatIndex = 0;
let currentReroutePlan = null;

const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
const viewButtons = Array.from(document.querySelectorAll('[data-view-target]'));
const appViews = Array.from(document.querySelectorAll('.app-view'));

function setActiveView(viewId) {
  appViews.forEach((view) => view.classList.toggle('active', view.id === viewId));
  tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === viewId));
  if (viewId === 'sim-view') requestAnimationFrame(resizeRenderer);
}

tabButtons.forEach((btn) => btn.addEventListener('click', () => setActiveView(btn.dataset.view)));
viewButtons.forEach((btn) => btn.addEventListener('click', () => setActiveView(btn.dataset.viewTarget)));

// ═══════════════════════════════════════════
//  THREE.JS SETUP
// ═══════════════════════════════════════════
const canvas3d = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x020810, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
camera.position.set(0, 8, 22);
camera.lookAt(0, 0, 0);

// Resize handler
function resizeRenderer() {
  const section = document.getElementById('scene-section');
  const w = section.clientWidth, h = section.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resizeRenderer();
window.addEventListener('resize', resizeRenderer);

// Starfield
const starGeo = new THREE.BufferGeometry();
const starVerts = [];
for (let i = 0; i < 2000; i++) {
  const r = 200 + Math.random() * 300;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starVerts.push(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi)
  );
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
const starMat = new THREE.PointsMaterial({ color: 0xaaccff, size: 0.4, transparent: true, opacity: 0.7 });
scene.add(new THREE.Points(starGeo, starMat));

// Lighting
scene.add(new THREE.AmbientLight(0x112233, 1.2));
const sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
sunLight.position.set(10, 5, 8);
scene.add(sunLight);
const rimLight = new THREE.DirectionalLight(0x004466, 0.6);
rimLight.position.set(-8, -3, -5);
scene.add(rimLight);

// Earth
function makeEarth() {
  const geo = new THREE.SphereGeometry(4, 64, 64);
  const mat = new THREE.MeshPhongMaterial({
    color: 0x0d4a6a,
    emissive: 0x001122,
    specular: 0x4499cc,
    shininess: 35,
  });
  const earth = new THREE.Mesh(geo, mat);

  // Continent-like patches using vertex coloring approximation via a second sphere
  const cloudGeo = new THREE.SphereGeometry(4.06, 48, 48);
  const cloudMat = new THREE.MeshPhongMaterial({
    color: 0x1a7a4a,
    transparent: true,
    opacity: 0.35,
    wireframe: false,
    depthWrite: false,
  });
  // Procedural texture via a canvas
  const texCanvas = document.createElement('canvas');
  texCanvas.width = 256; texCanvas.height = 128;
  const ctx = texCanvas.getContext('2d');
  ctx.fillStyle = '#0d4a6a';
  ctx.fillRect(0,0,256,128);
  // Simple continent-like blobs
  ctx.fillStyle = '#1a7a4a';
  const blobs = [
    [40,30,35,25],[90,20,45,30],[150,25,40,28],[200,35,30,22],
    [30,70,28,20],[80,80,35,25],[130,65,30,22],[180,75,40,28],
    [220,50,25,18],[60,55,20,15],[170,45,22,16]
  ];
  blobs.forEach(([x,y,w,h]) => {
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, Math.random()*Math.PI, 0, Math.PI*2);
    ctx.fill();
  });
  // Ice caps
  ctx.fillStyle = '#cce8ff';
  ctx.fillRect(0,0,256,12);
  ctx.fillRect(0,116,256,12);
  const tex = new THREE.CanvasTexture(texCanvas);
  mat.map = tex; mat.needsUpdate = true;

  const clouds = new THREE.Mesh(cloudGeo, cloudMat);
  const group = new THREE.Group();
  group.add(earth);
  group.add(clouds);
  return { group, earth, clouds };
}
const { group: earthGroup, clouds } = makeEarth();
scene.add(earthGroup);

// Atmosphere glow
const atmosGeo = new THREE.SphereGeometry(4.3, 32, 32);
const atmosMat = new THREE.MeshPhongMaterial({
  color: 0x0066aa,
  transparent: true,
  opacity: 0.12,
  side: THREE.BackSide,
  depthWrite: false,
});
scene.add(new THREE.Mesh(atmosGeo, atmosMat));

// ── ORBIT RING helper (draws a circle in the XZ plane) ──
function makeOrbitRing(radius, color = 0x00e5ff, opacity = 0.18) {
  const pts = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  return new THREE.Line(geo, mat);
}

// ── SATELLITES ──
// Each satellite lives inside an "orbital plane" pivot group.
// The pivot is tilted (rotX = inclination, rotZ = node), then the
// satellite moves in the local XZ plane of that pivot → stays ON its ring.
const satBaseData = [
  { radius: 6.5,  speed: 0.012, inclination: 0.28,  node: 0.0,  color: 0x00e5ff, phase: 0 },
  { radius: 8.0,  speed: 0.009, inclination: 0.55,  node: 0.5,  color: 0x00ccff, phase: 1.2 },
  { radius: 9.5,  speed: 0.007, inclination: -0.32, node: 1.1,  color: 0x33ddff, phase: 2.5 },
  { radius: 7.2,  speed: 0.011, inclination: 0.72,  node: 1.7,  color: 0x00aaff, phase: 3.8 },
  { radius: 10.5, speed: 0.006, inclination: -0.50, node: 2.4,  color: 0x66eeff, phase: 0.8 },
];

const satellites = satBaseData.map((d, i) => {
  // 1. Orbital plane pivot (tilted to give unique inclination + ascending node)
  const orbitPivot = new THREE.Group();
  orbitPivot.rotation.x = d.inclination;   // tilt out of equatorial plane
  orbitPivot.rotation.y = d.node;          // rotate ascending node around Y
  scene.add(orbitPivot);

  // 2. Orbit ring lives inside the pivot → automatically coplanar
  const ring = makeOrbitRing(d.radius, 0x00e5ff, 0.22);
  orbitPivot.add(ring);

  // 3. Satellite mesh also lives inside the pivot
  const geo = new THREE.SphereGeometry(0.22, 12, 12);
  const mat = new THREE.MeshPhongMaterial({
    color: d.color, emissive: d.color, emissiveIntensity: 0.8, shininess: 80
  });
  const body = new THREE.Mesh(geo, mat);

  // Solar panel wings
  const wingGeo = new THREE.BoxGeometry(0.6, 0.04, 0.18);
  const wingMat = new THREE.MeshPhongMaterial({ color: 0x224466, emissive: 0x001133 });
  const wing1 = new THREE.Mesh(wingGeo, wingMat); wing1.position.x =  0.4;
  const wing2 = new THREE.Mesh(wingGeo, wingMat); wing2.position.x = -0.4;

  const satGroup = new THREE.Group();
  satGroup.add(body, wing1, wing2);
  orbitPivot.add(satGroup);   // ← child of pivot, not scene root

  return {
    ...d,
    angle: d.phase,
    orbitPivot,
    mesh: satGroup,
    status: 'SAFE',
    critSphere: null,
    rerouting: false,
    rerouteArc: null,
    id: `SAT-${i + 1}`,
  };
});

// ── DEBRIS ──
// Same approach: each piece of debris gets its own orbital pivot group.
const debrisData = [];
const debrisMeshes  = [];
const debrisPivots  = [];

for (let i = 0; i < 18; i++) {
  const radius      = 5.5 + Math.random() * 6;
  const speed       = (Math.random() < 0.5 ? 1 : -1) * (0.008 + Math.random() * 0.018);
  const inclination = (Math.random() - 0.5) * 1.4;
  const node        = Math.random() * Math.PI * 2;
  const phase       = Math.random() * Math.PI * 2;
  const sz          = 0.06 + Math.random() * 0.12;

  // Orbital plane pivot
  const pivot = new THREE.Group();
  pivot.rotation.x = inclination;
  pivot.rotation.y = node;
  scene.add(pivot);

  // Debris mesh in local XZ plane
  const geo = new THREE.OctahedronGeometry(sz, 0);
  const hue = Math.random() < 0.6 ? 0xff4422 : 0xff8833;
  const mat = new THREE.MeshPhongMaterial({ color: hue, emissive: hue, emissiveIntensity: 0.4 });
  const mesh = new THREE.Mesh(geo, mat);
  pivot.add(mesh);

  debrisData.push({ radius, speed, inclination, node, phase, angle: phase });
  debrisMeshes.push(mesh);
  debrisPivots.push(pivot);
}

// Reroute arc
function makeRerouteArc(start, end, color = 0xffab00) {
  const pts = [];
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  mid.normalize().multiplyScalar(mid.length() * 1.25);
  for (let t = 0; t <= 32; t++) {
    const tt = t / 32;
    const p = new THREE.Vector3(
      (1-tt)*(1-tt)*start.x + 2*(1-tt)*tt*mid.x + tt*tt*end.x,
      (1-tt)*(1-tt)*start.y + 2*(1-tt)*tt*mid.y + tt*tt*end.y,
      (1-tt)*(1-tt)*start.z + 2*(1-tt)*tt*mid.z + tt*tt*end.z
    );
    pts.push(p);
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineDashedMaterial({ color, dashSize: 0.3, gapSize: 0.2, linewidth: 1 });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  return line;
}

// Critical pulsing sphere
function makeCritSphere(radius = 0.6) {
  const geo = new THREE.SphereGeometry(radius, 16, 16);
  const mat = new THREE.MeshPhongMaterial({ color: 0xff3d3d, transparent: true, opacity: 0.25, wireframe: false });
  return new THREE.Mesh(geo, mat);
}

// ═══════════════════════════════════════════
//  2D GRID SETUP
// ═══════════════════════════════════════════
const gridCanvas = document.getElementById('grid-canvas');
const gc = gridCanvas.getContext('2d');

function normalizeAngle(value) {
  let out = value % (Math.PI * 2);
  if (out < 0) out += Math.PI * 2;
  return out;
}

function angleDistance(a, b) {
  let diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return diff;
}

function radiusToRow(radius) {
  const minR = 5.5;
  const maxR = 11.8;
  const normalized = (radius - minR) / (maxR - minR);
  return Math.max(1, Math.min(GRID_SIZE - 2, Math.round((GRID_SIZE - 1) - normalized * (GRID_SIZE - 1))));
}

function rowToRadius(row) {
  const minR = 5.5;
  const maxR = 11.8;
  const normalized = 1 - (row / (GRID_SIZE - 1));
  return minR + normalized * (maxR - minR);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setBarWidth(id, percent) {
  const el = document.getElementById(id);
  if (el) el.style.setProperty('--bar-width', `${Math.max(4, Math.min(100, percent))}%`);
}

function setRailProgress(percent) {
  const el = document.getElementById('insight-rail-fill');
  if (el) el.style.width = `${Math.max(4, Math.min(100, percent))}%`;
}

function setPlannerStage(stage, detail = {}) {
  const steps = Array.from(document.querySelectorAll('.insight-step'));
  steps.forEach((step, index) => step.classList.toggle('active', index <= stage));
  setRailProgress([12, 48, 82, 100][stage] || 12);
  if (detail.plan) setText('plan-readout', detail.plan);
  if (detail.route) setText('route-readout', detail.route);
  if (detail.risk) setText('risk-readout', detail.risk);
}

function buildPlannerGridForSatellite(sat) {
  grid = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    grid.push([]);
    for (let x = 0; x < GRID_SIZE; x++) {
      grid[y].push(EMPTY);
    }
  }
  blockedCells = 0;
  const startRow = radiusToRow(sat.radius);
  gridStart = { x: 1, y: startRow };
  currentPlannerGoalRow = startRow;

  for (let step = 2; step < GRID_SIZE - 1; step++) {
    const futureSatAngle = normalizeAngle(sat.angle + sat.speed * step * 7);
    for (const d of debrisList) {
      const futureDebAngle = normalizeAngle(d.angle + d.speed * step * 7);
      const row = radiusToRow(d.radius);
      if (angleDistance(futureSatAngle, futureDebAngle) < 0.22) {
        for (let offset = -1; offset <= 1; offset++) {
          const r = row + offset;
          if (r >= 0 && r < GRID_SIZE && grid[r][step] !== DEBRIS_CELL) {
            grid[r][step] = DEBRIS_CELL;
            blockedCells++;
          }
        }
      }
    }
    for (const other of satellites) {
      if (other.id === sat.id) continue;
      const futureOtherAngle = normalizeAngle(other.angle + other.speed * step * 7);
      const row = radiusToRow(other.radius);
      if (angleDistance(futureSatAngle, futureOtherAngle) < 0.16) {
        for (let offset = -1; offset <= 1; offset++) {
          const r = row + offset;
          if (r >= 0 && r < GRID_SIZE && grid[r][step] !== DEBRIS_CELL) {
            grid[r][step] = DEBRIS_CELL;
            blockedCells++;
          }
        }
      }
    }
  }

  let bestGoalRow = startRow;
  let bestScore = Infinity;
  for (let row = 0; row < GRID_SIZE; row++) {
    if (grid[row][GRID_SIZE - 2] === DEBRIS_CELL) continue;
    const score = Math.abs(row - startRow);
    if (score < bestScore) {
      bestScore = score;
      bestGoalRow = row;
    }
  }

  currentPlannerGoalRow = bestGoalRow;
  gridGoal = { x: GRID_SIZE - 2, y: bestGoalRow };
  grid[gridStart.y][gridStart.x] = SAT_START;
  grid[gridGoal.y][gridGoal.x] = GOAL;
  currentPlannerSatId = sat.id;
  setPlannerStage(1, {
    plan: `${sat.id}: ${blockedCells} blocked cells, lane ${gridStart.y + 1} to ${gridGoal.y + 1}`,
  });
  setBarWidth('lane-danger-bar', Math.min(100, blockedCells * 3));
}

function drawGrid() {
  gc.clearRect(0, 0, 400, 400);

  // Background grid lines
  gc.strokeStyle = 'rgba(0,229,255,0.06)';
  gc.lineWidth = 0.5;
  for (let i = 0; i <= GRID_SIZE; i++) {
    gc.beginPath(); gc.moveTo(i * CELL_SIZE, 0); gc.lineTo(i * CELL_SIZE, 400); gc.stroke();
    gc.beginPath(); gc.moveTo(0, i * CELL_SIZE); gc.lineTo(400, i * CELL_SIZE); gc.stroke();
  }

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const px = x * CELL_SIZE, py = y * CELL_SIZE;
      const cell = grid[y][x];

      switch (cell) {
        case EMPTY:
          gc.fillStyle = '#070f1a';
          gc.fillRect(px+1, py+1, CELL_SIZE-2, CELL_SIZE-2);
          break;
        case DEBRIS_CELL:
          gc.fillStyle = 'rgba(255,61,61,0.75)';
          gc.fillRect(px+1, py+1, CELL_SIZE-2, CELL_SIZE-2);
          gc.fillStyle = 'rgba(255,100,50,0.4)';
          gc.fillRect(px+3, py+3, CELL_SIZE-6, CELL_SIZE-6);
          break;
        case SAT_START:
          gc.fillStyle = 'rgba(0,229,255,0.25)';
          gc.fillRect(px+1, py+1, CELL_SIZE-2, CELL_SIZE-2);
          gc.fillStyle = '#00e5ff';
          gc.beginPath();
          gc.arc(px+CELL_SIZE/2, py+CELL_SIZE/2, 5, 0, Math.PI*2);
          gc.fill();
          // Glow
          gc.shadowBlur = 10; gc.shadowColor = '#00e5ff';
          gc.fill();
          gc.shadowBlur = 0;
          break;
        case GOAL:
          gc.fillStyle = 'rgba(0,255,136,0.2)';
          gc.fillRect(px+1, py+1, CELL_SIZE-2, CELL_SIZE-2);
          gc.strokeStyle = '#00ff88';
          gc.lineWidth = 1.5;
          gc.strokeRect(px+2, py+2, CELL_SIZE-4, CELL_SIZE-4);
          gc.fillStyle = '#00ff88';
          gc.fillRect(px+7, py+7, CELL_SIZE-14, CELL_SIZE-14);
          gc.shadowBlur = 8; gc.shadowColor = '#00ff88';
          gc.fillRect(px+7, py+7, CELL_SIZE-14, CELL_SIZE-14);
          gc.shadowBlur = 0;
          break;
        case EXPLORED:
          gc.fillStyle = 'rgba(0,80,180,0.45)';
          gc.fillRect(px+1, py+1, CELL_SIZE-2, CELL_SIZE-2);
          gc.fillStyle = 'rgba(0,130,220,0.25)';
          gc.fillRect(px+4, py+4, CELL_SIZE-8, CELL_SIZE-8);
          break;
        case FINAL_PATH:
          gc.fillStyle = 'rgba(255,171,0,0.85)';
          gc.fillRect(px+1, py+1, CELL_SIZE-2, CELL_SIZE-2);
          gc.shadowBlur = 8; gc.shadowColor = '#ffab00';
          gc.fillRect(px+1, py+1, CELL_SIZE-2, CELL_SIZE-2);
          gc.shadowBlur = 0;
          break;
        case SAT_MOVING:
          gc.fillStyle = 'rgba(0,229,255,0.4)';
          gc.fillRect(px+1, py+1, CELL_SIZE-2, CELL_SIZE-2);
          gc.fillStyle = '#00e5ff';
          gc.shadowBlur = 12; gc.shadowColor = '#00e5ff';
          gc.beginPath();
          gc.arc(px+CELL_SIZE/2, py+CELL_SIZE/2, 6, 0, Math.PI*2);
          gc.fill();
          gc.shadowBlur = 0;
          break;
      }
    }
  }
}

// ═══════════════════════════════════════════
//  A* ALGORITHM
// ═══════════════════════════════════════════
function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

async function runAstar(startPos, goalPos, sat) {
  const satId = sat.id;
  isRunningAstar = true;
  document.getElementById('trigger-btn').disabled = true;
  setStatus('SCANNING', 'status-scanning');
  plansGenerated++;
  document.getElementById('stat-sat').textContent = satId;
  document.getElementById('stat-path').textContent = '--';
  document.getElementById('stat-nodes').textContent = '0';
  const heuristicBox = document.querySelector('.stats-grid .stat-box:nth-child(3) .stat-value');
  if (heuristicBox) heuristicBox.innerHTML = `START L${startPos.y + 1}<br>GOAL L${goalPos.y + 1}`;

  const nodeKey = (n) => `${n.x},${n.y}`;
  const openSet = [{ x: startPos.x, y: startPos.y, g: 0, h: heuristic(startPos, goalPos), f: heuristic(startPos, goalPos), parent: null }];
  const closedSet = new Set();
  const gScore = { [nodeKey(startPos)]: 0 };
  let nodesExplored = 0;

  logEntry(`> [${getSimTime()}] Satellite ${satId} risk: CRITICAL`, 'crit');
  logEntry(`> [${getSimTime()}] Activating A* pathfinder...`, 'info');
  setPlannerStage(1, { plan: `${satId}: scanning shortest safe lane route` });
  await sleep(200);
  setStatus('COMPUTING', 'status-computing');
  setPlannerStage(2, { plan: `A* exploring with Manhattan heuristic` });

  while (openSet.length > 0) {
    // Get lowest f
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();
    const key = nodeKey(current);

    if (closedSet.has(key)) continue;
    closedSet.add(key);
    nodesExplored++;

    // Animate exploration
    if (grid[current.y][current.x] !== SAT_START && grid[current.y][current.x] !== GOAL) {
      grid[current.y][current.x] = EXPLORED;
    }
    document.getElementById('stat-nodes').textContent = nodesExplored;
    drawGrid();

    if (nodesExplored % 5 === 0) logEntry(`> [${getSimTime()}] Exploring node (${current.x},${current.y})...`);

    await sleep(50);

    // Goal reached
    if (current.x === goalPos.x && current.y === goalPos.y) {
      // Reconstruct path
      const path = [];
      let node = current;
      while (node) { path.unshift({x: node.x, y: node.y}); node = node.parent; }

      // Re-init non-path explored cells
      for (let y = 0; y < GRID_SIZE; y++)
        for (let x = 0; x < GRID_SIZE; x++)
          if (grid[y][x] === EXPLORED) grid[y][x] = EMPTY;

      // Draw final path
      for (const p of path) {
        if (grid[p.y][p.x] !== SAT_START && grid[p.y][p.x] !== GOAL)
          grid[p.y][p.x] = FINAL_PATH;
      }
      drawGrid();

      document.getElementById('stat-path').textContent = `${path.length} STEPS`;
      setStatus('PATH FOUND', 'status-found');
      logEntry(`> [${getSimTime()}] Path found! ${path.length} steps. Rerouting...`, 'path');
      setPlannerStage(3, {
        plan: `Shortest safe path: ${path.length} grid steps`,
        route: `${satId}: lane ${startPos.y + 1} -> ${goalPos.y + 1}`,
      });
      setBarWidth('lane-path-bar', Math.min(100, path.length * 5));

      // Animate satellite movement
      await sleep(200);
      await animateSatMovement(path, sat);
      return path;
    }

    // Neighbors (4-directional)
    const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
    for (const d of dirs) {
      const nx = current.x + d.x, ny = current.y + d.y;
      if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
      if (grid[ny][nx] === DEBRIS_CELL) continue;
      const nKey = `${nx},${ny}`;
      if (closedSet.has(nKey)) continue;
      const ng = (gScore[key] || 0) + 1;
      if (ng < (gScore[nKey] || Infinity)) {
        gScore[nKey] = ng;
        const nh = heuristic({x:nx,y:ny}, goalPos);
        const existing = openSet.findIndex(n => n.x === nx && n.y === ny);
        if (existing >= 0) openSet.splice(existing, 1);
        openSet.push({ x:nx, y:ny, g:ng, h:nh, f:ng+nh, parent: current });
      }
    }
  }

  setStatus('NO PATH', 'status-none');
  logEntry(`> [${getSimTime()}] No valid path found!`, 'crit');
  isRunningAstar = false;
  document.getElementById('trigger-btn').disabled = false;
  return null;
}

async function animateSatMovement(path, sat) {
  activeRouteSat = sat;
  currentReroutePlan = path.map((node, index) => ({
    row: node.y,
    radius: rowToRadius(node.y),
    angle: normalizeAngle(sat.angle + sat.speed * index * 3.5),
  }));

  if (sat.rerouteArc) {
    scene.remove(sat.rerouteArc);
    sat.rerouteArc = null;
  }
  sat.orbitPivot.updateMatrixWorld(true);
  sat.mesh.updateMatrixWorld(true);
  const start = worldPos(sat.mesh);
  const finalNode = currentReroutePlan[currentReroutePlan.length - 1];
  const localEnd = new THREE.Vector3(
    Math.cos(finalNode.angle) * finalNode.radius,
    0,
    Math.sin(finalNode.angle) * finalNode.radius
  );
  const end = localEnd.applyMatrix4(sat.orbitPivot.matrixWorld);
  sat.rerouteArc = makeRerouteArc(start, end, 0xffab00);
  scene.add(sat.rerouteArc);

  for (let i = 0; i < path.length; i++) {
    const { x, y } = path[i];
    // Clear previous
    if (i > 0) {
      const prev = path[i-1];
      if (grid[prev.y][prev.x] === SAT_MOVING) grid[prev.y][prev.x] = FINAL_PATH;
    }
    if (grid[y][x] !== GOAL) grid[y][x] = SAT_MOVING;
    drawGrid();
    await sleep(100);
  }
  logEntry(`> [${getSimTime()}] ${sat.id} avoidance maneuver complete.`, 'path');
  maneuversExecuted++;
  successfulRoutes++;
  document.getElementById('db-man').textContent = maneuversExecuted;
  const navSummary = document.getElementById('nav-summary');
  if (navSummary) navSummary.textContent = `|  SYS ADAPTIVE  |  ROUTES ${successfulRoutes}`;
  setPlannerStage(3, { route: `${sat.id}: maneuver complete, route archived` });

  // Cleanup
  await sleep(500);
  for (let y = 0; y < GRID_SIZE; y++)
    for (let x = 0; x < GRID_SIZE; x++)
      if (grid[y][x] === FINAL_PATH || grid[y][x] === SAT_MOVING) grid[y][x] = EMPTY;
  grid[gridStart.y][gridStart.x] = SAT_START;
  grid[gridGoal.y][gridGoal.x] = GOAL;
  drawGrid();
  setStatus('IDLE', 'status-idle');
  document.getElementById('stat-nodes').textContent = '0';
  document.getElementById('stat-path').textContent = '--';
  const dbSafe = document.getElementById('db-safe');
  if (dbSafe) dbSafe.textContent = satellites.filter(s => s.status !== 'CRITICAL').length;
  isRunningAstar = false;
  document.getElementById('trigger-btn').disabled = false;
  activeRouteSat = null;
  setTimeout(() => {
    if (sat.rerouteArc) {
      scene.remove(sat.rerouteArc);
      sat.rerouteArc = null;
    }
  }, 2500);
}

// ═══════════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════════
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getSimTime() {
  const s = Math.floor((Date.now() - startTime) / 1000);
  const m = Math.floor(s / 60), sec = s % 60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function logEntry(text, cls = '') {
  const terminal = document.getElementById('log-terminal');
  const div = document.createElement('div');
  div.className = 'log-entry' + (cls ? ' ' + cls : '');
  div.textContent = text;
  terminal.appendChild(div);
  terminal.scrollTop = terminal.scrollHeight;
  // Keep last 80 entries
  while (terminal.children.length > 82) terminal.removeChild(terminal.children[1]);
}

function setStatus(text, cls) {
  const el = document.getElementById('algo-status');
  el.textContent = text;
  el.className = cls;
}

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
  let globalMin = Infinity;
  let riskPair = 'No close approach';

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
      if (dist < globalMin) {
        globalMin = dist;
        riskPair = `${sat.id} / debris-${j + 1}`;
      }
    }

    // Check against other satellites
    for (let j = 0; j < satellites.length; j++) {
      if (i === j) continue;
      const dist = satWP[i].distanceTo(satWP[j]);
      if (dist < minDist) minDist = dist;
      if (dist < globalMin) {
        globalMin = dist;
        riskPair = `${sat.id} / ${satellites[j].id}`;
      }
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

  const riskText = Number.isFinite(globalMin)
    ? `${riskPair}: ${globalMin.toFixed(2)}u`
    : 'Closest approach: stable';
  const riskLevel = critCount > 0 ? 'CRITICAL' : warnCount > 0 ? 'WARNING' : 'SAFE';
  if (!isRunningAstar) setPlannerStage(critCount > 0 ? 1 : 0, { risk: `${riskLevel} | ${riskText}` });
  else setText('risk-readout', `${riskLevel} | ${riskText}`);
  setBarWidth('lane-danger-bar', Number.isFinite(globalMin) ? Math.max(8, 100 - globalMin * 14) : 8);

  const riskSignature = `${riskLevel}:${riskPair}`;
  if (riskSignature !== lastRiskSignature && (critCount > 0 || warnCount > 0)) {
    logEntry(`> [${getSimTime()}] ${riskLevel}: nearest object ${riskText}`, critCount > 0 ? 'crit' : 'warn');
    lastRiskSignature = riskSignature;
  }

  // Auto-trigger A* if new critical
  if (critCount > lastCritCount && !isRunningAstar) {
    const critSat = satellites.find(s => s.status === 'CRITICAL');
    if (critSat) autoTriggerAstar(critSat.id);
  }
  lastCritCount = critCount;
}

function autoTriggerAstar(satId) {
  if (isRunningAstar) return;
  const sat = satellites.find(s => s.id === satId);
  if (!sat) return;
  randomizeGridPositions(sat);
  runAstar(gridStart, gridGoal, sat);
}

function randomizeGridPositions(sat) {
  buildPlannerGridForSatellite(sat);
  const plannerCopy = document.querySelector('.heuristic-row span:first-child');
  const plannerHint = document.querySelector('.heuristic-row span:last-child');
  if (plannerCopy) plannerCopy.textContent = `SAT ${sat.id} traverses future lane-time states`;
  if (plannerHint) plannerHint.textContent = `blocked: ${blockedCells} | goal lane: ${gridGoal.y + 1}`;
  drawGrid();
}

function findMostAtRiskSatellite() {
  let candidate = satellites[0];
  let bestDistance = Infinity;
  const satWP = satellites.map(s => worldPos(s.mesh));
  const debWP = debrisList.map(d => worldPos(d.mesh));

  for (let i = 0; i < satellites.length; i++) {
    let minDistance = Infinity;
    for (const debPos of debWP) minDistance = Math.min(minDistance, satWP[i].distanceTo(debPos));
    for (let j = 0; j < satWP.length; j++) {
      if (i !== j) minDistance = Math.min(minDistance, satWP[i].distanceTo(satWP[j]));
    }
    if (minDistance < bestDistance) {
      bestDistance = minDistance;
      candidate = satellites[i];
    }
  }
  return candidate;
}

function placeDebrisNearSatellite(sat, debrisIndex = 0, angularOffset = 0.12) {
  if (!debrisList[debrisIndex]) return;
  const d = debrisList[debrisIndex];
  d.radius = sat.radius + 0.08;
  d.angle = normalizeAngle(sat.angle + angularOffset);
  d.speed = sat.speed * 1.04;
  d.pivot.rotation.copy(sat.orbitPivot.rotation);
  d.mesh.position.set(
    Math.cos(d.angle) * d.radius,
    0,
    Math.sin(d.angle) * d.radius
  );
}

function loadScenario(type) {
  if (type === 'dense') {
    while (debrisList.length < 34) addDebris();
    satellites.forEach((sat, index) => {
      if (index < 3) placeDebrisNearSatellite(sat, index, 0.18 + index * 0.05);
    });
    setText('scenario-val', 'DENSE');
    logEntry(`> [${getSimTime()}] Scenario loaded: dense debris corridor.`, 'warn');
  } else if (type === 'clear') {
    while (debrisList.length > 8) removeDebris();
    debrisList.forEach((d, index) => {
      d.radius = 6 + (index % 6) * 0.8;
      d.angle = normalizeAngle(index * 0.78);
      d.speed = (index % 2 === 0 ? 1 : -1) * 0.009;
    });
    setText('scenario-val', 'CLEAR');
    logEntry(`> [${getSimTime()}] Scenario loaded: low-risk calibration orbit.`, 'info');
  } else {
    if (debrisList.length === 0) addDebris();
    placeDebrisNearSatellite(satellites[0], 0, 0.08);
    setText('scenario-val', 'CRIT');
    logEntry(`> [${getSimTime()}] Scenario loaded: SAT-1 close-approach event.`, 'crit');
    setTimeout(() => {
      if (!isRunningAstar) triggerAvoidance(satellites[0]);
    }, 300);
  }
  updateCountUI();
  checkCollisions();
  randomizeGridPositions(findMostAtRiskSatellite());
}

// Manual trigger
function triggerAvoidance(selectedSat = null) {
  if (isRunningAstar) return;
  const sat = selectedSat || findMostAtRiskSatellite();
  sat.status = 'CRITICAL';
  if (!sat.critSphere) {
    sat.critSphere = makeCritSphere(0.7);
    sat.mesh.add(sat.critSphere);
  }
  randomizeGridPositions(sat);
  logEntry(`> [${getSimTime()}] Manual override: ${sat.id} flagged CRITICAL`, 'crit');
  runAstar(gridStart, gridGoal, sat);
}
window.triggerAvoidance = triggerAvoidance;
window.loadScenario = loadScenario;

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

// ═══════════════════════════════════════════
//  MAIN ANIMATION LOOP
// ═══════════════════════════════════════════
let critSpherePhase = 0;

function animate() {
  requestAnimationFrame(animate);
  frameCount++;
  critSpherePhase += 0.05;

  // Respect pause
  if (isPaused) {
    renderer.render(scene, camera);
    return;
  }

  // Rotate earth
  earthGroup.rotation.y += 0.001 * speedMultiplier;
  clouds.rotation.y += 0.0003 * speedMultiplier;

  // Update satellites — local XZ of their orbital pivot → stays exactly on its ring
  for (const sat of satellites) {
    sat.angle += sat.speed * speedMultiplier;
    let renderRadius = sat.radius;
    if (activeRouteSat === sat && currentReroutePlan && currentReroutePlan.length > 1) {
      const routeIndex = Math.min(currentReroutePlan.length - 1, Math.floor((frameCount / 5) % currentReroutePlan.length));
      const routeNode = currentReroutePlan[routeIndex];
      renderRadius = routeNode.radius;
      sat.radius = renderRadius;
      sat.angle = routeNode.angle;
    }
    sat.mesh.position.set(
      Math.cos(sat.angle) * renderRadius,
      0,
      Math.sin(sat.angle) * renderRadius
    );
    sat.mesh.rotation.y += 0.02 * speedMultiplier;

    // Pulse critical sphere
    if (sat.critSphere) {
      sat.critSphere.material.opacity = 0.15 + 0.2 * Math.abs(Math.sin(critSpherePhase));
      const scale = 1 + 0.3 * Math.abs(Math.sin(critSpherePhase));
      sat.critSphere.scale.setScalar(scale);
    }
  }

  // Update debris — use unified debrisList
  for (const d of debrisList) {
    d.angle += d.speed * speedMultiplier;
    d.mesh.position.set(
      Math.cos(d.angle) * d.radius,
      0,
      Math.sin(d.angle) * d.radius
    );
    d.mesh.rotation.x += 0.03 * speedMultiplier;
    d.mesh.rotation.z += 0.02 * speedMultiplier;
  }

  // Collision check every frame
  if (frameCount % 4 === 0) checkCollisions();

  // Predictive every 60 frames
  if (frameCount % 60 === 0) predictiveAnalysis();

  renderer.render(scene, camera);
}

// ═══════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════
syncDebrisLists();
buildPlannerGridForSatellite(satellites[0]);
drawGrid();
updateCountUI();
setPlannerStage(0, {
  risk: 'SAFE | Closest approach: scanning',
  plan: `${blockedCells} blocked future cells in current grid`,
  route: 'Select a scenario or trigger avoidance',
});
logEntry(`> [${getSimTime()}] ASTRO-CTRL system initialized.`, 'info');
logEntry(`> [${getSimTime()}] Tracking ${satellites.length} satellites, 18 debris objects.`, 'info');
logEntry(`> [${getSimTime()}] A* pathfinding engine: READY.`, 'info');
logEntry(`> [${getSimTime()}] All systems nominal. Monitoring orbital space...`);

async function runLoadingSequence() {
  const loader = document.getElementById('loading-screen');
  if (window.location.hash.toLowerCase().includes('mission')) {
    loader.classList.add('hidden');
    loader.style.display = 'none';
    return;
  }
  const steps = [
    ['Loading starfield and mission controls...', 16],
    ['Configuring orbital lanes and hazard thresholds...', 38],
    ['Projecting future debris occupancy...', 64],
    ['Linking A* planner to live reroute logic...', 84],
    ['Mission console online.', 100],
  ];
  for (const [message, percent] of steps) {
    document.getElementById('loader-message').textContent = message;
    document.getElementById('loader-percent').textContent = `${percent}%`;
    document.getElementById('loader-fill').style.width = `${percent}%`;
    await sleep(percent === 100 ? 80 : 260);
  }
  loader.classList.add('hidden');
  loader.style.display = 'none';
}

animate();
runLoadingSequence().then(() => {
  const hash = window.location.hash.toLowerCase();
  if (hash.includes('mission')) setActiveView('sim-view');
  if (hash.includes('critical')) loadScenario('critical');
  else if (hash.includes('dense')) loadScenario('dense');
  setTimeout(() => {
    if (!isRunningAstar && !autoDemoTriggered) {
      autoDemoTriggered = true;
      logEntry(`> [${getSimTime()}] Mission console ready. Load Critical scenario for an instant reroute demo.`, 'info');
    }
  }, 1600);
});
