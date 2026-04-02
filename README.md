# 🌌 ASTRO-CTRL — AI Space Traffic Control System

> Real-time 3D orbital simulation with A\* pathfinding collision avoidance

---

## 📁 Project Structure

```
astro-ctrl/
├── index.html          ← Main entry point
├── css/
│   └── style.css       ← All styles, CSS variables, animations
├── js/
│   ├── globals.js      ← Global state, constants, cell type enums
│   ├── simulation.js   ← Three.js 3D scene: Earth, satellites, debris, orbital pivots
│   ├── grid.js         ← 2D canvas grid setup & drawGrid() renderer
│   ├── astar.js        ← A* pathfinding algorithm + step animation
│   ├── controls.js     ← UI helpers, collision detection, add/remove objects, predictive analysis
│   └── main.js         ← Animation loop (RAF) + initialization sequence
└── README.md
```

---

## 🚀 How to Run

Just open `index.html` in any modern browser — no build tools, no install needed.

```bash
# Option 1: direct open
open index.html

# Option 2: local server (recommended to avoid CORS)
npx serve .
# or
python3 -m http.server 8080
```

---

## ⚙️ Features

| Feature | Description |
|---|---|
| 3D Orbital Simulation | Five satellites on unique tilted orbital planes using Three.js pivot groups |
| Debris Field | 18+ debris objects on independent orbital paths |
| A\* Pathfinding | Animated step-by-step on a 20×20 grid with Manhattan heuristic |
| Collision Detection | CRITICAL (<2.0 units) and WARNING (<4.0 units) with auto-trigger |
| Predictive Analysis | 30-frame lookahead for upcoming collision warnings |
| Live Controls | Speed slider (0.05×–5×), add/remove satellites & debris, pause/resume |

---

## 🛠️ Tech Stack

- **Three.js r128** — WebGL 3D rendering
- **Vanilla JS ES6** — async/await, classes, modules
- **CSS Custom Properties** — full design token system
- **HTML5 Canvas** — 2D A\* grid visualizer

---

## 🎨 Design System

```css
--space-black: #050a0f
--cyan:        #00e5ff   /* primary accent */
--amber:       #ffab00   /* path / alerts */
--green:       #00ff88   /* safe / goal */
--red:         #ff3d3d   /* critical / debris */
```

Fonts: **Orbitron** (headings) + **Share Tech Mono** (terminal/data)
