# 🌌 ASTRO-CTRL — AI Space Traffic Control

A browser-based AI orbital traffic control simulation that uses **A\* pathfinding** to reroute satellites around debris in real time.

Built with **Three.js** for the 3D orbital scene and a custom Canvas 2D renderer for the A\* planning grid.

---

## 📁 File Structure

```
astro-ctrl/
├── index.html   — App shell, navigation, and all UI markup
├── style.css    — All styles (variables, layout, HUD, panels, animations)
└── script.js    — Three.js scene, A* algorithm, simulation logic
```

---

## 🚀 Features

- **3D Orbital Simulation** — Earth with tilted satellite orbits and randomized debris fields rendered via Three.js
- **A\* Pathfinding Engine** — Builds a live time-expanded grid from projected orbital occupancy and searches for a safe reroute corridor
- **Collision Detection** — Per-frame proximity checks flag satellites as SAFE / WARNING / CRITICAL
- **Predictive Analysis** — Forecasts future satellite–debris convergences and logs warnings
- **Scenario Console** — Load clear, dense, or critical orbital conditions for repeatable project demonstrations
- **Visual Route Diagram** — Shows detect → plan → execute state, blocked cells, shortest path length, and active reroute summary
- **Simulation Controls** — Add/remove satellites and debris, adjust orbit speed, pause/resume
- **Tab Navigation** — Home → Mission Console → System Notes
- **Loading Sequence** — Animated boot screen before the mission console appears

---

## 🛠 How to Run

No build step required — just open `index.html` in any modern browser.

```bash
# Option 1: Open directly
open index.html

# Option 2: Serve locally (recommended to avoid CORS on fonts)
npx serve .
# or
python3 -m http.server 8080
```

Demo shortcut:

```
index.html#mission-critical
```

When served locally, `/#mission-critical` opens the Mission console and loads a close-approach scenario automatically.

---

## 🧠 Algorithm

The A\* planner builds a **20×20 grid** where:
- **X-axis** = time steps (future ticks)
- **Y-axis** = orbital lane (mapped from radius)
- **Blocked cells** = predicted debris/satellite occupancy at each future tick

Heuristic: Manhattan distance `h(n) = |Δx| + |Δy|`

A successful path is fed back as an active reroute, visibly changing the satellite's orbit in the 3D scene.

---

## 🎓 Built For

AI Course Project — SRMIST KTR  
Subject: Artificial Intelligence (21CSC305J)  
Team: **Null_Point** | CINTEL Department
