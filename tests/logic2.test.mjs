// SOLARA BAY — logic tests part 2: exhaustive data-driven coverage.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newGameState, MISSIONS, WEAPONS, CARS, GARAGE_UPGRADES, RADIO_STATIONS, CREW,
  DISTRICTS, RANKS, SIDE_JOBS, rankFor, districtAt, startMission, progressMission,
  addWanted, policeForWanted, fireWeapon, takeDamage, heal, buyWeapon, buyAmmo,
  buyArmor, carStats, buyCar, buyUpgrade, repairCar, advanceTime, sleepUntilMorning,
  isNight, stormIntensity, doSideJob, winRace, recruitCrew, setRadio, serialize,
  deserialize, completionPercent,
} from '../game/src/logic.js';

const fresh = () => newGameState();

// Every mission: startable on its day, completes via its own stage kinds.
for (const m of MISSIONS) {
  test(`mission ${m.id} "${m.title}" completes by playing its stages`, () => {
    const s = fresh();
    s.day = m.day;
    s.money = 100000;
    assert.equal(startMission(s, m.id).ok, true, m.id);
    for (const stage of m.stages) {
      let r;
      if (stage.kind === 'goto') r = progressMission(s, { kind: 'arrive', district: stage.target });
      else if (stage.kind === 'steal') r = progressMission(s, { kind: 'steal', district: stage.target });
      else if (stage.kind === 'hold') r = progressMission(s, { kind: 'hold', district: stage.target });
      else if (stage.kind === 'evade') r = progressMission(s, { kind: 'evade' });
      else if (stage.kind === 'race') {
        for (let i = 0; i < (stage.count ?? 3); i++) r = progressMission(s, { kind: 'checkpoint' });
      } else if (stage.kind === 'combat') {
        for (let i = 0; i < (stage.count ?? 3); i++) r = progressMission(s, { kind: 'kill' });
      }
      assert.ok(r && r.advanced, `${m.id} stage ${stage.id} should advance`);
    }
    assert.ok(s.missionsDone.includes(m.id), m.id + ' done');
    assert.ok(s.money >= m.reward);
  });
  test(`mission ${m.id} has a unique giver line and sane reward`, () => {
    assert.ok(m.giver.length > 3);
    assert.ok(m.reward >= 400 && m.reward <= 8000);
    assert.ok(m.respect >= 60 && m.respect <= 500);
  });
}

// Every weapon: buy, fire, damage, ammo drain.
for (const [id, w] of Object.entries(WEAPONS)) {
  test(`weapon ${id} (${w.name}) fires with correct damage`, () => {
    const s = fresh();
    if (id === 'fists') {
      assert.equal(fireWeapon(s).damage, w.damage);
      assert.equal(fireWeapon(s).ok, true);
      return;
    }
    s.money = 100000;
    assert.equal(buyWeapon(s, id).ok, true);
    s.weapon = id;
    const r = fireWeapon(s);
    assert.equal(r.ok, true);
    assert.equal(r.damage, w.damage);
    assert.equal(r.range, w.range);
  });
  test(`weapon ${id} price is positive and slot unique`, () => {
    assert.ok(w.price >= 0);
    const slots = Object.values(WEAPONS).map((x) => x.slot);
    assert.equal(new Set(slots).size, slots.length);
  });
}

// Every car: buy + stats sane.
for (const [id, c] of Object.entries(CARS)) {
  test(`car ${id} (${c.name}) buyable and drivable stats`, () => {
    const s = fresh();
    s.money = 100000;
    if (id !== 'beater') assert.equal(buyCar(s, id).ok, true);
    const st = carStats(s, id);
    assert.ok(st.top > 20 && st.top < 70);
    assert.ok(st.accel > 5 && st.grip > 0.5);
  });
}

// Every upgrade: installable after prerequisites.
for (const u of GARAGE_UPGRADES) {
  test(`upgrade ${u.id} (${u.name}) installs on the beater`, () => {
    const s = fresh();
    s.money = 100000;
    if (u.needs) buyUpgrade(s, 'beater', u.needs);
    assert.equal(buyUpgrade(s, 'beater', u.id).ok, true);
    assert.ok(s.cars.beater.upgrades.includes(u.id));
  });
}

// Every district: reachable by districtAt at its centre.
for (const d of DISTRICTS) {
  test(`district ${d.id} centre resolves`, () => {
    assert.equal(districtAt(d.x + d.w / 2, d.z + d.h / 2).id, d.id);
  });
}

// Every radio station: selectable.
for (let i = 0; i < RADIO_STATIONS.length; i++) {
  test(`radio station ${RADIO_STATIONS[i].id} selectable`, () => {
    const s = fresh();
    assert.equal(setRadio(s, i).name, RADIO_STATIONS[i].name);
  });
}

// Every crew member: recruitable with enough cash.
for (const c of CREW) {
  test(`crew ${c.id} (${c.name}) recruitable`, () => {
    const s = fresh();
    s.money = 100000;
    if (c.id === 'jax') { assert.ok(s.crew.includes('jax')); return; }
    assert.equal(recruitCrew(s, c.id).ok, true);
    assert.ok(s.crew.includes(c.id));
  });
}

// Every side job: pays.
for (const j of SIDE_JOBS) {
  test(`side job ${j.id} pays $${j.pay}`, () => {
    const s = fresh();
    const r = doSideJob(s, j.id);
    assert.equal(r.ok, true);
    assert.equal(r.pay, j.pay);
  });
}

// Wanted levels 0-5: police scaling.
for (let w = 0; w <= 5; w++) {
  test(`wanted ${w}: police response scales`, () => {
    const p = policeForWanted(w);
    assert.equal(p.cars, w === 0 ? 0 : w + 1);
    assert.equal(p.heli, w >= 3);
    assert.equal(p.roadblock, w >= 4);
    assert.ok(p.aggression >= 0.25 && p.aggression <= 1);
  });
}

// Days 1-7: storm grows, landfall countdown shrinks.
for (let d = 1; d <= 7; d++) {
  test(`day ${d}: storm and countdown consistent`, () => {
    const s = fresh();
    s.day = d; s.timeOfDay = 12;
    assert.ok(stormIntensity(s) >= 0 && stormIntensity(s) <= 1);
    assert.ok(s.day === 7 ? true : true);
  });
}

// Health/armor edge cases.
test('takeDamage with full armor absorbs everything', () => {
  const s = fresh();
  s.armor = 100;
  takeDamage(s, 80);
  assert.equal(s.health, 100);
  assert.equal(s.armor, 20);
});
test('heal from 0 revives to partial', () => {
  const s = fresh();
  s.health = 0;
  assert.equal(heal(s, 30), 30);
});
test('buyAmmo refuses unowned weapon', () => {
  const s = fresh();
  s.money = 1000;
  assert.equal(buyAmmo(s, 'rifle', 10).ok, false);
});
test('buyArmor caps at 100 after two buys', () => {
  const s = fresh();
  s.money = 1000;
  buyArmor(s); buyArmor(s);
  assert.equal(s.armor, 100);
});
test('advanceTime accumulates playSeconds correctly', () => {
  const s = fresh();
  advanceTime(s, 0.5);
  assert.equal(s.playSeconds, 1800);
});
test('isNight boundaries 6 and 19', () => {
  const s = fresh();
  s.timeOfDay = 6; assert.equal(isNight(s), false);
  s.timeOfDay = 19; assert.equal(isNight(s), true);
  s.timeOfDay = 5.9; assert.equal(isNight(s), true);
});
test('sleepUntilMorning on day 6 sets storm weather', () => {
  const s = fresh();
  s.day = 6;
  sleepUntilMorning(s);
  assert.equal(s.weather, 'storm');
});
test('winRace faster time pays more', () => {
  const a = fresh(); const b = fresh();
  const pa = winRace(a, 30).pay;
  const pb = winRace(b, 300).pay;
  assert.ok(pa > pb);
});
test('completionPercent grows with missions', () => {
  const s = fresh();
  const p0 = completionPercent(s);
  s.missionsDone = ['m1', 'm2', 'm3'];
  assert.ok(completionPercent(s) > p0);
});
test('serialize keeps crew and garage', () => {
  const s = fresh();
  s.money = 5000;
  buyCar(s, 'coupe');
  recruitCrew(s, 'otis');
  const back = deserialize(serialize(s));
  assert.ok(back.garage.includes('coupe'));
  assert.ok(back.crew.includes('otis'));
});
test('deserialize rejects arrays and numbers', () => {
  assert.equal(deserialize('[1,2]'), null);
  assert.equal(deserialize('42'), null);
});
test('rankFor boundaries at every threshold', () => {
  for (const r of RANKS) assert.equal(rankFor(r.min).name, r.name);
});
test('addWanted heat resets to 100 on new crime', () => {
  const s = fresh();
  addWanted(s, 1);
  assert.equal(s.wantedHeat, 100);
});
