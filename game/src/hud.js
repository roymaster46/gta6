// Ember Harbor — HUD + minimap. A 2D canvas layered over the WebGL canvas:
// cash, health, wanted stars, weapon + ammo, mission objective, clock,
// district, speed, messages (toasts), and a circular minimap with the city
// streets, the player arrow, the objective and police blips.

import { DISTRICTS } from './config.js';
import { districtAt } from './world.js';
import { formatClock, formatMoney, formatTime, starsText } from './utils.js';

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  const toasts = [];
  let screen = 'title';

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function toast(text, ms) {
    toasts.push({ text, until: performance.now() + (ms || 3200) });
    if (toasts.length > 4) toasts.shift();
  }

  function bar(x, y, w, h, frac, color, bg) {
    ctx.fillStyle = bg || 'rgba(0,0,0,0.55)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * Math.max(0, Math.min(1, frac))), h - 2);
  }

  function text(str, x, y, size, color, align, bold) {
    ctx.font = `${bold ? '700' : '400'} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.fillStyle = color || '#fff';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  }

  function drawMinimap(state) {
    const W = window.innerWidth;
    const size = 168;
    const cx = W - size / 2 - 18;
    const cy = size / 2 + 18;
    const scale = size / 980;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(12,18,26,0.82)';
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    ctx.strokeStyle = 'rgba(200,205,214,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i += 1) {
      const c = -460 + i * 92;
      ctx.beginPath(); ctx.moveTo(cx + c * scale, cy - 490 * scale); ctx.lineTo(cx + c * scale, cy + 490 * scale); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 490 * scale, cy + c * scale); ctx.lineTo(cx + 490 * scale, cy + c * scale); ctx.stroke();
    }
    // Water strip on the east edge.
    ctx.fillStyle = 'rgba(29,78,107,0.9)';
    ctx.fillRect(cx + 460 * scale, cy - 490 * scale, size / 2, size);
    const px = state.player.x;
    const pz = state.player.z;
    const dot = (x, z, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx + x * scale, cy + z * scale, r || 3, 0, Math.PI * 2);
      ctx.fill();
    };
    if (state.objective) {
      const pulse = 4 + Math.sin(performance.now() / 220) * 1.5;
      dot(state.objective.x, state.objective.z, '#ffc233', pulse);
    }
    for (const cop of state.cops || []) dot(cop.x, cop.z, '#3b82f6', 3);
    for (const unit of state.copCars || []) dot(unit.car.x, unit.car.z, '#3b82f6', 4);
    if (state.fare && !state.fare.pickedUp) dot(state.fare.fromX, state.fare.fromZ, '#22d3ee', 4);
    if (state.fare && state.fare.pickedUp) dot(state.fare.toX, state.fare.toZ, '#22d3ee', 4);
    // Player arrow.
    ctx.save();
    ctx.translate(cx + px * scale, cy + pz * scale);
    ctx.rotate(state.player.heading);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
    // North tick.
    text('N', cx, cy - size / 2 - 2, 11, '#c8cdd6', 'center');
  }

  function draw(state) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    ctx.clearRect(0, 0, W, H);
    if (screen === 'title') {
      ctx.fillStyle = 'rgba(8,12,20,0.72)';
      ctx.fillRect(0, 0, W, H);
      text('EMBER HARBOR', W / 2, H * 0.2, 64, '#ffb347', 'center', true);
      text('An open-world crime story in a harbour city that never sleeps.', W / 2, H * 0.2 + 78, 20, '#e8e4da', 'center');
      text('You are Vex Marlowe — courier, driver, and the harbour\'s worst-kept secret.', W / 2, H * 0.2 + 108, 17, '#c8cdd6', 'center');
      const lines = [
        'WASD move  ·  Shift sprint  ·  Space jump  ·  Mouse drag to look',
        'E steal / enter car  ·  F shoot / punch  ·  N nitro  ·  C camera  ·  P pause',
        '1-4 weapons  ·  G garage  ·  M mute  ·  8 missions, taxi fares, hidden packages',
      ];
      lines.forEach((l, i) => text(l, W / 2, H * 0.42 + i * 30, 17, '#fff', 'center'));
      text('Press Enter or click to start', W / 2, H * 0.62, 22, '#ffc233', 'center', true);
      if (state.bestScore) text(`Best score: ${state.bestScore.toLocaleString()}`, W / 2, H * 0.68, 16, '#c8cdd6', 'center');
      return;
    }
    if (screen === 'over') {
      ctx.fillStyle = 'rgba(20,4,4,0.78)';
      ctx.fillRect(0, 0, W, H);
      text(state.deathKind === 'busted' ? 'BUSTED' : 'WASTED', W / 2, H * 0.3, 72, '#ff5544', 'center', true);
      text(`Score ${state.score.toLocaleString()}  ·  Cash ${formatMoney(state.player.cash)}`, W / 2, H * 0.3 + 92, 20, '#fff', 'center');
      text('Press Enter to try again', W / 2, H * 0.3 + 132, 20, '#ffc233', 'center', true);
      return;
    }

    // Top-left: cash, health, wanted.
    text(formatMoney(state.player.cash), 20, 16, 30, '#7dff8a', 'left', true);
    bar(20, 52, 210, 14, state.player.health / 100, state.player.health > 30 ? '#37d67a' : '#ff5544');
    text(`HP ${Math.ceil(state.player.health)}`, 238, 50, 14, '#fff');
    const stars = state.wanted.stars;
    text(starsText(stars), 20, 72, 24, '#ffb347');
    if (stars > 0) text(`${state.wanted.band} · ${state.wanted.notoriety}% notoriety`, 20, 100, 13, '#ffb347');

    // Top-centre: clock + district.
    const d = districtAt(state.player.x, state.player.z);
    text(`${formatClock(state.dayTime)}  ·  ${d.name}`, W / 2, 16, 19, '#fff', 'center', true);
    text(d.flavor, W / 2, 42, 13, '#c8cdd6', 'center');
    if (state.weather !== 'clear') text(`Weather: ${state.weather}`, W / 2, 62, 13, '#9fc3e8', 'center');

    // Mission panel, top-left under the vitals.
    if (state.mission) {
      const m = state.mission;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(18, 128, 330, 86);
      ctx.fillStyle = '#ffc233';
      ctx.fillRect(18, 128, 4, 86);
      text(`${m.name}  —  ${formatTime(m.timeLeft)}`, 32, 136, 16, '#ffc233', 'left', true);
      text(m.step, 32, 160, 14, '#fff');
      text(`Step ${m.stepIndex + 1}/${m.stepsTotal}  ·  Reward ${formatMoney(m.reward)}`, 32, 184, 13, '#c8cdd6');
    } else if (state.nextMission) {
      text(`Next job: ${state.nextMission.name} — find the marker`, 20, 132, 14, '#c8cdd6');
    }
    if (state.fare) {
      text(state.fare.pickedUp ? 'Fare aboard — take them to the cyan marker' : 'Fare waiting — pick them up at the cyan marker', 20, 220, 14, '#22d3ee');
    }

    // Bottom-left: weapon + ammo, car card.
    text(`${state.weaponName}  ${state.ammo}`, 20, H - 62, 18, '#fff', 'left', true);
    if (state.playerCar) {
      const car = state.playerCar;
      text(`${car.modelName}`, 20, H - 92, 15, '#c8cdd6');
      bar(20, H - 40, 180, 10, car.health / car.maxHealth, '#4fc3f7');
      bar(210, H - 40, 120, 10, car.nitro, '#f59e0b');
      text(`${Math.round(Math.abs(car.speed) * 3.6)} km/h`, 340, H - 44, 14, '#fff');
    }

    // Bottom-right: score + progress.
    text(`Score ${state.score.toLocaleString()}`, W - 20, H - 62, 18, '#fff', 'right', true);
    text(`Missions ${state.missionsDone}/8  ·  Packages ${state.packagesFound}/12  ·  Fares ${state.faresDone}`, W - 20, H - 36, 13, '#c8cdd6', 'right');

    drawMinimap(state);

    // Toasts, bottom-centre.
    const now = performance.now();
    for (let i = toasts.length - 1; i >= 0; i -= 1) {
      if (toasts[i].until < now) { toasts.splice(i, 1); continue; }
      text(toasts[i].text, W / 2, H - 130 - (toasts.length - 1 - i) * 26, 16, '#fff', 'center', true);
    }

    if (screen === 'paused') {
      ctx.fillStyle = 'rgba(8,12,20,0.66)';
      ctx.fillRect(0, 0, W, H);
      text('PAUSED', W / 2, H * 0.4, 54, '#fff', 'center', true);
      text('P to resume  ·  Enter to restart the run', W / 2, H * 0.4 + 70, 18, '#c8cdd6', 'center');
    }
  }

  return {
    draw,
    toast,
    setScreen(s) { screen = s; },
    getScreen() { return screen; },
  };
}

export { DISTRICTS };
