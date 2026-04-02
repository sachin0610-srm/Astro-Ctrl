// ═══════════════════════════════════════════
//  ASTRO-CTRL — A* Pathfinding Engine
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  A* ALGORITHM
// ═══════════════════════════════════════════
function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

async function runAstar(startPos, goalPos, satId) {
  isRunningAstar = true;
  document.getElementById('trigger-btn').disabled = true;
  setStatus('SCANNING', 'status-scanning');

  const nodeKey = (n) => `${n.x},${n.y}`;
  const openSet = [{ x: startPos.x, y: startPos.y, g: 0, h: heuristic(startPos, goalPos), f: heuristic(startPos, goalPos), parent: null }];
  const closedSet = new Set();
  const gScore = { [nodeKey(startPos)]: 0 };
  let nodesExplored = 0;

  logEntry(`> [${getSimTime()}] Satellite ${satId} risk: CRITICAL`, 'crit');
  logEntry(`> [${getSimTime()}] Activating A* pathfinder...`, 'info');
  await sleep(200);
  setStatus('COMPUTING', 'status-computing');

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

      // Animate satellite movement
      await sleep(200);
      await animateSatMovement(path, satId);
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

async function animateSatMovement(path, satId) {
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
  logEntry(`> [${getSimTime()}] ${satId} avoidance maneuver complete.`, 'path');
  maneuversExecuted++;
  document.getElementById('db-man').textContent = maneuversExecuted;

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
  isRunningAstar = false;
  document.getElementById('trigger-btn').disabled = false;
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

