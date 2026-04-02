// ═══════════════════════════════════════════
//  ASTRO-CTRL — Global State & Constants
// ═══════════════════════════════════════════


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

// Cell types
const EMPTY = 0, DEBRIS_CELL = 1, SAT_START = 2, GOAL = 3,
      EXPLORED = 4, FINAL_PATH = 5, SAT_MOVING = 6;

let grid = [];
let gridStart = {x:1, y:1};
let gridGoal = {x:18, y:18};
let currentSatIndex = 0;

