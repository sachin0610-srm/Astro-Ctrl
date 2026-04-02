// ═══════════════════════════════════════════
//  ASTRO-CTRL — Main Animation Loop & Init
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  MAIN ANIMATION LOOP
// ═══════════════════════════════════════════
let critSpherePhase = 0;

function animate() {
  requestAnimationFrame(animate);
  frameCount++;
  critSpherePhase += 0.05;

  // Rotate earth
  earthGroup.rotation.y += 0.001 * speedMultiplier;
  clouds.rotation.y += 0.0003 * speedMultiplier;

  // Respect pause
  if (isPaused) {
    renderer.render(scene, camera);
    return;
  }

  // Update satellites — local XZ of their orbital pivot → stays exactly on its ring
  for (const sat of satellites) {
    sat.angle += sat.speed * speedMultiplier;
    sat.mesh.position.set(
      Math.cos(sat.angle) * sat.radius,
      0,
      Math.sin(sat.angle) * sat.radius
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
initGrid();
drawGrid();
updateCountUI();
logEntry(`> [${getSimTime()}] ASTRO-CTRL system initialized.`, 'info');
logEntry(`> [${getSimTime()}] Tracking ${satellites.length} satellites, 18 debris objects.`, 'info');
logEntry(`> [${getSimTime()}] A* pathfinding engine: READY.`, 'info');
logEntry(`> [${getSimTime()}] All systems nominal. Monitoring orbital space...`);

// Auto-trigger first demo after 3 seconds
setTimeout(() => {
  if (!isRunningAstar) {
    logEntry(`> [${getSimTime()}] Auto-demo: Triggering test avoidance...`, 'warn');
    triggerAvoidance();
  }
}, 3000);

animate();
