// SOLARA BAY — procedural city. All geometry + canvas textures, zero assets.
import { DISTRICTS, CITY_SIZE } from './logic.js';

function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeCanvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildingTexture(base, lit) {
  return makeCanvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 2);
    for (let y = 12; y < h - 8; y += 24) {
      for (let x = 10; x < w - 10; x += 22) {
        const on = ((x * 7 + y * 13) % 5) < (lit ? 3 : 2);
        g.fillStyle = on ? 'rgba(255,214,130,0.95)' : 'rgba(20,26,40,0.9)';
        g.fillRect(x, y, 12, 14);
      }
    }
  });
}

export function roadTexture() {
  return makeCanvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#23262e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f5c542';
    g.fillRect(w / 2 - 2, 0, 4, 40); g.fillRect(w / 2 - 2, 64, 4, 40);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  });
}

const PALETTES = {
  marina: ['#7fb3d5', '#a8c8e0', '#5d8aa8'],
  oldtown: ['#b08954', '#8a6a42', '#c9a06a'],
  bayfront: ['#4a6fa5', '#6a8caf', '#3a5a80'],
  boardwalk: ['#e07a5f', '#f2a65a', '#81b29a'],
  downtown: ['#5a6b7d', '#7d8fa3', '#46586a'],
  harbor: ['#7a7a72', '#9a9a8a', '#5f6a5a'],
  crosstown: ['#8a7a5a', '#6a5a42', '#a08a68'],
  palms: ['#d9c7a7', '#bfae8a', '#e8dcc0'],
  stormpoint: ['#6b7a8a', '#54636f', '#8794a3'],
  southbeach: ['#e8d8a8', '#d9c48a', '#f0e0b8'],
};

export class City {
  constructor(scene) {
    this.scene = scene;
    this.buildings = []; // {x,z,w,d,h,mesh}
    this.colliders = []; // {minX,maxX,minZ,maxZ}
    this.trafficNodes = [];
    this.pedNodes = [];
    this.build();
  }

  addCollider(x, z, w, d) {
    this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }

  build() {
    const rand = seededRand(20261119);
    const S = CITY_SIZE;
    // Ground: sand base + city slab + beach + water
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(S + 600, S + 600),
      new THREE.MeshLambertMaterial({ color: 0x9c8a68 }),
    );
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.1;
    this.scene.add(ground);
    const slab = new THREE.Mesh(
      new THREE.PlaneGeometry(S, S),
      new THREE.MeshLambertMaterial({ color: 0x5a6068 }),
    );
    slab.rotation.x = -Math.PI / 2; slab.position.y = 0;
    this.scene.add(slab);
    // Ocean to the south + east
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 500),
      new THREE.MeshPhongMaterial({ color: 0x14586e, shininess: 120, transparent: true, opacity: 0.92 }),
    );
    water.rotation.x = -Math.PI / 2; water.position.set(0, 0.4, S / 2 + 250);
    this.scene.add(water);
    const beach = new THREE.Mesh(
      new THREE.PlaneGeometry(S + 200, 60),
      new THREE.MeshLambertMaterial({ color: 0xe0cf9a }),
    );
    beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.15, S / 2 + 10);
    this.scene.add(beach);

    // Roads: grid every 110 m, 12 m wide
    const roadTex = roadTexture();
    roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
    for (let x = -S / 2 + 55; x <= S / 2; x += 110) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(12, S), new THREE.MeshLambertMaterial({ map: roadTex }));
      r.rotation.x = -Math.PI / 2; r.position.set(x, 0.05, 0); r.receiveShadow = true;
      this.scene.add(r);
      this.trafficNodes.push({ x, z: 0, vertical: true });
    }
    for (let z = -S / 2 + 55; z <= S / 2 - 55; z += 110) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(S, 12), new THREE.MeshLambertMaterial({ map: roadTex }));
      r.rotation.x = -Math.PI / 2; r.position.set(0, 0.05, z);
      this.scene.add(r);
      this.trafficNodes.push({ x: 0, z, vertical: false });
    }

    // Buildings per block (skip road cells)
    const texCache = {};
    for (const d of DISTRICTS) {
      const pal = PALETTES[d.id] || ['#777'];
      for (let bx = d.x + 25; bx < d.x + d.w - 20; bx += 55) {
        for (let bz = d.z + 25; bz < d.z + d.h - 20; bz += 55) {
          if (Math.abs((bx % 110)) < 14 || Math.abs((bz % 110)) < 14) continue;
          if (rand() < 0.18) { // plaza / park gap
            if (rand() < 0.5) this.addTree(bx, bz, rand);
            continue;
          }
          const w = 22 + rand() * 18, dep = 22 + rand() * 18;
          const tall = d.id === 'downtown' || d.id === 'bayfront';
          const h = tall ? 40 + rand() * 90 : 10 + rand() * 26;
          const color = pal[Math.floor(rand() * pal.length)];
          if (!texCache[color]) texCache[color] = buildingTexture(color, true);
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, dep),
            new THREE.MeshLambertMaterial({ map: texCache[color] }),
          );
          mesh.position.set(bx, h / 2, bz);
          this.scene.add(mesh);
          this.buildings.push({ x: bx, z: bz, w, d: dep, h, mesh });
          this.addCollider(bx, bz, w, dep);
          if (rand() < 0.3) { // rooftop neon sign
            const sign = new THREE.Mesh(
              new THREE.BoxGeometry(w * 0.6, 2, 1),
              new THREE.MeshBasicMaterial({ color: [0xff2e63, 0x08d9d6, 0xf9ed69, 0xff9f1c][Math.floor(rand() * 4)] }),
            );
            sign.position.set(bx, h + 1.5, bz + dep / 2 + 0.6);
            this.scene.add(sign);
          }
        }
      }
    }

    // Landmarks: lighthouse (Storm Point), ferris wheel (Boardwalk), bank (Harbor), safehouse (Palm Court)
    this.addLighthouse(300, 220);
    this.addFerrisWheel(-300, -40);
    this.addLandmarkBank(260, -60);
    this.addSafehouse(-40, 220);
    this.addSafehouse(-260, -300); // second safehouse, Old Town
    this.addGarage(-300, 220);
    this.addGunshop(-40, -40);
    // Street lamps
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (let x = -S / 2 + 55; x <= S / 2; x += 110) {
      for (let z = -S / 2 + 55; z <= S / 2 - 55; z += 110) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7), new THREE.MeshLambertMaterial({ color: 0x222222 }));
        pole.position.set(x + 8, 3.5, z + 8);
        this.scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5), lampMat);
        bulb.position.set(x + 8, 7.2, z + 8);
        bulb.name = 'lamp';
        this.scene.add(bulb);
      }
    }
    // Storm clouds (dark billboards high up)
    this.clouds = [];
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0x2c3440, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(30 + rand() * 40, 8, 6), cloudMat);
      c.scale.y = 0.35;
      c.position.set((rand() - 0.5) * 1200, 130 + rand() * 40, (rand() - 0.5) * 1200 - 200);
      this.scene.add(c);
      this.clouds.push(c);
    }
  }

  addTree(x, z, rand) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 4), new THREE.MeshLambertMaterial({ color: 0x5a4028 }));
    trunk.position.set(x, 2, z);
    this.scene.add(trunk);
    const top = new THREE.Mesh(new THREE.SphereGeometry(3 + (rand ? rand() * 1.5 : 0)), new THREE.MeshLambertMaterial({ color: 0x2e7d32 }));
    top.position.set(x, 6, z);
    this.scene.add(top);
  }

  addLighthouse(x, z) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 46), new THREE.MeshLambertMaterial({ color: 0xf0ead8 }));
    tower.position.set(x, 23, z);
    this.scene.add(tower);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 4), new THREE.MeshBasicMaterial({ color: 0xc23b4e }));
    band.position.set(x, 34, z);
    this.scene.add(band);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(2.5), new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
    lamp.position.set(x, 47, z);
    lamp.name = 'lighthouse-lamp';
    this.scene.add(lamp);
    this.addCollider(x, z, 12, 12);
  }

  addFerrisWheel(x, z) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(22, 1.2, 8, 24), new THREE.MeshLambertMaterial({ color: 0xff2e63 }));
    wheel.position.set(x, 26, z);
    this.scene.add(wheel);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(2), new THREE.MeshBasicMaterial({ color: 0x08d9d6 }));
    hub.position.set(x, 26, z);
    this.scene.add(hub);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshLambertMaterial({ color: [0xf9ed69, 0x08d9d6, 0xff9f1c][i % 3] }));
      cab.position.set(x + Math.cos(a) * 22, 26 + Math.sin(a) * 22, z);
      this.scene.add(cab);
    }
    this.wheel = wheel;
    this.addCollider(x, z, 10, 10);
  }

  addLandmarkBank(x, z) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(50, 22, 36), new THREE.MeshLambertMaterial({ color: 0xd9d3c3 }));
    b.position.set(x, 11, z);
    this.scene.add(b);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 3), new THREE.MeshLambertMaterial({ color: 0x8a7a5a }));
    roof.position.set(x, 25, z); roof.rotation.y = Math.PI / 4;
    this.scene.add(roof);
    this.addCollider(x, z, 50, 36);
  }

  addSafehouse(x, z) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(20, 9, 16), new THREE.MeshLambertMaterial({ color: 0x4a90d9 }));
    h.position.set(x, 4.5, z);
    this.scene.add(h);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(13, 5, 4), new THREE.MeshLambertMaterial({ color: 0xc23b4e }));
    roof.position.set(x, 11.5, z); roof.rotation.y = Math.PI / 4;
    this.scene.add(roof);
    this.addCollider(x, z, 20, 16);
  }

  addGarage(x, z) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 22), new THREE.MeshLambertMaterial({ color: 0x2e8b6a }));
    g.position.set(x, 5, z);
    this.scene.add(g);
    this.addCollider(x, z, 30, 22);
  }

  addGunshop(x, z) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 14), new THREE.MeshLambertMaterial({ color: 0x8a5a2e }));
    g.position.set(x, 4, z);
    this.scene.add(g);
    this.addCollider(x, z, 18, 14);
  }

  // Circle vs AABB collision; returns corrected position.
  collide(x, z, radius) {
    for (const c of this.colliders) {
      if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) {
        const dxl = x + radius - c.minX, dxr = c.maxX - (x - radius);
        const dzl = z + radius - c.minZ, dzr = c.maxZ - (z - radius);
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) x = c.minX - radius;
        else if (m === dxr) x = c.maxX + radius;
        else if (m === dzl) z = c.minZ - radius;
        else z = c.maxZ + radius;
      }
    }
    const half = CITY_SIZE / 2;
    x = Math.max(-half, Math.min(half, x));
    z = Math.max(-half, Math.min(half + 40, z));
    return { x, z };
  }

  update(dt, storm01) {
    if (this.wheel) this.wheel.rotation.z += dt * 0.15;
    for (const c of this.clouds) {
      c.position.x += dt * (4 + storm01 * 22);
      if (c.position.x > 700) c.position.x = -700;
      c.material.opacity = 0.5 + storm01 * 0.45;
    }
  }
}
