// SOLARA BAY — Three.js open-world crime game. All art procedural, all sound synthesized.
import {
  newGameState, MISSIONS, WEAPONS, CARS, RADIO_STATIONS, CREW, DISTRICTS,
  rankFor, nextRankFor, districtAt, availableMissions, nextMission, startMission,
  activeMissionDef, activeStage, progressMission, addWanted, decayWanted,
  policeForWanted, payBribe, fireWeapon, takeDamage, heal, buyWeapon, buyArmor,
  buyCar, buyUpgrade, repairCar, stealCar, advanceTime, sleepUntilMorning,
  isNight, stormIntensity, hoursToLandfall, doSideJob, winRace, recruitCrew,
  setRadio, serialize, deserialize, isStoryComplete, completionPercent, carStats,
  SAVE_KEY, CITY_SIZE,
} from './logic.js';
import { City } from './world.js';
import { AudioEngine } from './audio.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

export const state = newGameState();
const audio = new AudioEngine();

// ---------- Shot mode (for screenshots): ?shot=day|night|mission|chase ----------
const params = new URLSearchParams(location.search);
export const shotMode = params.get('shot') || null;
if (shotMode === 'night') { state.timeOfDay = 22.5; state.day = 3; }
if (shotMode === 'mission') { state.day = 2; state.timeOfDay = 17; startMission(state, 'm3'); }
if (shotMode === 'chase') { state.timeOfDay = 17.5; state.day = 4; addWanted(state, 4); state.money = 5400; state.respect = 700; }
if (shotMode === 'day') { state.timeOfDay = 10; state.day = 1; }

// ---------- Renderer / scene ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d6);
scene.fog = new THREE.Fog(0x87b5d6, 220, 900);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2000);
const sun = new THREE.DirectionalLight(0xffe8b0, 1.6);
sun.position.set(200, 300, 100);
sun.castShadow = true;
sun.shadow.camera.left = -300; sun.shadow.camera.right = 300;
sun.shadow.camera.top = 300; sun.shadow.camera.bottom = -300;
scene.add(sun);
scene.add(new THREE.AmbientLight(0x8090a8, 0.7));
const moon = new THREE.DirectionalLight(0x8fa8ff, 0.35);
moon.position.set(-150, 250, -100);
scene.add(moon);

const city = new City(scene);

// ---------- Player ----------
const player = {
  x: -40, z: 220, angle: 0, speed: 0, inCar: null, vy: 0, y: 0,
  mesh: null, lastShot: 0, holdT: 0,
};
function makePerson(color, shirt) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.5), new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32), new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
  head.position.y = 2.0; g.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.45), new THREE.MeshLambertMaterial({ color: 0x2a2f3a }));
  legs.position.y = 0.4; g.add(legs);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.7), new THREE.MeshLambertMaterial({ color }));
  cap.position.y = 2.28; g.add(cap);
  return g;
}
player.mesh = makePerson(0x2e8b6a, 0x2e8b6a);
player.mesh.position.set(player.x, 0, player.z);
scene.add(player.mesh);

// ---------- Cars ----------
function makeCarMesh(color, isPolice = false) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.9, 2), new THREE.MeshLambertMaterial({ color }));
  body.position.y = 0.7; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.8), new THREE.MeshLambertMaterial({ color: 0x1a2028 }));
  cabin.position.set(-0.2, 1.5, 0); g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[1.5, 1], [1.5, -1], [-1.5, 1], [-1.5, -1]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2; w.position.set(wx, 0.42, wz);
    g.add(w);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    bar.position.set(-0.2, 2.05, 0); bar.name = 'lightbar'; g.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.45, 0.3, 2.05), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.9; g.add(stripe);
  }
  return g;
}

const cars = []; // {mesh, x, z, angle, speed, kind, hp, driver, parked, color, id}
function spawnCar(kind, x, z, angle = 0, carId = 'sedan') {
  const def = CARS[carId] || CARS.sedan;
  const mesh = makeCarMesh(kind === 'police' ? 0x1a2a4a : def.color, kind === 'police');
  mesh.position.set(x, 0, z);
  mesh.rotation.y = angle;
  scene.add(mesh);
  const c = { mesh, x, z, angle, speed: 0, kind, hp: 100, driver: kind !== 'parked', parked: kind === 'parked', carId, nitro: 0, nitroCd: 0 };
  cars.push(c);
  return c;
}
// Parked cars around the city
const parkedSpots = [[-120, 180], [60, -120], [-300, 60], [180, 180], [-60, -300], [300, 60], [60, 300], [-180, -180]];
const parkedIds = ['sedan', 'coupe', 'beater', 'sedan', 'muscle', 'van', 'coupe', 'sedan'];
parkedSpots.forEach(([x, z], i) => spawnCar('parked', x, z, rand(0, Math.PI * 2), parkedIds[i]));
// Traffic
const traffic = [];
for (let i = 0; i < 12; i++) {
  const vertical = i % 2 === 0;
  const road = -CITY_SIZE / 2 + 55 + Math.floor(rand(0, 8)) * 110;
  const c = spawnCar('traffic', vertical ? road : rand(-400, 400), vertical ? rand(-400, 400) : road, vertical ? (rand() < 0.5 ? 0 : Math.PI) : (rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2), ['sedan', 'beater', 'van', 'coupe'][i % 4]);
  c.speed = rand(8, 14);
  traffic.push(c);
}
// Police
const police = [];
function spawnPolice() {
  const need = policeForWanted(state.wanted).cars;
  while (police.length < need) {
    const a = rand(0, Math.PI * 2);
    const c = spawnCar('police', player.x + Math.cos(a) * 60, player.z + Math.sin(a) * 60, a, 'sedan');
    c.speed = 0;
    police.push(c);
  }
  while (police.length > need) {
    const c = police.pop();
    scene.remove(c.mesh);
    const idx = cars.indexOf(c);
    if (idx >= 0) cars.splice(idx, 1);
  }
}
// Helicopter
const heli = { mesh: null, active: false, x: 0, y: 60, z: 0, angle: 0 };
{
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 2.4), new THREE.MeshLambertMaterial({ color: 0x22304a }));
  g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, 0.8), new THREE.MeshLambertMaterial({ color: 0x22304a }));
  tail.position.set(-5, 0.4, 0); g.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.15, 0.6), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  rotor.position.y = 1.4; rotor.name = 'rotor'; g.add(rotor);
  const spot = new THREE.SpotLight(0xffffff, 2, 120, 0.4);
  spot.position.set(0, -1, 2);
  g.add(spot);
  g.visible = false;
  scene.add(g);
  heli.mesh = g;
}

// ---------- Pedestrians ----------
const peds = [];
for (let i = 0; i < 16; i++) {
  const mesh = makePerson([0xc23b4e, 0x3f6fb5, 0xe8a020, 0x8a5a2e][i % 4], [0xc23b4e, 0x3f6fb5, 0xe8a020, 0x8a5a2e][i % 4]);
  const x = rand(-400, 400), z = rand(-400, 400);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  peds.push({ mesh, x, z, angle: rand(0, Math.PI * 2), speed: rand(1, 2.2), panic: 0 });
}

// ---------- Enemies (combat targets) ----------
const enemies = [];
function spawnEnemies(count, districtId) {
  const d = DISTRICTS.find((x) => x.id === districtId) || DISTRICTS[4];
  for (let i = 0; i < count; i++) {
    const mesh = makePerson(0x111111, 0x8a1a1a);
    const x = d.x + rand(20, d.w - 20), z = d.z + rand(20, d.h - 20);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    enemies.push({ mesh, x, z, hp: 60, angle: 0, shootCd: rand(1, 2) });
  }
}
function clearEnemies() {
  for (const e of enemies) scene.remove(e.mesh);
  enemies.length = 0;
}

// ---------- Rain particles ----------
const rainGeo = new THREE.BufferGeometry();
const rainCount = 1200;
const rainPos = new Float32Array(rainCount * 3);
for (let i = 0; i < rainCount; i++) {
  rainPos[i * 3] = rand(-300, 300); rainPos[i * 3 + 1] = rand(0, 80); rainPos[i * 3 + 2] = rand(-300, 300);
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0x9fb8d8, size: 0.35, transparent: true, opacity: 0.7 }));
rain.visible = false;
scene.add(rain);

// ---------- Input ----------
const keys = {};
let mouseDown = false, lastMX = 0, camYaw = Math.PI, camPitch = 0.45;
addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === ' ') e.preventDefault();
  if (e.key.toLowerCase() === 'e') tryInteract();
  if (e.key.toLowerCase() === 'q') toggleWeaponWheel();
  if (e.key.toLowerCase() === 'r') cycleRadio();
  if (e.key.toLowerCase() === 'm') toggleMissionPanel();
  if (e.key.toLowerCase() === 'p' || e.key === 'Escape') togglePause();
  if (e.key.toLowerCase() === 'b') toggleShop();
  if (e.key.toLowerCase() === 'g') trySafehouse();
  if (e.key.toLowerCase() === 'v') startSideJob('vigilante');
  if (e.key.toLowerCase() === 'n') useNitro();
  if (['1', '2', '3', '4', '5'].includes(e.key)) selectWeaponSlot(Number(e.key));
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousedown', (e) => { mouseDown = true; lastMX = e.clientX; audio.ensure(); });
addEventListener('mouseup', () => { mouseDown = false; });
addEventListener('mousemove', (e) => {
  if (!mouseDown) return;
  camYaw -= (e.clientX - lastMX) * 0.005;
  lastMX = e.clientX;
});
canvas.addEventListener('click', () => { audio.ensure(); tryShoot(); });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- Shooting ----------
function tryShoot() {
  if (paused || player.inCar) return;
  const now = performance.now() / 1000;
  const w = WEAPONS[state.weapon];
  if (now - player.lastShot < 1 / w.rate) return;
  player.lastShot = now;
  const res = fireWeapon(state);
  if (!res.ok) { flash(`No ammo — press B to buy more`); audio.fail(); return; }
  audio.gunshot(state.weapon);
  muzzleFlash();
  // hit test: nearest enemy within range and roughly ahead
  let best = null, bestD = Infinity;
  for (const e of enemies) {
    const dx = e.x - player.x, dz = e.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d > res.range) continue;
    const ang = Math.atan2(dx, dz);
    let diff = Math.abs(((ang - player.angle) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
    if (diff < 0.5 && d < bestD) { best = e; bestD = d; }
  }
  if (best) {
    best.hp -= res.damage;
    if (best.hp <= 0) {
      state.kills += 1;
      scene.remove(best.mesh);
      enemies.splice(enemies.indexOf(best), 1);
      addWanted(state, 1);
      progressMission(state, { kind: 'kill' });
      checkMissionAdvance();
      flash(`Target down — ${state.kills} total`);
    }
  }
  updateHUD();
}
function muzzleFlash() {
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.5), new THREE.MeshBasicMaterial({ color: 0xffe28a }));
  const fx = player.x + Math.sin(player.angle) * 1.2, fz = player.z + Math.cos(player.angle) * 1.2;
  f.position.set(fx, 1.4, fz);
  scene.add(f);
  setTimeout(() => scene.remove(f), 60);
}

// ---------- Interaction ----------
let paused = false;
let flashTimer = null;
function flash(msg) {
  const el = $('flash');
  if (!el) return;
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { el.style.opacity = '0'; }, 2600);
}

function nearestCar(maxD = 7) {
  let best = null, bestD = maxD;
  for (const c of cars) {
    if (c.kind === 'traffic') continue;
    const d = Math.hypot(c.x - player.x, c.z - player.z);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}

function tryInteract() {
  if (paused) return;
  audio.ensure();
  if (player.inCar) { exitCar(); return; }
  const stage = activeStage(state);
  // Hold-to-complete mission stages
  if (stage && stage.kind === 'hold') {
    const d = districtAt(player.x, player.z);
    if (d && d.id === stage.target) {
      player.holdT += 1;
      flash(`Working… ${Math.min(100, player.holdT * 10)}%`);
      if (player.holdT >= 10) {
        player.holdT = 0;
        progressMission(state, { kind: 'hold', district: stage.target });
        checkMissionAdvance();
      }
      return;
    }
  }
  // Mission goto arrival is checked in the loop; E also triggers steal stage
  const car = nearestCar();
  if (car) {
    if (car.kind === 'parked') {
      enterCar(car);
      if (state.missionActive) {
        const st = activeStage(state);
        if (st && st.kind === 'steal') { progressMission(state, { kind: 'steal', district: districtAt(player.x, player.z)?.id }); checkMissionAdvance(); }
      }
      return;
    }
    if (car.kind === 'police') { flash('That car belongs to the Bayfront PD. Nice try.'); return; }
  }
  // Mission start trigger
  const m = nextMission(state);
  if (m && !state.missionActive) {
    const res = startMission(state, m.id);
    if (res.ok) {
      audio.mission();
      flash(`Mission started: ${m.title} — ${m.brief}`);
      if (m.stages[0].kind === 'combat') spawnEnemies(m.stages[0].count ?? 3, m.stages[0].target);
      updateHUD();
    }
  }
}

function enterCar(car) {
  player.inCar = car;
  car.driver = true;
  car.parked = false;
  player.mesh.visible = false;
  audio.engine(true, 0);
  flash(`${carStats(state, car.carId)?.name || 'Car'} — WASD to drive, Shift handbrake, N nitro, E to exit`);
}
function exitCar() {
  const car = player.inCar;
  if (!car) return;
  player.inCar = null;
  player.x = car.x + Math.sin(car.angle + Math.PI / 2) * 3;
  player.z = car.z + Math.cos(car.angle + Math.PI / 2) * 3;
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
  audio.engine(false);
}
function useNitro() {
  const car = player.inCar;
  if (!car) return;
  const owned = state.cars[car.carId];
  const hasNitro = owned?.upgrades?.includes('nitro') || state.crew.includes('jax');
  if (!hasNitro) { flash('No nitro kit — buy one at Otis garage (G near garage)'); return; }
  if (car.nitroCd > 0) return;
  car.nitro = state.crew.includes('jax') ? 3.6 : 2.6;
  car.nitroCd = 8;
  audio.blip(1200, 0.3, 'sawtooth', 0.3);
}
function stealNearestParked() {
  const car = nearestCar();
  if (car && car.kind === 'parked') {
    stealCar(state);
    enterCar(car);
    updateHUD();
  }
}

// ---------- Missions ----------
function checkMissionAdvance() {
  const m = activeMissionDef(state);
  if (!m) return;
  // combat stage spawn
  const stage = activeStage(state);
  if (stage && stage.kind === 'combat' && enemies.length === 0) {
    spawnEnemies(stage.count ?? 3, stage.target);
  }
  updateHUD();
}
function completeCheck() {
  if (isStoryComplete(state) && !$('win').classList.contains('show')) {
    $('win').classList.add('show');
    audio.mission();
  }
}
function checkArrivals() {
  const stage = activeStage(state);
  if (!stage) return;
  const d = districtAt(player.x, player.z);
  if (!d) return;
  if (stage.kind === 'goto' && d.id === stage.target) {
    const res = progressMission(state, { kind: 'arrive', district: d.id });
    if (res.done) {
      audio.cash();
      flash(`Mission complete: ${res.mission.title} — +$${res.mission.reward}, +${res.mission.respect} respect`);
      completeCheck();
    } else if (res.advanced) {
      audio.mission();
      flash(`Next: ${activeStage(state)?.text || ''}`);
      checkMissionAdvance();
    }
    updateHUD();
  }
  if (stage.kind === 'evade' && state.wanted === 0) {
    const res = progressMission(state, { kind: 'evade' });
    if (res.done) { audio.cash(); flash(`Mission complete: ${res.mission.title}`); completeCheck(); }
    else if (res.advanced) flash(`Next: ${activeStage(state)?.text || ''}`);
    updateHUD();
  }
}

// ---------- Weapons / radio / jobs ----------
function selectWeaponSlot(n) {
  const ids = Object.keys(WEAPONS);
  const id = ids[n - 1];
  if (id && state.weapons[id]?.owned) { state.weapon = id; audio.click(); updateHUD(); }
}
function toggleWeaponWheel() {
  const owned = Object.keys(WEAPONS).filter((id) => state.weapons[id]?.owned);
  const i = owned.indexOf(state.weapon);
  state.weapon = owned[(i + 1) % owned.length];
  flash(`Weapon: ${WEAPONS[state.weapon].name}`);
  audio.click();
  updateHUD();
}
function cycleRadio() {
  const st = setRadio(state, state.radio + 1);
  audio.startRadio(state.radio);
  flash(`Radio: ${st.name}`);
}
function startSideJob(jobId) {
  const res = doSideJob(state, jobId);
  if (res.ok) { audio.cash(); flash(`Job done: +$${res.pay}`); updateHUD(); }
}

// ---------- Safehouse / shops ----------
const SAFEHOUSES = [{ x: -40, z: 220, name: 'Palm Court safehouse' }, { x: -260, z: -300, name: 'Old Town safehouse' }];
function trySafehouse() {
  for (const s of SAFEHOUSES) {
    if (Math.hypot(player.x - s.x, player.z - s.z) < 18) {
      if (state.money >= 50 && state.health < 100) {
        state.money -= 50; heal(state, 100);
        flash('Healed at the safehouse (-$50)');
      } else {
        const day = sleepUntilMorning(state);
        flash(`Slept until morning — Day ${day} of 7. Hurricane Vera is closer.`);
        audio.mission();
      }
      updateHUD();
      return;
    }
  }
  // Garage is at Crosstown
  if (Math.hypot(player.x - -300, player.z - 220) < 20) { toggleGarage(); return; }
  flash('No safehouse here — look for the blue house with the red roof.');
}
function toggleShop() {
  const el = $('shop');
  el.classList.toggle('show');
  if (el.classList.contains('show')) renderShop();
}
function renderShop() {
  const el = $('shop-list');
  el.innerHTML = '';
  for (const [id, w] of Object.entries(WEAPONS)) {
    if (id === 'fists') continue;
    const owned = state.weapons[id]?.owned;
    const row = document.createElement('div');
    row.className = 'shop-row';
    row.innerHTML = `<span>${w.name} — ${w.damage} dmg</span><span>${owned ? `ammo ${state.weapons[id].ammo} — top up $${Math.round(w.price * 0.25)}` : `$${w.price}`}</span>`;
    row.onclick = () => {
      const r = buyWeapon(state, id);
      flash(r.ok ? `Bought ${w.name}` : r.error);
      if (r.ok) audio.cash();
      renderShop(); updateHUD();
    };
    el.appendChild(row);
  }
  const armor = document.createElement('div');
  armor.className = 'shop-row';
  armor.innerHTML = `<span>Kevlar Vest (+50 armor)</span><span>$200</span>`;
  armor.onclick = () => { const r = buyArmor(state); flash(r.ok ? 'Armor up' : r.error); updateHUD(); };
  el.appendChild(armor);
  for (const c of CREW) {
    if (state.crew.includes(c.id)) continue;
    const row = document.createElement('div');
    row.className = 'shop-row';
    row.innerHTML = `<span>Recruit ${c.name} — ${c.role} (${c.perk})</span><span>$${{ luma: 800, otis: 600, mara: 1500 }[c.id] ?? 0}</span>`;
    row.onclick = () => { const r = recruitCrew(state, c.id); flash(r.ok ? `${c.name} joined the crew!` : r.error); renderShop(); updateHUD(); };
    el.appendChild(row);
  }
}
function toggleGarage() {
  const el = $('garage');
  el.classList.toggle('show');
  if (el.classList.contains('show')) renderGarage();
}
function renderGarage() {
  const el = $('garage-list');
  el.innerHTML = '';
  for (const [id, c] of Object.entries(CARS)) {
    const owned = state.cars[id]?.owned;
    const row = document.createElement('div');
    row.className = 'shop-row';
    row.innerHTML = `<span>${c.name} — top ${c.top} m/s</span><span>${owned ? 'Owned — click to drive' : `$${c.price}`}</span>`;
    row.onclick = () => {
      if (!owned) { const r = buyCar(state, id); flash(r.ok ? `Bought ${c.name}` : r.error); renderGarage(); updateHUD(); return; }
      state.car = id;
      flash(`${c.name} is your ride now`);
      updateHUD();
    };
    el.appendChild(row);
  }
  const carId = state.car;
  for (const u of [{ id: 'engine1', name: 'Tuned Engine I', price: 600 }, { id: 'engine2', name: 'Tuned Engine II', price: 1600 }, { id: 'nitro', name: 'Nitro Kit', price: 900 }, { id: 'armor', name: 'Plated Body', price: 1100 }, { id: 'tires', name: 'Grip Tires', price: 500 }]) {
    const row = document.createElement('div');
    row.className = 'shop-row';
    const has = state.cars[carId]?.upgrades?.includes(u.id);
    row.innerHTML = `<span>${u.name} (${CARS[carId].name})</span><span>${has ? 'Installed' : `$${u.price}`}</span>`;
    row.onclick = () => { const r = buyUpgrade(state, carId, u.id); flash(r.ok ? 'Installed' : r.error); renderGarage(); updateHUD(); };
    el.appendChild(row);
  }
  const rep = document.createElement('div');
  rep.className = 'shop-row';
  rep.innerHTML = `<span>Repair ${CARS[carId].name}</span><span>$${Math.round((100 - (state.cars[carId]?.hp ?? 100)) * 4)}</span>`;
  rep.onclick = () => { const r = repairCar(state, carId); flash(r.ok ? 'Repaired' : r.error); updateHUD(); };
  el.appendChild(rep);
}
function toggleMissionPanel() { $('missions').classList.toggle('show'); renderMissions(); }
function renderMissions() {
  const el = $('mission-list');
  el.innerHTML = '';
  for (const m of MISSIONS) {
    const done = state.missionsDone.includes(m.id);
    const active = state.missionActive?.id === m.id;
    const row = document.createElement('div');
    row.className = 'shop-row' + (done ? ' done' : active ? ' active' : '');
    row.innerHTML = `<span>Day ${m.day} — ${m.title} ${done ? '✓' : active ? '●' : ''}</span><span>$${m.reward}</span>`;
    row.onclick = () => {
      if (done || active || m.day > state.day) return;
      const r = startMission(state, m.id);
      flash(r.ok ? `Mission started: ${m.title}` : r.error);
      if (r.ok) { audio.mission(); checkMissionAdvance(); }
      renderMissions(); updateHUD();
    };
    el.appendChild(row);
  }
}
function togglePause() {
  paused = !paused;
  $('pause').classList.toggle('show', paused);
  if (paused) audio.engine(false);
}

// ---------- HUD ----------
const minimap = $('minimap');
const mm = minimap.getContext('2d');
function updateHUD() {
  $('cash').textContent = '$' + state.money.toLocaleString();
  $('respect').textContent = state.respect;
  $('rank').textContent = rankFor(state.respect).name;
  $('health').style.width = state.health + '%';
  $('armor').style.width = state.armor + '%';
  $('wanted').textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
  $('wanted').style.color = state.wanted >= 3 ? '#ff4040' : '#ffd94a';
  const hh = Math.floor(state.timeOfDay), mm2 = Math.floor((state.timeOfDay % 1) * 60);
  $('clock').textContent = `Day ${state.day}/7 — ${String(hh).padStart(2, '0')}:${String(mm2).padStart(2, '0')} — Vera in ${Math.max(0, Math.round(hoursToLandfall(state)))}h`;
  $('weather').textContent = state.weather.toUpperCase() + (state.day >= 5 ? ' — STORM SURGE WARNING' : '');
  $('weapon').textContent = WEAPONS[state.weapon].name + (state.weapons[state.weapon]?.ammo !== Infinity ? ` (${state.weapons[state.weapon]?.ammo})` : '');
  $('radio').textContent = RADIO_STATIONS[state.radio].name;
  $('progress').textContent = `Story ${state.missionsDone.length}/10 — ${completionPercent(state)}% complete`;
  const d = districtAt(player.x, player.z);
  $('district').textContent = d ? `${d.name} — ${d.flavor}` : 'Solara Bay';
  const m = activeMissionDef(state);
  const st = activeStage(state);
  $('objective').textContent = m ? `${m.title}: ${st ? st.text : ''}` : (nextMission(state) ? `Next: ${nextMission(state).title} (press M)` : 'All missions complete!');
  if (player.inCar) {
    const stats = carStats(state, player.inCar.carId);
    $('carcard').style.display = 'block';
    $('carname').textContent = stats.name;
    $('carhp').style.width = player.inCar.hp + '%';
    $('carspeed').textContent = Math.round(Math.abs(player.inCar.speed) * 3.6) + ' km/h';
  } else $('carcard').style.display = 'none';
  $('hint').textContent = player.inCar
    ? 'WASD drive · Shift handbrake · N nitro · E exit'
    : 'WASD move · Shift sprint · E interact/steal · Click shoot · Q weapon · B shop · G safehouse · M missions · R radio';
}
function drawMinimap() {
  const S = 150, half = CITY_SIZE / 2;
  mm.clearRect(0, 0, S, S);
  mm.fillStyle = 'rgba(10,16,24,0.8)'; mm.fillRect(0, 0, S, S);
  mm.fillStyle = '#2c4a5a'; mm.fillRect(0, S - 14, S, 14); // beach/water
  for (const d of DISTRICTS) {
    mm.fillStyle = 'rgba(90,110,130,0.5)';
    mm.fillRect((d.x + half) / CITY_SIZE * S, (d.z + half) / CITY_SIZE * S, d.w / CITY_SIZE * S, d.h / CITY_SIZE * S);
  }
  mm.strokeStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i <= 8; i++) {
    mm.beginPath(); mm.moveTo(i * S / 8, 0); mm.lineTo(i * S / 8, S); mm.stroke();
    mm.beginPath(); mm.moveTo(0, i * S / 8); mm.lineTo(S, i * S / 8); mm.stroke();
  }
  const px = (player.x + half) / CITY_SIZE * S, pz = (player.z + half) / CITY_SIZE * S;
  const m = activeMissionDef(state);
  if (m) {
    const st = activeStage(state);
    const td = DISTRICTS.find((x) => x.id === st?.target);
    if (td) {
      mm.fillStyle = '#ffd94a';
      mm.beginPath(); mm.arc((td.x + td.w / 2 + half) / CITY_SIZE * S, (td.z + td.h / 2 + half) / CITY_SIZE * S, 5, 0, 7); mm.fill();
    }
  }
  for (const c of police) {
    mm.fillStyle = '#3f8cff';
    mm.fillRect((c.x + half) / CITY_SIZE * S - 2, (c.z + half) / CITY_SIZE * S - 2, 4, 4);
  }
  mm.fillStyle = '#2eff8a';
  mm.beginPath(); mm.arc(px, pz, 4, 0, 7); mm.fill();
  mm.strokeStyle = '#fff'; mm.stroke();
}

// ---------- Game loop ----------
let lastT = performance.now();
let saveTimer = 0;
let sirenOn = false;

function step(dt) {
  // Time passes: 1 real second = 1 game minute
  advanceTime(state, dt / 60);
  const storm = stormIntensity(state);
  // Day/night + storm sky
  const t = state.timeOfDay;
  const night = isNight(state);
  const sunH = Math.sin(((t - 6) / 12) * Math.PI);
  const dayCol = new THREE.Color(0x87b5d6).lerp(new THREE.Color(0x2a2118), storm * 0.7);
  const nightCol = new THREE.Color(0x0b1026);
  const sky = night ? nightCol : dayCol.clone().lerp(new THREE.Color(0xff9a4a), clamp(1 - Math.abs(sunH) * 3, 0, 0.6));
  scene.background = sky;
  scene.fog.color.copy(sky);
  sun.intensity = night ? 0.05 : 1.6 * clamp(sunH, 0.05, 1) * (1 - storm * 0.5);
  moon.intensity = night ? 0.5 : 0;
  sun.position.set(Math.cos((t / 24) * Math.PI * 2) * 300, 200 + sunH * 150, 150);
  rain.visible = state.weather !== 'clear' || storm > 0.4;
  if (rain.visible) {
    const pos = rain.geometry.attributes.position.array;
    for (let i = 0; i < rainCount; i++) {
      pos[i * 3 + 1] -= dt * (40 + storm * 40);
      pos[i * 3] += dt * storm * 20;
      if (pos[i * 3 + 1] < 0) { pos[i * 3 + 1] = 80; pos[i * 3] = player.x + rand(-150, 150); pos[i * 3 + 2] = player.z + rand(-150, 150); }
    }
    rain.geometry.attributes.position.needsUpdate = true;
  }
  city.update(dt, storm);

  // ---- Player on foot ----
  if (!player.inCar) {
    const sprint = keys['shift'] ? 1.7 : 1;
    const speed = 6 * sprint;
    let mx = 0, mz = 0;
    if (keys['w'] || keys['arrowup']) mz -= 1;
    if (keys['s'] || keys['arrowdown']) mz += 1;
    if (keys['a'] || keys['arrowleft']) mx -= 1;
    if (keys['d'] || keys['arrowright']) mx += 1;
    if (mx || mz) {
      const len = Math.hypot(mx, mz);
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      const dx = (fx * -mz + rx * mx) / len, dz = (fz * -mz + rz * mx) / len;
      player.angle = Math.atan2(dx, dz);
      const nx = player.x + dx * speed * dt, nz = player.z + dz * speed * dt;
      const fixed = city.collide(nx, nz, 0.7);
      player.x = fixed.x; player.z = fixed.z;
      player.mesh.position.set(player.x, 0, player.z);
      player.mesh.rotation.y = player.angle;
      player.mesh.position.y = Math.abs(Math.sin(performance.now() / 130)) * 0.08;
    }
    if (keys[' '] && player.y === 0) player.vy = 7;
    if (player.y > 0 || player.vy !== 0) {
      player.vy -= 22 * dt;
      player.y = Math.max(0, player.y + player.vy * dt);
      player.mesh.position.y = player.y;
      if (player.y === 0) player.vy = 0;
    }
  } else {
    // ---- Driving ----
    const car = player.inCar;
    const stats = carStats(state, car.carId);
    const fwd = (keys['w'] || keys['arrowup']) ? 1 : (keys['s'] || keys['arrowdown']) ? -0.6 : 0;
    const steer = (keys['a'] || keys['arrowleft']) ? 1 : (keys['d'] || keys['arrowright']) ? -1 : 0;
    const nitroMul = car.nitro > 0 ? 1.65 : 1;
    if (car.nitro > 0) car.nitro -= dt;
    if (car.nitroCd > 0) car.nitroCd -= dt;
    const target = fwd * stats.top * nitroMul;
    const accelRate = fwd !== 0 ? stats.accel : 14;
    car.speed += clamp(target - car.speed, -accelRate * dt, accelRate * dt);
    if (keys['shift']) car.speed *= Math.pow(0.4, dt);
    if (Math.abs(car.speed) > 0.5) car.angle += steer * 1.6 * stats.grip * dt * Math.sign(car.speed) * clamp(Math.abs(car.speed) / 12, 0.3, 1);
    const nx = car.x + Math.sin(car.angle) * car.speed * dt;
    const nz = car.z + Math.cos(car.angle) * car.speed * dt;
    const fixed = city.collide(nx, nz, 2.2);
    if (fixed.x !== nx || fixed.z !== nz) {
      car.hp = Math.max(0, car.hp - Math.abs(car.speed) * 0.4);
      car.speed *= -0.3;
      if (car.hp <= 0) { flash('Car wrecked!'); exitCar(); }
    }
    car.x = fixed.x; car.z = fixed.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
    player.x = car.x; player.z = car.z;
    audio.engine(true, Math.abs(car.speed) / (stats.top * 1.65));
    // running over peds is a crime
    for (const p of peds) {
      if (Math.hypot(p.x - car.x, p.z - car.z) < 2.5 && Math.abs(car.speed) > 8) {
        p.panic = 3;
        addWanted(state, 1);
      }
    }
  }

  // ---- Traffic AI: cruise along roads, wrap around ----
  for (const c of traffic) {
    c.speed = 10;
    c.x += Math.sin(c.angle) * c.speed * dt;
    c.z += Math.cos(c.angle) * c.speed * dt;
    if (Math.abs(c.x) > CITY_SIZE / 2 || Math.abs(c.z) > CITY_SIZE / 2) {
      c.x = rand(-400, 400); c.z = rand(-400, 400);
    }
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.angle;
  }
  // ---- Pedestrians wander, flee when wanted ----
  for (const p of peds) {
    if (p.panic > 0) {
      p.panic -= dt;
      p.x += Math.sin(p.angle + Math.PI) * 5 * dt;
      p.z += Math.cos(p.angle + Math.PI) * 5 * dt;
    } else {
      if (Math.random() < dt * 0.1) p.angle = rand(0, Math.PI * 2);
      p.x += Math.sin(p.angle) * p.speed * dt;
      p.z += Math.cos(p.angle) * p.speed * dt;
      const f = city.collide(p.x, p.z, 0.5);
      p.x = f.x; p.z = f.z;
    }
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.angle;
  }
  // ---- Police AI ----
  spawnPolice();
  const pol = policeForWanted(state.wanted);
  for (const c of police) {
    const dx = player.x - c.x, dz = player.z - c.z;
    const d = Math.hypot(dx, dz);
    const wantAngle = Math.atan2(dx, dz);
    let diff = ((wantAngle - c.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    c.angle += clamp(diff, -2.2 * dt, 2.2 * dt);
    c.speed = clamp(d * 0.5, 6, 20 + state.wanted * 3);
    if (d < 4) c.speed = 0;
    c.x += Math.sin(c.angle) * c.speed * dt;
    c.z += Math.cos(c.angle) * c.speed * dt;
    const f = city.collide(c.x, c.z, 2.2);
    c.x = f.x; c.z = f.z;
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.angle;
    const bar = c.mesh.getObjectByName('lightbar');
    if (bar) bar.material.color.setHex(Math.floor(performance.now() / 300) % 2 ? 0xff2020 : 0x2040ff);
    if (d < 3.5 && !player.inCar) {
      takeDamage(state, 8 * dt * pol.aggression);
      if (state.health <= 0) { busted(); }
    }
    if (d < 5 && player.inCar) {
      player.inCar.hp -= 4 * dt;
      if (player.inCar.hp <= 0) { flash('Your car was wrecked by the PD!'); exitCar(); }
    }
  }
  // Heli at 3+ stars
  heli.active = pol.heli;
  heli.mesh.visible = heli.active;
  if (heli.active) {
    heli.angle += dt * 0.3;
    heli.x = player.x + Math.cos(heli.angle) * 40;
    heli.z = player.z + Math.sin(heli.angle) * 40;
    heli.y = (shotMode === 'chase' ? 38 : 55) + Math.sin(performance.now() / 900) * 4;
    heli.mesh.position.set(heli.x, heli.y, heli.z);
    heli.mesh.rotation.y = -heli.angle;
    const rotor = heli.mesh.getObjectByName('rotor');
    if (rotor) rotor.rotation.y += dt * 20;
    if (Math.random() < dt * 0.2) takeDamage(state, 5);
  }
  // Siren
  const wantSiren = state.wanted > 0 && police.length > 0;
  if (wantSiren !== sirenOn) { sirenOn = wantSiren; audio.siren(wantSiren); }
  // Wanted decay when far from police
  const nearestCop = police.reduce((m, c) => Math.min(m, Math.hypot(c.x - player.x, c.z - player.z)), Infinity);
  decayWanted(state, dt, nearestCop > 90);
  // Enemies shoot back
  for (const e of enemies) {
    e.shootCd -= dt;
    const d = Math.hypot(e.x - player.x, e.z - player.z);
    if (d < 40) {
      e.angle = Math.atan2(player.x - e.x, player.z - e.z);
      e.mesh.rotation.y = e.angle;
      if (e.shootCd <= 0) {
        e.shootCd = rand(1.2, 2.4);
        takeDamage(state, 6);
        audio.blip(200, 0.08, 'square', 0.12);
        if (state.health <= 0) busted();
      }
    }
  }
  // Mission arrivals + evade
  checkArrivals();
  // Autosave every 30 s
  saveTimer += dt;
  if (saveTimer > 30) {
    saveTimer = 0;
    try { localStorage.setItem(SAVE_KEY, serialize(state)); } catch {}
  }
  updateHUD();
  drawMinimap();
  // Camera: third-person orbit
  const camDist = player.inCar ? 17 : 15;
  const camH = player.inCar ? 7.5 : 6.5;
  const tx = player.x - Math.sin(camYaw) * camDist;
  const tz = player.z - Math.cos(camYaw) * camDist;
  camera.position.set(tx, camH + Math.sin(camPitch) * 3, tz);
  camera.lookAt(player.x, shotMode === 'night' || shotMode === 'chase' ? 7 : 1.6, player.z);
}

function busted() {
  state.health = 100;
  state.wanted = 0;
  state.wantedHeat = 0;
  const fine = Math.min(state.money, 200);
  state.money -= fine;
  player.x = -40; player.z = 220;
  if (player.inCar) exitCar();
  player.mesh.position.set(player.x, 0, player.z);
  clearEnemies();
  if (state.missionActive) state.missionActive = null;
  flash(`BUSTED — fined $${fine}. Woke up at the safehouse.`);
  audio.fail();
  updateHUD();
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (!paused) step(dt);
  renderer.render(scene, camera);
}

// ---------- Save / load ----------
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = deserialize(raw);
    if (!data) return false;
    Object.assign(state, data);
    return true;
  } catch { return false; }
}

// ---------- Init ----------
function init() {
  const loaded = loadSave();
  if (shotMode === 'chase') { state.wanted = 4; state.wantedHeat = 100; }
  if (shotMode === 'mission') { state.missionActive = { id: 'm3', stage: 1, progress: 0 }; spawnEnemies(3, 'downtown'); player.x = -60; player.z = -100; player.mesh.position.set(player.x, 0, player.z); enemies.forEach((e, i) => { e.x = player.x + [-9, 0, 9][i]; e.z = player.z - 13; e.mesh.position.set(e.x, 0, e.z); }); }
  if (shotMode === 'chase') { player.x = 60; player.z = 60; spawnPolice(); }
  if (shotMode === 'night') { player.x = -300; player.z = 0; }
  if (shotMode === 'day') { player.x = -75; player.z = 55; }
  player.mesh.position.set(player.x, 0, player.z);
  audio.startRadio(state.radio);
  updateHUD();
  renderMissions();
  $('title-screen').classList.add('show');
  if (loaded) $('load-note').textContent = 'Save found — progress restored.';
  $('start-btn').onclick = () => {
    $('title-screen').classList.remove('show');
    audio.ensure();
    audio.startRadio(state.radio);
  };
  $('save-btn').onclick = () => {
    try { localStorage.setItem(SAVE_KEY, serialize(state)); flash('Game saved'); } catch { flash('Save failed'); }
  };
  $('load-btn').onclick = () => { if (loadSave()) { flash('Save loaded'); updateHUD(); } else flash('No save found'); };
  $('mute-btn').onclick = () => { audio.setMuted(!audio.muted); $('mute-btn').textContent = audio.muted ? '🔇 Muted' : '🔊 Sound'; };
  document.querySelectorAll('.close-btn').forEach((b) => {
    b.onclick = () => b.parentElement.classList.remove('show');
  });
  $('bribe-btn').onclick = () => {
    const r = payBribe(state);
    flash(r.ok ? `Bribe paid: -$${r.cost}. The PD looks away.` : r.error);
    updateHUD();
  };
  if (shotMode) {
    // Screenshot mode: hide title screen, place camera, signal readiness
    $('title-screen').classList.remove('show');
    if (shotMode === 'chase') {
      player.x = 35; player.z = 35;
      player.mesh.position.set(player.x, 0, player.z);
      const c = spawnCar('police', 35, 8, 0, 'sedan'); police.push(c);
      const c2 = spawnCar('police', 35, -6, 0, 'sedan'); police.push(c2);
      heli.active = true; heli.mesh.visible = true;
      heli.x = 55; heli.z = 10; heli.y = 24;
      heli.mesh.position.set(heli.x, heli.y, heli.z);
    }
    step(0.016);
    renderer.render(scene, camera);
    window.__shotReady = true;
    document.title = 'SOLARA BAY — ' + shotMode;
  }
  requestAnimationFrame(loop);
}
try {
  init();
} catch (err) {
  document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;inset:auto 0 0 0;background:#a00;color:#fff;padding:8px;font:14px monospace">Error: ${String(err)}</div>`);
  throw err;
}
