// ═══════════════════════════════════════════
//  ASTRO-CTRL — 3D Simulation (Three.js)
//  Earth, Satellites, Debris, Orbital Pivots
// ═══════════════════════════════════════════

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

