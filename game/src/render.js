// Ember Harbor — Three.js renderer. Builds the whole city from the data in
// world.js: roads, buildings with lit windows, lamps, trees, billboards, the
// harbour water, plus the player, cars, peds, cops and helicopter. Textures
// are generated on canvas at boot — no external assets, no network.
// The game logic never touches THREE; this module only reads game state.

import { BLOCK, DAY, HALF, PALETTE } from './config.js';
import { clamp, lerp, smoothstep } from './utils.js';

function makeWindowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#3a4152';
  g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 22) {
    for (let x = 8; x < 120; x += 18) {
      const lit = ((x * 7 + y * 13) % 10) < 5;
      g.fillStyle = lit ? '#ffd27a' : '#1d2733';
      g.fillRect(x, y, 12, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeRoadTexture(horizontal) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2b2e36';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#c8cdd6';
  if (horizontal) g.fillRect(8, 30, 20, 4);
  else g.fillRect(30, 8, 4, 20);
  g.fillStyle = '#33373f';
  for (let i = 0; i < 24; i += 1) g.fillRect((i * 37) % 64, (i * 23) % 64, 2, 2);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function box(w, h, d, color, opts) {
  const mat = new THREE.MeshLambertMaterial({ color, ...(opts || {}) });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  return mesh;
}

export function createRenderer(canvas, city) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.Fog(0x87b5d6, 120, 620);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1400);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 700;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a3230, 0.75);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(ambient);

  const windowTex = makeWindowTexture();
  // One texture per road direction: the centre dash must run along the
  // road, so the X roads repeat along their length and the Z roads use a
  // 90-degree texture repeated along theirs.
  const roadTexX = makeRoadTexture(false);
  roadTexX.repeat.set(1, 48);
  const roadTexZ = makeRoadTexture(true);
  roadTexZ.repeat.set(48, 1);

  // Ground: grass base, road grid on top, harbour water to the east.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2 + 300, HALF * 2 + 300),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(40, -0.05, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMatX = new THREE.MeshLambertMaterial({ map: roadTexX });
  const roadMatZ = new THREE.MeshLambertMaterial({ map: roadTexZ });
  for (let i = 0; i <= 10; i += 1) {
    const c = -HALF + i * BLOCK;
    const roadX = new THREE.Mesh(new THREE.PlaneGeometry(16, HALF * 2 + 40), roadMatX);
    roadX.rotation.x = -Math.PI / 2;
    roadX.position.set(c, 0, 0);
    roadX.receiveShadow = true;
    scene.add(roadX);
    const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 40, 16), roadMatZ);
    roadZ.rotation.x = -Math.PI / 2;
    roadZ.position.set(0, 0, c);
    roadZ.receiveShadow = true;
    scene.add(roadZ);
  }

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(150, HALF * 2 + 260),
    new THREE.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(HALF + 75, 0.1, 0);
  scene.add(water);

  // Buildings: box + window-textured sides + roof detail. One shared
  // window material keeps the draw calls cheap.
  const buildingMeshes = [];
  const windowMat = new THREE.MeshLambertMaterial({ map: windowTex, emissive: 0x332200, emissiveMap: windowTex, emissiveIntensity: 0 });
  for (const b of city.buildings) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), new THREE.MeshLambertMaterial({ color: b.color }));
    body.position.y = b.h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    const win = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.3, b.h * 0.92, b.d + 0.3), windowMat);
    win.position.y = b.h / 2;
    group.add(win);
    const roof = box(b.w * 0.5, 1.2, b.d * 0.5, 0x2e3238);
    roof.position.y = b.h + 0.6;
    group.add(roof);
    if (b.roof === 'spire') {
      const spire = new THREE.Mesh(new THREE.ConeGeometry(3, 12, 4), new THREE.MeshLambertMaterial({ color: 0xc9a86a }));
      spire.position.y = b.h + 7;
      group.add(spire);
    }
    if (b.roof === 'tank') {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 5, 10), new THREE.MeshLambertMaterial({ color: 0x8a8d94 }));
      tank.position.y = b.h + 3;
      group.add(tank);
    }
    group.position.set(b.x, 0, b.z);
    scene.add(group);
    buildingMeshes.push(group);
  }
  for (const lm of city.landmarks) {
    const group = new THREE.Group();
    // r6: the new landmarks read at a glance — green for the gun shop,
    // gold for the casino, dark steel for the heliport, purple safehouse.
    const color = lm.kind === 'hospital' ? 0xe8e4da : lm.kind === 'bank' ? 0x8a7a5a
      : lm.kind === 'safehouse' ? 0x6a5a7a : lm.kind === 'gunshop' ? 0x3a5a3a
      : lm.kind === 'casino' ? 0xc9a227 : lm.kind === 'heliport' ? 0x2e3440 : 0x7a6a5a;
    const body = box(lm.w, lm.h, lm.d, color);
    body.position.y = lm.h / 2;
    body.castShadow = true;
    group.add(body);
    const sign = box(lm.w * 0.7, 3, 1, 0x222222);
    sign.position.set(0, lm.h + 1.5, lm.d / 2 + 0.6);
    group.add(sign);
    group.position.set(lm.x, 0, lm.z);
    scene.add(group);
  }

  // Lamps: pole + glowing head. Heads share one emissive material so the
  // night switch is a single material change.
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0x554411 });
  const lampHeads = [];
  for (const lamp of city.lamps) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    pole.position.set(lamp.x, 3, lamp.z);
    scene.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampHeadMat);
    head.position.set(lamp.x, 6.1, lamp.z);
    scene.add(head);
    lampHeads.push(head);
  }

  // Trees: trunk + two foliage spheres.
  for (const t of city.trees) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6), new THREE.MeshLambertMaterial({ color: 0x5a4028 }));
    trunk.position.set(t.x, 1.2, t.z);
    scene.add(trunk);
    const top = new THREE.Mesh(new THREE.SphereGeometry(2.1 * t.s, 8, 6), new THREE.MeshLambertMaterial({ color: 0x3a6a3a }));
    top.position.set(t.x, 3.4 * t.s, t.z);
    top.castShadow = true;
    scene.add(top);
  }

  // Parks: green discs with a bench or two.
  for (const p of city.parks) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(p.size / 2, 24), new THREE.MeshLambertMaterial({ color: 0x558855 }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(p.x, 0.02, p.z);
    scene.add(disc);
  }

  // Billboards: pole + coloured board.
  for (const bb of city.billboards) {
    const board = box(14, 5, 0.6, bb.color, { emissive: bb.color, emissiveIntensity: 0.35 });
    board.position.set(bb.x, 11, bb.z);
    board.rotation.y = bb.angle;
    scene.add(board);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 9, 6), new THREE.MeshLambertMaterial({ color: 0x444444 }));
    pole.position.set(bb.x, 4.5, bb.z);
    scene.add(pole);
  }

  // r6: heli pads — flat H circles on the heliport and the two rooftops
  // the Skyhook mission uses, so the player can see where to land.
  const padMeshes = [];
  for (const pad of city.heliPads || []) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(pad.radius, 24), new THREE.MeshLambertMaterial({ color: 0x3a4152 }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(pad.x, pad.id === 'heliport' ? 0.06 : 0.06, pad.z);
    scene.add(disc);
    const ring = new THREE.Mesh(new THREE.RingGeometry(pad.radius - 1.2, pad.radius, 24), new THREE.MeshBasicMaterial({ color: 0xffc233, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pad.x, 0.08, pad.z);
    scene.add(ring);
    padMeshes.push(disc);
  }

  // Mission beacon: a glowing column + ring at the current objective.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffc233, transparent: true, opacity: 0.55 });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true), beaconMat);
  beacon.position.y = 30;
  scene.add(beacon);
  const beaconRing = new THREE.Mesh(new THREE.RingGeometry(3, 4.4, 24), new THREE.MeshBasicMaterial({ color: 0xffc233, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.y = 0.15;
  scene.add(beaconRing);
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), new THREE.MeshBasicMaterial({ color: 0xffc233 }));
  marker.position.y = 7;
  scene.add(marker);

  // Hidden packages: small gold crates.
  const packageMeshes = [];
  for (const p of city.packages) {
    const m = box(1.1, 0.8, 1.1, 0xf2c200, { emissive: 0x664400, emissiveIntensity: 0.6 });
    m.position.set(p.x, 0.6, p.z);
    scene.add(m);
    packageMeshes.push(m);
  }

  // Rain: a point cloud that only shows in bad weather.
  const rainCount = 900;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i += 1) {
    rainPos[i * 3] = (Math.random() - 0.5) * 220;
    rainPos[i * 3 + 1] = Math.random() * 60;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 220;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaaccee, size: 0.35, transparent: true, opacity: 0.6 }));
  rain.visible = false;
  scene.add(rain);

  const playerGroup = new THREE.Group();
  const body = box(0.9, 1.1, 0.5, PALETTE.playerJacket);
  body.position.y = 1.05;
  body.castShadow = true;
  playerGroup.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), new THREE.MeshLambertMaterial({ color: 0xd8a077 }));
  head.position.y = 1.85;
  head.castShadow = true;
  playerGroup.add(head);
  const legs = box(0.8, 0.7, 0.45, PALETTE.playerPants);
  legs.position.y = 0.35;
  playerGroup.add(legs);
  scene.add(playerGroup);

  const carGroups = new Map();
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  function buildCarMesh(car) {
    const g = new THREE.Group();
    const model = car;
    // r6: bikes are narrow with two wheels and a rider lean; trucks are
    // long with a cargo box. The rest keep the classic sedan silhouette.
    if (car.model === 'bike') {
      const frame = box(0.5, 0.5, 2.2, car.color);
      frame.position.y = 0.6;
      frame.castShadow = true;
      g.add(frame);
      const rider = box(0.45, 0.7, 0.45, 0x2e3440);
      rider.position.y = 1.15;
      g.add(rider);
      for (const wz of [0.9, -0.9]) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(0, 0.35, wz);
        g.add(wheel);
      }
      g.userData.model = model;
      return g;
    }
    if (car.model === 'truck') {
      const cab = box(2.2, 1.4, 1.8, car.color);
      cab.position.set(0, 0.9, 2.2);
      cab.castShadow = true;
      g.add(cab);
      const cargo = box(2.3, 1.8, 4.2, 0x8a8d94);
      cargo.position.set(0, 1.1, -1.2);
      cargo.castShadow = true;
      g.add(cargo);
      for (const [wx, wz] of [[-1.05, 2.6], [1.05, 2.6], [-1.05, -2.6], [1.05, -2.6]]) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.42, wz);
        g.add(wheel);
      }
      g.userData.model = model;
      return g;
    }
    const bodyM = box(1.9, 0.62, 4.3, car.color);
    bodyM.position.y = 0.55;
    bodyM.castShadow = true;
    g.add(bodyM);
    const cabin = box(1.7, 0.55, 2.2, 0x1a2733);
    cabin.position.set(0, 1.05, -0.2);
    cabin.castShadow = true;
    g.add(cabin);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    for (const sx of [-0.6, 0.6]) {
      const lamp = box(0.35, 0.18, 0.1, 0xfff2b0);
      lamp.material = lightMat;
      lamp.position.set(sx, 0.6, 2.18);
      g.add(lamp);
    }
    for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.42, wz);
      g.add(wheel);
    }
    if (car.model === 'cop') {
      const bar = box(1.1, 0.18, 0.5, 0x2255ff, { emissive: 0x2244ff, emissiveIntensity: 0.9 });
      bar.position.set(0, 1.42, -0.2);
      g.add(bar);
    }
    if (car.model === 'taxi') {
      const sign = box(0.7, 0.22, 0.4, 0xf2c200, { emissive: 0xaa8800, emissiveIntensity: 0.5 });
      sign.position.set(0, 1.42, -0.2);
      g.add(sign);
    }
    g.userData.model = model;
    return g;
  }

  const pedGroups = new Map();
  function buildPedMesh(ped) {
    const g = new THREE.Group();
    const b = box(0.7, 1.0, 0.4, ped.color);
    b.position.y = 1.0;
    b.castShadow = true;
    g.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd8a077 }));
    h.position.y = 1.72;
    g.add(h);
    const l = box(0.6, 0.6, 0.35, 0x2e3440);
    l.position.y = 0.3;
    g.add(l);
    return g;
  }

  const copGroups = new Map();
  function buildCopMesh() {
    const g = new THREE.Group();
    const b = box(0.85, 1.05, 0.45, 0x1e3a8a);
    b.position.y = 1.0;
    b.castShadow = true;
    g.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd8a077 }));
    h.position.y = 1.78;
    g.add(h);
    const cap = box(0.6, 0.14, 0.5, 0x111111);
    cap.position.y = 1.98;
    g.add(cap);
    return g;
  }

  const heliGroup = new THREE.Group();
  // r6: the police heli is painted bright blue-white so it reads against
  // a dusk sky — a dark heli on a dark sky is invisible in screenshots.
  const heliBody = box(2.2, 1.4, 4.6, 0x4a7fd8);
  heliBody.position.y = 0;
  heliGroup.add(heliBody);
  const heliStripe = box(2.25, 0.35, 4.65, 0xf2f2f2);
  heliStripe.position.y = 0.1;
  heliGroup.add(heliStripe);
  const rotor = box(7, 0.12, 0.5, 0x222222);
  rotor.position.y = 1.0;
  heliGroup.add(rotor);
  const spot = new THREE.SpotLight(0xfff2b0, 0, 120, 0.3, 0.5);
  spot.position.set(0, -0.5, 0);
  heliGroup.add(spot);
  heliGroup.add(spot.target);
  heliGroup.visible = false;
  scene.add(heliGroup);

  // r6: the player's flyable helicopter — red-and-white, with a bigger
  // rotor than the police bird so the two never read the same.
  const playerHeliGroup = new THREE.Group();
  const phBody = box(2.4, 1.5, 5.0, 0xc22e2e);
  phBody.castShadow = true;
  playerHeliGroup.add(phBody);
  const phStripe = box(2.45, 0.4, 5.05, 0xf2f2f2);
  phStripe.position.y = 0.2;
  playerHeliGroup.add(phStripe);
  const phRotor = box(8.5, 0.12, 0.5, 0x222222);
  phRotor.position.y = 1.1;
  playerHeliGroup.add(phRotor);
  const phTail = box(0.5, 0.5, 3.0, 0xc22e2e);
  phTail.position.set(0, 0.3, -3.8);
  playerHeliGroup.add(phTail);
  playerHeliGroup.visible = false;
  scene.add(playerHeliGroup);

  // r6: SWAT troopers — dark armour, helmets, visibly heavier than beat cops.
  const swatGroups = new Map();
  function buildSwatMesh() {
    const g = new THREE.Group();
    const b = box(0.95, 1.1, 0.5, 0x1a1a1a);
    b.position.y = 1.0;
    b.castShadow = true;
    g.add(b);
    const vest = box(0.98, 0.6, 0.52, 0x2e4a2e);
    vest.position.y = 1.05;
    g.add(vest);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    h.position.y = 1.8;
    g.add(h);
    return g;
  }

  // r6: roadblock barriers — striped, waist-high, parked across the avenue.
  const roadblockMeshes = [];
  function buildRoadblockMesh() {
    const g = new THREE.Group();
    for (const sx of [-4, 4]) {
      const bar = box(7, 1.1, 0.5, 0xf2c200, { emissive: 0x664400, emissiveIntensity: 0.5 });
      bar.position.set(sx, 0.55, 0);
      g.add(bar);
      const stripe = box(7, 0.3, 0.52, 0x111111);
      stripe.position.set(sx, 0.55, 0);
      g.add(stripe);
    }
    g.visible = false;
    scene.add(g);
    roadblockMeshes.push(g);
    return g;
  }

  // r6: ambient event markers — a pulsing orange diamond over the action.
  const eventMarker = new THREE.Mesh(new THREE.OctahedronGeometry(1.4), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
  eventMarker.visible = false;
  scene.add(eventMarker);
  const vigilanteMarker = new THREE.Mesh(new THREE.OctahedronGeometry(1.2), new THREE.MeshBasicMaterial({ color: 0xff2244 }));
  vigilanteMarker.visible = false;
  scene.add(vigilanteMarker);

  // Headlight cone for night driving.
  const headlight = new THREE.SpotLight(0xfff2b0, 0, 55, 0.5, 0.45);
  scene.add(headlight);
  scene.add(headlight.target);

  function syncCarMesh(car) {
    let g = carGroups.get(car);
    if (!g) {
      g = buildCarMesh(car);
      carGroups.set(car, g);
      scene.add(g);
    }
    g.position.set(car.x, 0, car.z);
    g.rotation.y = car.heading;
    g.visible = !car.hidden;
    return g;
  }

  function syncPedMesh(ped, key) {
    let g = pedGroups.get(key);
    if (!g) {
      g = buildPedMesh(ped);
      pedGroups.set(key, g);
      scene.add(g);
    }
    g.position.set(ped.x, 0, ped.z);
    g.rotation.y = ped.heading;
    g.visible = !ped.dead;
    return g;
  }

  let nightFactor = 0;
  function applyTimeOfDay(dayTime, weather) {
    // dayTime 0..1 (0 = midnight). Sun elevation peaks at noon.
    const sunAngle = (dayTime - 0.25) * Math.PI * 2;
    const elevation = Math.sin(sunAngle);
    const isNight = dayTime < DAY.dawn || dayTime > DAY.nightStart;
    const dusk = (dayTime > DAY.dusk && dayTime < DAY.nightStart) || (dayTime > 0.16 && dayTime < DAY.dawn);
    nightFactor = smoothstep(isNight ? 1 : dusk ? 0.55 : 0);
    const day = 1 - nightFactor;
    sun.intensity = 0.25 + 1.35 * Math.max(0, elevation) * day;
    sun.position.set(Math.cos(sunAngle) * 220, Math.max(30, elevation * 260), 120);
    hemi.intensity = 0.3 + 0.55 * day;
    ambient.intensity = 0.12 + 0.16 * day;
    const skyDay = new THREE.Color(0x87b5d6);
    const skyNight = new THREE.Color(0x0b1026);
    const skyDusk = new THREE.Color(0xd86a4a);
    let sky = skyDay.clone().lerp(skyNight, nightFactor);
    if (dusk) sky = sky.lerp(skyDusk, 0.45);
    if (weather === 'rain') sky = sky.lerp(new THREE.Color(0x4a5566), 0.5);
    scene.background = sky;
    scene.fog.color.copy(sky);
    scene.fog.near = weather === 'fog' ? 40 : 120;
    scene.fog.far = weather === 'fog' ? 260 : 620;
    lampHeadMat.color.setHex(nightFactor > 0.4 ? 0xffe6a3 : 0x554411);
    windowMat.emissiveIntensity = nightFactor * 0.9;
    rain.visible = weather === 'rain';
    return { isNight, nightFactor };
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    scene, camera, renderer,
    draw(state) {
      const { player, playerCar, traffic, cops, copCars, heli, dayTime, weather, camYaw, camPitch, camDist, objective, packages, time } = state;
      const playerHeli = state.playerHeli;
      const swat = state.swat || [];
      const roadblocks = state.roadblocks || [];
      const events = state.events || [];
      const vigilante = state.vigilante || null;
      applyTimeOfDay(dayTime, weather);
      if (rain.visible) {
        const pos = rainGeo.attributes.position;
        for (let i = 0; i < rainCount; i += 1) {
          let y = pos.getY(i) - 0.9;
          if (y < 0) y = 60;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
        rain.position.set(player.x, 0, player.z);
      }

      // Player / car focus for the camera.
      const focus = playerHeli && playerHeli.occupied ? playerHeli : playerCar || player;
      playerGroup.position.set(player.x, player.y, player.z);
      playerGroup.rotation.y = player.heading;
      playerGroup.visible = !playerCar && !(playerHeli && playerHeli.occupied);
      if (playerCar) {
        headlight.intensity = nightFactor > 0.4 ? 2.2 : 0;
        headlight.position.set(playerCar.x, 1.2, playerCar.z);
        headlight.target.position.set(playerCar.x + Math.sin(playerCar.heading) * 20, 0, playerCar.z + Math.cos(playerCar.heading) * 20);
      } else {
        headlight.intensity = 0;
      }

      for (const car of traffic.cars) syncCarMesh(car);
      if (playerCar) syncCarMesh(playerCar);
      for (const unit of copCars || []) syncCarMesh(unit.car);
      traffic.peds.forEach((ped, i) => syncPedMesh(ped, `ped${i}`));
      (cops || []).forEach((cop, i) => {
        let g = copGroups.get(i);
        if (!g) { g = buildCopMesh(); copGroups.set(i, g); scene.add(g); }
        g.position.set(cop.x, 0, cop.z);
        g.rotation.y = cop.heading;
      });
      // r6: SWAT troopers, FIB cars (dark interceptors reuse the car mesh),
      // roadblocks, the player's heli and the live event markers.
      swat.forEach((unit, i) => {
        let g = swatGroups.get(i);
        if (!g) { g = buildSwatMesh(); swatGroups.set(i, g); scene.add(g); }
        g.position.set(unit.x, 0, unit.z);
        g.rotation.y = unit.heading;
        g.visible = !unit.dead && unit.state !== 'gone';
      });
      for (const unit of state.fibCars || []) syncCarMesh(unit.car);
      roadblocks.forEach((block, i) => {
        let g = roadblockMeshes[i];
        if (!g) g = buildRoadblockMesh();
        g.position.set(block.x, 0, block.z);
        g.rotation.y = block.heading;
        g.visible = !!block.active;
      });
      if (playerHeli) {
        playerHeliGroup.visible = true;
        playerHeliGroup.position.set(playerHeli.x, playerHeli.y, playerHeli.z);
        playerHeliGroup.rotation.y = playerHeli.heading;
        phRotor.rotation.y = (time || 0) * (playerHeli.rotor > 0.1 ? 26 : 0);
      } else {
        playerHeliGroup.visible = false;
      }
      if (events.length > 0) {
        const ev = events[0];
        eventMarker.visible = true;
        eventMarker.position.set(ev.actorX, 6 + Math.sin((time || 0) * 2.4) * 0.8, ev.actorZ);
        eventMarker.rotation.y = (time || 0) * 1.6;
      } else {
        eventMarker.visible = false;
      }
      if (vigilante) {
        vigilanteMarker.visible = true;
        vigilanteMarker.position.set(vigilante.x, 5 + Math.sin((time || 0) * 3) * 0.6, vigilante.z);
        vigilanteMarker.rotation.y = (time || 0) * 2;
      } else {
        vigilanteMarker.visible = false;
      }

      if (heli && heli.active) {
        heliGroup.visible = true;
        heliGroup.position.set(heli.x, heli.y, heli.z);
        rotor.rotation.y = (time || 0) * 22;
        spot.intensity = 3;
        spot.target.position.set(heli.spotX - heli.x, -heli.y, heli.spotZ - heli.z);
      } else {
        heliGroup.visible = false;
      }

      if (objective) {
        beacon.visible = true;
        beaconRing.visible = true;
        marker.visible = true;
        beacon.position.set(objective.x, 30, objective.z);
        beaconRing.position.set(objective.x, 0.15, objective.z);
        marker.position.set(objective.x, 7 + Math.sin((time || 0) * 2.4) * 0.8, objective.z);
        marker.rotation.y = (time || 0) * 1.6;
      } else {
        beacon.visible = false;
        beaconRing.visible = false;
        marker.visible = false;
      }
      (packages || []).forEach((p, i) => {
        const m = packageMeshes[i];
        if (m) m.visible = !p.taken;
      });

      // Third-person camera: orbit behind the focus point. In the heli
      // the camera climbs with the aircraft instead of staying at street level.
      const focusY = (playerHeli && playerHeli.occupied) ? playerHeli.y : (playerCar ? 1.2 : 1.8);
      const cy = Math.sin(camPitch) * camDist;
      const ch = Math.cos(camPitch) * camDist;
      const cx = focus.x - Math.sin(camYaw) * ch;
      const cz = focus.z - Math.cos(camYaw) * ch;
      camera.position.set(cx, focusY + cy, cz);
      camera.lookAt(focus.x, focusY + 0.4 + (player ? player.y : 0), focus.z);
      renderer.render(scene, camera);
    },
  };
}
