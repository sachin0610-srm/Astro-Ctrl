// ═══════════════════════════════════════════
//  ASTRO-CTRL — 2D Grid (A* Visualizer Canvas)
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  2D GRID SETUP
// ═══════════════════════════════════════════
const gridCanvas = document.getElementById('grid-canvas');
const gc = gridCanvas.getContext('2d');

function initGrid() {
  grid = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    grid.push([]);
    for (let x = 0; x < GRID_SIZE; x++) {
      grid[y].push(EMPTY);
    }
  }
  // Random debris ~22%
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (Math.random() < 0.22) grid[y][x] = DEBRIS_CELL;
    }
  }
  // Clear start/goal areas
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const sy = gridStart.y + dy, sx = gridStart.x + dx;
    const gy = gridGoal.y + dy, gx = gridGoal.x + dx;
    if (sy>=0&&sy<GRID_SIZE&&sx>=0&&sx<GRID_SIZE) grid[sy][sx] = EMPTY;
    if (gy>=0&&gy<GRID_SIZE&&gx>=0&&gx<GRID_SIZE) grid[gy][gx] = EMPTY;
  }
  grid[gridStart.y][gridStart.x] = SAT_START;
  grid[gridGoal.y][gridGoal.x] = GOAL;
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

