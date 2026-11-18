// render.js — draws Solmarina: the city, cars, people, effects, HUD,
// minimap and menus. Canvas 2D only, no image assets — all art is drawn.
// New in this revision: the day/night cycle. After dark the sky goes deep
// blue, windows light up warm yellow (deterministic per building, via
// hash2), street lamps glow, the player's headlights cut a cone through the
// dark, and the police helicopter shines a spotlight. The garage upgrade
// shop, the clock HUD and the nitro gauge are drawn here too.
import { clamp, lerp, dist, TAU, hash2 } from './utils.js';
import { WORLD, ROAD_W, LANDMARKS } from './city.js';
import { fmtMoney, fmtTime } from './utils.js';
import { missionObjectiveText, currentMissionDef, MIDNIGHT_CHECKPOINTS } from './missions.js';
import { phaseAt, clockLabel } from './daynight.js';
import { UPGRADES, upgradeLevel, upgradeCost } from './garage.js';
import { nitroReady, nitroActive } from './garage.js';

const SKY = '#ffd9a0';
const GRASS = '#8ec06a';
const GRASS2 = '#7ab35c';
const SAND = '#f2dd9e';
const OCEAN = '#2a7ab8';
const OCEAN2 = '#1f639e';
const ROAD = '#3d3d46';
const ROAD_LINE = '#e8d44a';
const SIDEWALK = '#b8b0a0';

export function drawWorld(ctx, game, view) {
  const { city, camera } = game;
  const vw = view.w, vh = view.h;
  const light = game.light ?? 1;
  ctx.save();
  // Sky gradient backdrop (visible past the world edge). At night the warm
  // sunset gradient deepens into dark blue.
  const sky = ctx.createLinearGradient(0, 0, 0, vh);
  if (light > 0.7) {
    sky.addColorStop(0, '#ffe9b8');
    sky.addColorStop(1, '#ffc98a');
  } else {
    sky.addColorStop(0, '#0a1230');
    sky.addColorStop(1, '#1a2a55');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, vw, vh);
  ctx.translate(-camera.x, -camera.y);

  const x0 = Math.max(0, camera.x - 60), y0 = Math.max(0, camera.y - 60);
  const x1 = Math.min(WORLD, camera.x + vw + 60), y1 = Math.min(WORLD, camera.y + vh + 60);

  // Ground: grass with a subtle checker of mowing stripes.
  ctx.fillStyle = GRASS;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = GRASS2;
  const stripe = 120;
  for (let sx = Math.floor(x0 / stripe) * stripe; sx < x1; sx += stripe * 2) {
    ctx.fillRect(sx, y0, stripe, y1 - y0);
  }
  // Beach + ocean along the south edge.
  ctx.fillStyle = SAND;
  ctx.fillRect(0, city.beach.y, WORLD, city.beach.h);
  ctx.fillStyle = OCEAN;
  ctx.fillRect(0, city.ocean.y, WORLD, city.ocean.h);
  ctx.fillStyle = OCEAN2;
  for (let i = 0; i < 12; i++) {
    const wy = city.ocean.y + 12 + i * 8;
    ctx.fillRect(0, wy, WORLD, 3);
  }
  // Wave lines on the sand.
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x < WORLD; x += 90) {
    ctx.moveTo(x, city.ocean.y + 2);
    ctx.quadraticCurveTo(x + 45, city.ocean.y - 8, x + 90, city.ocean.y + 2);
  }
  ctx.stroke();
  // Beach umbrellas + towels on Playa Sol.
  for (const ux of [300, 700, 1500, 1900, 2200]) {
    ctx.fillStyle = '#8a5a3a';
    ctx.fillRect(ux - 1, 2200, 3, 18);
    ctx.fillStyle = ux % 2 ? '#ff5a5a' : '#ffd94a';
    ctx.beginPath();
    ctx.arc(ux, 2200, 16, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#4ad8d0';
    ctx.fillRect(ux + 18, 2212, 22, 10);
  }
  // Beach kiosks: striped stalls that sell ice cream by day.
  for (const k of city.kiosks) {
    ctx.fillStyle = k.color;
    ctx.fillRect(k.x, k.y, k.w, k.h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(k.x, k.y, k.w, 8);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SNACKS', k.x + k.w / 2, k.y + k.h - 6);
  }

  // Park.
  const park = { x: 1050, y: 1350, w: 300, h: 300 };
  ctx.fillStyle = '#6aa84f';
  ctx.fillRect(park.x, park.y, park.w, park.h);
  ctx.fillStyle = '#5a9a8a';
  ctx.beginPath();
  ctx.ellipse(park.x + 150, park.y + 150, 52, 34, 0, 0, TAU);
  ctx.fill();
  // Plaza with benches, just north of the park.
  ctx.fillStyle = '#c8bfae';
  ctx.fillRect(city.plaza.x, city.plaza.y, city.plaza.w, city.plaza.h);
  ctx.fillStyle = '#8a6a4a';
  for (const b of city.plaza.benches) ctx.fillRect(b.x, b.y, 34, 10);

  // Roads.
  for (const rx of city.roadsV) {
    ctx.fillStyle = ROAD;
    ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD - 130);
    ctx.fillStyle = SIDEWALK;
    ctx.fillRect(rx - ROAD_W / 2 - 8, 0, 8, WORLD - 130);
    ctx.fillRect(rx + ROAD_W / 2, 0, 8, WORLD - 130);
  }
  for (const ry of city.roadsH) {
    ctx.fillStyle = ROAD;
    ctx.fillRect(0, ry - ROAD_W / 2, WORLD, ROAD_W);
    ctx.fillStyle = SIDEWALK;
    ctx.fillRect(0, ry - ROAD_W / 2 - 8, WORLD, 8);
    ctx.fillRect(0, ry + ROAD_W / 2, WORLD, 8);
  }
  // Centre dashes.
  ctx.strokeStyle = ROAD_LINE;
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  for (const rx of city.roadsV) {
    ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD - 130); ctx.stroke();
  }
  for (const ry of city.roadsH) {
    ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(WORLD, ry); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Billboards along the main roads.
  for (const b of city.billboards) {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.text, b.x + b.w / 2, b.y + 18);
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(b.sub, b.x + b.w / 2, b.y + 32);
  }

  // Port docks.
  ctx.fillStyle = '#8a6a4a';
  for (const d of city.docks) ctx.fillRect(d.x, d.y, d.w, d.h);
  // Getaway boat at the port, and the buyer's yacht at the marina (mission 6).
  drawBoat(ctx, LANDMARKS.boat.x, LANDMARKS.boat.y, game.time);
  drawBoat(ctx, LANDMARKS.yacht.x, LANDMARKS.yacht.y, game.time, { hull: '#f2e8c8', cabin: '#2a6a9a', scale: 1.35 });

  // Buildings with fake height shading. At night a deterministic subset of
  // windows glows warm yellow (same building, same lit windows, every night).
  const night = light < 0.6;
  for (const b of city.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    // Windows.
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        const wx = b.x + 10 + cx * 24, wy = b.y + 10 + cy * 24;
        const lit = night && hash2(wx, wy) < 0.45;
        ctx.fillStyle = lit ? '#ffd94a' : 'rgba(40,60,90,0.75)';
        ctx.fillRect(wx, wy, 12, 12);
      }
    }
    if (b.label) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5);
    }
  }
  // Trees (palm-ish circles with shadow).
  for (const t of city.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3f8a3f';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5aaa4a';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, TAU); ctx.fill();
  }
  // Street lamps.
  ctx.fillStyle = '#2a2a2a';
  for (const l of city.lamps) {
    if (l.x < x0 || l.x > x1 || l.y < y0 || l.y > y1) continue;
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
  }

  // Pickups.
  for (const pk of game.pickups) drawPickup(ctx, pk);
  // Mission / taxi target marker (pulsing). drawMissionMarker picks the
  // mission target while a mission is active, else the taxi marker.
  drawMissionMarker(ctx, game);
  // Gang members (with health bars).
  for (const g of game.gang) {
    if (g.dead) continue;
    drawPerson(ctx, g, '#c22a2a', '#2a2a2a', true);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(g.x - 14, g.y - 26, 28, 5);
    ctx.fillStyle = '#ff4a4a';
    ctx.fillRect(g.x - 14, g.y - 26, 28 * clamp(g.health / 100, 0, 1), 5);
  }
  // Peds.
  for (const p of game.peds) {
    if (p.dead) { drawDeadPed(ctx, p); continue; }
    drawPerson(ctx, p, p.shirt, p.skin, false);
  }
  // Cars (sorted so the player's car draws on top when overlapping).
  const cars = [...game.cars].sort((a, b) => (a === game.player.car ? 1 : 0) - (b === game.player.car ? 1 : 0));
  for (const car of cars) drawCar(ctx, car, game.time);
  // Police helicopter.
  if (game.heli) drawHeli(ctx, game.heli, game.time, light);
  // Cops on foot.
  for (const c of game.cops) {
    if (c.inCar) continue;
    drawPerson(ctx, c, '#1a3a6a', '#e8b4b8', true, 'POLICE');
  }
  // Player.
  if (!game.player.inCar) drawPlayer(ctx, game.player);
  else drawAimLine(ctx, game.player);
  // Bullets.
  for (const b of game.bullets) {
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.angle) * 12, b.y - Math.sin(b.angle) * 12);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Particles.
  drawParticles(ctx, game);
  // Night lighting: dark overlay, lamp glows, headlight cone, heli spotlight.
  if (light < 0.95) drawNight(ctx, game, view, light);
  ctx.restore();
}

// Night pass, drawn in world space after everything else: a dark blue
// overlay over the visible area, then additive light pools under every
// street lamp, a headlight cone from the player's car, and the helicopter's
// spotlight sweeping down onto Leo.
function drawNight(ctx, game, view, light) {
  const { camera } = game;
  const x0 = camera.x, y0 = camera.y;
  const x1 = camera.x + view.w, y1 = camera.y + view.h;
  const darkness = clamp((0.95 - light) / 0.6, 0, 1) * 0.55;
  ctx.fillStyle = `rgba(8,12,40,${darkness})`;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Lamp glows.
  for (const l of game.city.lamps) {
    if (l.x < x0 - 60 || l.x > x1 + 60 || l.y < y0 - 60 || l.y > y1 + 60) continue;
    const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, l.glow || 34);
    g.addColorStop(0, 'rgba(255,220,130,0.5)');
    g.addColorStop(1, 'rgba(255,220,130,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(l.x, l.y, l.glow || 34, 0, TAU); ctx.fill();
  }
  // Player headlights: a cone ahead of the car plus a small glow at the nose.
  const p = game.player;
  if (p.inCar && p.car) {
    const car = p.car;
    const nx = car.x + Math.cos(car.angle) * car.model.len * 0.5;
    const ny = car.y + Math.sin(car.angle) * car.model.len * 0.5;
    ctx.save();
    ctx.translate(nx, ny);
    ctx.rotate(car.angle);
    const grad = ctx.createLinearGradient(0, 0, 260, 0);
    grad.addColorStop(0, 'rgba(255,240,170,0.35)');
    grad.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(260, -70);
    ctx.lineTo(260, 70);
    ctx.lineTo(0, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Helicopter spotlight: a cone from the heli down onto the player.
  if (game.heli) {
    const heli = game.heli;
    const grad = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 130);
    grad.addColorStop(0, 'rgba(255,250,200,0.4)');
    grad.addColorStop(1, 'rgba(255,250,200,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(p.x, p.y, 130, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawHeli(ctx, heli, time, light) {
  ctx.save();
  ctx.translate(heli.x, heli.y);
  // Shadow on the ground far below (the heli hovers high).
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(6, 34, 26, 12, 0, 0, TAU); ctx.fill();
  // Body.
  ctx.fillStyle = '#1a3a6a';
  ctx.beginPath(); ctx.ellipse(0, 0, 26, 14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a5a9a';
  ctx.fillRect(-8, -6, 22, 12);
  // Tail.
  ctx.fillStyle = '#1a3a6a';
  ctx.fillRect(-46, -3, 24, 6);
  // Rotor (spins with heli.rotor).
  ctx.strokeStyle = 'rgba(200,200,200,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  const r = heli.rotor || 0;
  ctx.moveTo(Math.cos(r) * 34, Math.sin(r) * 6);
  ctx.lineTo(-Math.cos(r) * 34, -Math.sin(r) * 6);
  ctx.stroke();
  // Searchlight beam down to the player at night.
  ctx.restore();
  // HP bar while damaged.
  if (heli.hp < heli.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(heli.x - 24, heli.y - 34, 48, 6);
    ctx.fillStyle = '#ff4a4a';
    ctx.fillRect(heli.x - 24, heli.y - 34, 48 * clamp(heli.hp / heli.maxHp, 0, 1), 6);
  }
}

function drawBoat(ctx, x, y, time, style = {}) {
  const bob = Math.sin(time * 1.5) * 3;
  const s = style.scale || 1;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(s, s);
  ctx.fillStyle = style.hull || '#e8e8e8';
  ctx.beginPath();
  ctx.moveTo(-34, 0); ctx.lineTo(34, 0); ctx.lineTo(24, 16); ctx.lineTo(-24, 16);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = style.cabin || '#d84a4a';
  ctx.fillRect(-14, -18, 28, 18);
  ctx.restore();
}

function drawPickup(ctx, pk) {
  const bob = Math.sin(pk.bob) * 3;
  const colors = { health: '#e84a4a', armor: '#3a6fd8', smg: '#e8c832', shotgun: '#ff8a4a', cash: '#3ab86a' };
  ctx.save();
  ctx.translate(pk.x, pk.y + bob);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(0, 10 - bob, 12, 5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = colors[pk.kind] || '#fff';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'armor' ? 'A' : pk.kind === 'smg' ? 'S' : pk.kind === 'shotgun' ? 'G' : '$', 0, 4);
  ctx.restore();
}

function drawMarker(ctx, x, y, color, label) {
  const pulse = 1 + Math.sin(Date.now() / 280) * 0.12;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 0, -30);
  ctx.restore();
  // Ground beacon column.
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = color;
  ctx.fillRect(x - 3, y - 90, 6, 90);
  ctx.restore();
}

function drawMissionMarker(ctx, game) {
  const ms = game.missions;
  // An active story mission outranks a taxi fare everywhere (banner, world
  // marker, edge arrow): the taxi marker only shows when no mission runs.
  if (ms.stage === 'active' && ms.target) {
    drawMarker(ctx, ms.target.x, ms.target.y, '#ff4ad8', '★');
    // Mission 7 checkpoints: the next one pulses pink, done ones are green.
    if (ms.checkpoints) {
      ms.checkpoints.forEach((cp, i) => {
        if (cp.done) {
          ctx.fillStyle = '#3ab86a';
          ctx.beginPath(); ctx.arc(cp.x, cp.y, 10, 0, TAU); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('✓', cp.x, cp.y + 4);
        } else if (i === ms.checkpointIndex) {
          drawMarker(ctx, cp.x, cp.y, '#ff4ad8', String(i + 1));
        } else {
          ctx.strokeStyle = 'rgba(255,74,216,0.6)';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(cp.x, cp.y, 16, 0, TAU); ctx.stroke();
          ctx.fillStyle = 'rgba(255,74,216,0.8)';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(String(i + 1), cp.x, cp.y - 22);
        }
      });
    }
    return;
  }
  if (ms.taxi) {
    const t = ms.taxi;
    const dest = t.hasPassenger ? t.dropoff : t.pickup;
    drawMarker(ctx, dest.x, dest.y, t.hasPassenger ? '#e8c832' : '#4ad8d0', 'TAXI');
  }
}

function drawPerson(ctx, p, shirt, skin, armed, label) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle || 0);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(0, 2, 11, 8, 0, 0, TAU); ctx.fill();
  // Body.
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
  // Head.
  ctx.fillStyle = skin || '#e8b4b8';
  ctx.beginPath(); ctx.arc(4, 0, 6, 0, TAU); ctx.fill();
  // Gun.
  if (armed) {
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2, 12, 4);
  }
  ctx.restore();
  if (label) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, p.x, p.y - 18);
  }
}

function drawDeadPed(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(120,0,0,0.5)';
  ctx.beginPath(); ctx.ellipse(0, 0, 13, 9, 0.4, 0, TAU); ctx.fill();
  ctx.fillStyle = p.shirt;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 3, 12, 9, 0, 0, TAU); ctx.fill();
  // Leo: teal jacket, dark jeans.
  ctx.fillStyle = '#0e7a6a';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e8b48a';
  ctx.beginPath(); ctx.arc(5, 0, 6.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a2a2e';
  ctx.beginPath(); ctx.arc(6, -2, 6.5, Math.PI * 0.6, Math.PI * 1.6); ctx.fill();
  // Pistol.
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(9, -2, 13, 4);
  ctx.restore();
  // Name tag.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LEO', p.x, p.y - 20);
}

function drawAimLine(ctx, p) {
  // Short aim tick from the car toward the mouse.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.car.x, p.car.y);
  ctx.lineTo(p.car.x + Math.cos(p.angle) * 40, p.car.y + Math.sin(p.angle) * 40);
  ctx.stroke();
}

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const L = car.model.len, W = car.model.wid;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
  // Nitro flame licking out of the exhaust while boosting.
  if (car.boostUntil && time < car.boostUntil) {
    ctx.fillStyle = '#ff9a3c';
    ctx.beginPath();
    ctx.moveTo(-L / 2, -6);
    ctx.lineTo(-L / 2 - 18 - Math.random() * 8, 0);
    ctx.lineTo(-L / 2, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath();
    ctx.moveTo(-L / 2, -3);
    ctx.lineTo(-L / 2 - 10, 0);
    ctx.lineTo(-L / 2, 3);
    ctx.closePath();
    ctx.fill();
  }
  // Damage smoke.
  if (car.damage > 45) {
    ctx.fillStyle = 'rgba(80,80,80,0.5)';
    ctx.beginPath(); ctx.arc(-L / 4, 0, 6 + Math.sin(time * 9) * 2, 0, TAU); ctx.fill();
  }
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 7);
  ctx.fill();
  // Cabin / windshield.
  ctx.fillStyle = 'rgba(30,40,60,0.85)';
  roundRect(ctx, -L / 6, -W / 2 + 3, L / 3, W - 6, 4);
  ctx.fill();
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(L / 2 - 3, -W / 2 + 2, 3, 5);
  ctx.fillRect(L / 2 - 3, W / 2 - 7, 3, 5);
  // Brake lights.
  ctx.fillStyle = car.brakeLight ? '#ff2a2a' : '#7a1a1a';
  ctx.fillRect(-L / 2, -W / 2 + 2, 3, 5);
  ctx.fillRect(-L / 2, W / 2 - 7, 3, 5);
  // Police livery + light bar.
  if (car.kind === 'police') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-L / 4, -W / 2, L / 2, W);
    ctx.fillStyle = '#1a3a6a';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
    const flash = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2a2a' : '#2a6aff';
    ctx.fillRect(-6, -W / 2 - 2, 12, 4);
  }
  if (car.label) {
    ctx.rotate(-car.angle);
    ctx.fillStyle = '#ff4ad8';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼ ' + car.label, 0, -W / 2 - 10);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawParticles(ctx, game) {
  for (const pt of game.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- Garage shop ------------------------------------------------------------
// Full-screen shop overlay: three upgrade rows with price, owned level and
// the selected row; 1/2/3 buys, G/Esc closes. Drawn over the dimmed world.
export function drawShop(ctx, game, view) {
  const w = view.w, h = view.h;
  const p = game.player;
  ctx.save();
  ctx.fillStyle = 'rgba(8,14,28,0.72)';
  ctx.fillRect(0, 0, w, h);
  const pw = 460, ph = 320;
  const px = (w - pw) / 2, py = (h - ph) / 2;
  ctx.fillStyle = '#14202e';
  roundRect(ctx, px, py, pw, ph, 12); ctx.fill();
  ctx.strokeStyle = '#e8c832';
  ctx.lineWidth = 2;
  roundRect(ctx, px, py, pw, ph, 12); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('PAY-N-SPRAY — UPGRADE SHOP', w / 2, py + 38);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText(`Cash: ${fmtMoney(p.money)}  •  Car: ${p.car ? p.car.model.name : 'none'}`, w / 2, py + 62);
  const shop = game.shop;
  UPGRADES.forEach((def, i) => {
    const y = py + 92 + i * 62;
    const level = p.car ? upgradeLevel(p.car, def.id) : 0;
    const cost = upgradeCost(def, level);
    const selected = shop.selected === i;
    if (selected) {
      ctx.fillStyle = 'rgba(232,200,50,0.18)';
      roundRect(ctx, px + 16, y - 6, pw - 32, 52, 8); ctx.fill();
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = selected ? '#ffd94a' : '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`${i + 1}. ${def.name}`, px + 30, y + 16);
    ctx.fillStyle = '#c8d8e8';
    ctx.font = '13px sans-serif';
    ctx.fillText(def.desc, px + 30, y + 36);
    ctx.textAlign = 'right';
    if (cost === null) {
      ctx.fillStyle = '#3ab86a';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('MAXED', px + pw - 30, y + 24);
    } else {
      ctx.fillStyle = p.money >= cost ? '#fff' : '#ff6a6a';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`$${cost}`, px + pw - 30, y + 24);
    }
    // Owned-level pips.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e8c832';
    ctx.font = '14px sans-serif';
    ctx.fillText('●'.repeat(level) + '○'.repeat(def.max - level), px + pw - 30, y + 42);
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c8d8e8';
  ctx.font = '13px sans-serif';
  ctx.fillText('1 / 2 / 3 buy  •  ↑ ↓ select  •  G or Esc close', w / 2, py + ph - 18);
  ctx.restore();
}

// --- HUD --------------------------------------------------------------------
export function drawHUD(ctx, game, view) {
  const p = game.player;
  const w = view.w, h = view.h;
  ctx.save();
  // Top-left: health / armor bars + money.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 12, 12, 250, 74, 8); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('LEO MARÍN', 22, 32);
  ctx.fillStyle = '#e8c832';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(fmtMoney(p.money), 252, 32);
  ctx.textAlign = 'left';
  drawBar(ctx, 22, 40, 150, 10, p.health / 100, '#3ab86a');
  drawBar(ctx, 22, 54, 150, 10, p.armor / 100, '#3a6fd8');
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px sans-serif';
  ctx.fillText('HP', 176, 49);
  ctx.fillText('ARMOR', 176, 63);
  // Clock top-centre: sun/moon, phase name and the in-game time.
  const phase = phaseAt(game.clock ?? 0);
  const clockText = `${phase.name === 'Night' ? '☾' : '☀'}  ${phase.name}  ${clockLabel(game.clock ?? 0)}`;
  ctx.font = 'bold 14px sans-serif';
  const cw = ctx.measureText(clockText).width + 24;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, (w - cw) / 2, 12, cw, 30, 8); ctx.fill();
  ctx.fillStyle = '#ffe9a0';
  ctx.textAlign = 'center';
  ctx.fillText(clockText, w / 2, 32);
  // Wanted stars top-right.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, w - 190, 12, 178, 40, 8); ctx.fill();
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < game.wanted.stars ? '#ffd94a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', w - 168 + i * 32, 42);
  }
  // Objective banner under the stars.
  const obj = missionObjectiveText(game);
  ctx.font = 'bold 13px sans-serif';
  const ow = ctx.measureText(obj).width + 24;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(ctx, w - ow - 12, 60, ow, 28, 8); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'right';
  ctx.fillText(obj, w - 24, 79);
  // Speed when driving.
  if (p.inCar && p.car) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, w - 120, h - 64, 108, 52, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(Math.abs(p.car.speed) * 1.6)), w - 66, h - 32);
    ctx.font = '11px sans-serif';
    ctx.fillText('km/h  ' + p.car.model.name, w - 66, h - 18);
    // Nitro gauge above the speedometer (only on a car with the kit).
    if (p.car.upgrades && p.car.upgrades.nitro) {
      const ready = nitroReady(p.car, game.time);
      const boosting = nitroActive(p.car, game.time);
      const label = boosting ? 'NITRO!' : ready ? 'NITRO READY [N]' : 'NITRO RECHARGING';
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      roundRect(ctx, w - 190, h - 96, 178, 24, 8); ctx.fill();
      ctx.fillStyle = boosting ? '#ff9a3c' : ready ? '#ffd94a' : '#888';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, w - 101, h - 79);
    }
  }
  // Garage hint when driving near the Pay-n-Spray.
  if (p.inCar && p.car && dist(p.x, p.y, LANDMARKS.garage.x, LANDMARKS.garage.y) < 140) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const hint = 'Press G — Upgrade Shop';
    ctx.font = 'bold 13px sans-serif';
    const hw = ctx.measureText(hint).width + 20;
    roundRect(ctx, (w - hw) / 2, h - 140, hw, 28, 8); ctx.fill();
    ctx.fillStyle = '#ffd94a';
    ctx.textAlign = 'center';
    ctx.fillText(hint, w / 2, h - 121);
  }
  // Weapon + ammo bottom-left.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 12, h - 52, 190, 40, 8); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  const ammo = p.ammo[p.weapon] === Infinity ? '∞' : String(p.ammo[p.weapon]);
  ctx.fillText(p.weapon.toUpperCase() + '  •  ' + ammo, 22, h - 27);
  // Toast / mission message centre.
  if (game.missions.messageTimer > 0 && game.missions.message) {
    ctx.font = 'bold 15px sans-serif';
    const mw = Math.min(w - 40, ctx.measureText(game.missions.message).width + 28);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, (w - mw) / 2, 100, mw, 34, 8); ctx.fill();
    ctx.fillStyle = '#ffe9a0';
    ctx.textAlign = 'center';
    ctx.fillText(game.missions.message, w / 2, 122);
  }
  // Off-screen mission target: edge arrow + distance so the player can
  // always find the objective without opening the map. Same priority as the
  // banner and world marker: active mission first, taxi second.
  const target = (game.missions.stage === 'active' && game.missions.target)
    ? game.missions.target
    : (game.missions.taxi
      ? (game.missions.taxi.hasPassenger ? game.missions.taxi.dropoff : game.missions.taxi.pickup)
      : null);
  if (target) {
    const sx = target.x - game.camera.x, sy = target.y - game.camera.y;
    if (sx < 0 || sy < 0 || sx > w || sy > h) {
      const cx = w / 2, cy = h / 2;
      const a = Math.atan2(sy - cy, sx - cx);
      const ex = cx + Math.cos(a) * (Math.min(w, h) / 2 - 60);
      const ey = cy + Math.sin(a) * (Math.min(w, h) / 2 - 60);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = '#ff4ad8';
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ff4ad8';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(dist(game.player.x, game.player.y, target.x, target.y)) + 'm', ex, ey + 28);
    }
  }
  // Damage flash.
  if (p.hurtTimer > 0) {
    ctx.fillStyle = `rgba(255,0,0,${clamp(p.hurtTimer, 0, 0.15)})`;
    ctx.fillRect(0, 0, w, h);
  }
  drawMinimap(ctx, game, view);
  ctx.restore();
}

function drawBar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

function drawMinimap(ctx, game, view) {
  const size = 168;
  const x = view.w - size - 12;
  const y = view.h - size - 12;
  const scale = size / WORLD;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, x - 4, y - 4, size + 8, size + 8, 8); ctx.fill();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  // Land + ocean.
  ctx.fillStyle = '#5a8a4a';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#2a6a9a';
  ctx.fillRect(x, y + 2160 * scale, size, size);
  // Roads.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.5;
  for (const rx of game.city.roadsV) {
    ctx.beginPath(); ctx.moveTo(x + rx * scale, y); ctx.lineTo(x + rx * scale, y + size); ctx.stroke();
  }
  for (const ry of game.city.roadsH) {
    ctx.beginPath(); ctx.moveTo(x, y + ry * scale); ctx.lineTo(x + size, y + ry * scale); ctx.stroke();
  }
  const dot = (wx, wy, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x + wx * scale, y + wy * scale, r, 0, TAU); ctx.fill();
  };
  // Garage (upgrade shop) marker.
  dot(LANDMARKS.garage.x, LANDMARKS.garage.y, '#e8c832', 4);
  // Mission marker.
  if (game.missions.target && game.missions.stage === 'active') dot(game.missions.target.x, game.missions.target.y, '#ff4ad8', 5);
  if (game.missions.taxi) {
    const t = game.missions.taxi;
    const d = t.hasPassenger ? t.dropoff : t.pickup;
    dot(d.x, d.y, '#e8c832', 5);
  }
  for (const c of game.cops) dot(c.x, c.y, '#2a6aff', 3);
  for (const car of game.cars) if (car.kind === 'police') dot(car.x, car.y, '#2a6aff', 3);
  if (game.heli) dot(game.heli.x, game.heli.y, '#ff2a2a', 4);
  dot(game.player.x, game.player.y, '#fff', 4);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x + game.player.x * scale, y + game.player.y * scale, 5, 0, TAU); ctx.stroke();
  ctx.restore();
  // North label.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMARINA', x, y - 8);
}

// --- Menus ------------------------------------------------------------------
export function drawTitle(ctx, game, view) {
  const w = view.w, h = view.h;
  ctx.save();
  // Backdrop: draw the world dimmed behind the title.
  ctx.fillStyle = 'rgba(10,20,40,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMARINA', w / 2, h / 2 - 130);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('A sun-soaked open-world crime story', w / 2, h / 2 - 96);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#ffe9a0';
  const story = [
    'Leo Marín came back to Solmarina with $50 and a borrowed jacket.',
    'Drive fares, steal cars, dodge the PD — and pull the heist of the decade.',
    'Seven missions. One city. No rules but yours.',
  ];
  story.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 - 58 + i * 22));
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  const controls = 'WASD move / drive  •  SHIFT sprint  •  MOUSE aim, CLICK shoot  •  E enter car  •  F mission  •  G garage  •  N nitro  •  P pause  •  M mute  •  R restart';
  ctx.fillText(controls, w / 2, h / 2 + 34);
  // Best stats.
  const best = game.saveData;
  if (best && (best.missionsDone > 0 || best.bestMoney > 0)) {
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#c8e8ff';
    ctx.fillText(`Best: ${fmtMoney(best.bestMoney)}  •  Missions done: ${best.missionsDone}  •  Fares: ${best.faresDone}`, w / 2, h / 2 + 62);
  }
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 22px sans-serif';
  const pulse = 0.7 + Math.sin(Date.now() / 400) * 0.3;
  ctx.globalAlpha = pulse;
  ctx.fillText('CLICK TO START', w / 2, h / 2 + 110);
  ctx.globalAlpha = 1;
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('Original game — own city, characters and story. Not affiliated with any commercial game.', w / 2, h - 24);
  ctx.restore();
}

export function drawPause(ctx, game, view) {
  const w = view.w, h = view.h;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', w / 2, h / 2 - 60);
  ctx.font = '16px sans-serif';
  const p = game.player;
  ctx.fillText(`Money ${fmtMoney(p.money)}  •  Missions ${p.stats.missionsDone}/7  •  Fares ${p.stats.faresDone}  •  Time ${fmtTime(p.stats.playTime)}`, w / 2, h / 2 - 20);
  ctx.fillText('P resume  •  R restart  •  M mute  •  Click to resume', w / 2, h / 2 + 16);
  ctx.restore();
}

export function drawEndScreen(ctx, game, view, kind, lost) {
  const w = view.w, h = view.h;
  ctx.save();
  ctx.fillStyle = 'rgba(20,0,0,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'busted' ? '#6aa8ff' : '#ff4a4a';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED!' : 'WASTED', w / 2, h / 2 - 70);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText(`The Solmarina PD took ${fmtMoney(lost)} off you. You wake up at the ${kind === 'busted' ? 'hospital' : 'safehouse'}.`, w / 2, h / 2 - 30);
  const p = game.player;
  ctx.fillText(`Money ${fmtMoney(p.money)}  •  Missions ${p.stats.missionsDone}/7  •  Fares ${p.stats.faresDone}  •  Cars stolen ${p.stats.carsStolen}`, w / 2, h / 2 + 2);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('CLICK OR PRESS R TO GET BACK OUT THERE', w / 2, h / 2 + 46);
  ctx.restore();
}
