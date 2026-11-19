// SOLARA BAY — logic tests. Run: node --test tests/logic.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newGameState, MISSIONS, WEAPONS, CARS, GARAGE_UPGRADES, RADIO_STATIONS, CREW,
  DISTRICTS, RANKS, SIDE_JOBS, rankFor, nextRankFor, districtAt, availableMissions,
  nextMission, startMission, activeMissionDef, activeStage, progressMission, abortMission,
  addWanted, decayWanted, policeForWanted, payBribe, fireWeapon, takeDamage, heal,
  buyWeapon, buyAmmo, buyArmor, carStats, buyCar, buyUpgrade, repairCar, stealCar,
  advanceTime, sleepUntilMorning, isNight, stormIntensity, hoursToLandfall,
  doSideJob, winRace, recruitCrew, setRadio, serialize, deserialize,
  isStoryComplete, completionPercent, TOTAL_DAYS, START_MONEY, SAVE_KEY,
} from '../game/src/logic.js';

const fresh = () => newGameState();

// ---- State / ranks ----
test('new game starts with $120, 100 health, day 1, no wanted', () => {
  const s = fresh();
  assert.equal(s.money, START_MONEY);
  assert.equal(s.health, 100);
  assert.equal(s.day, 1);
  assert.equal(s.wanted, 0);
  assert.equal(s.weapon, 'fists');
  assert.deepEqual(s.crew, ['jax']);
  assert.equal(s.missionsDone.length, 0);
});
test('rank ladder has 7 ranks in ascending order', () => {
  assert.equal(RANKS.length, 7);
  for (let i = 1; i < RANKS.length; i++) assert.ok(RANKS[i].min > RANKS[i - 1].min);
});
for (const [respect, name] of [[0, 'Nobody'], [99, 'Nobody'], [100, 'Runner'], [300, 'Wheelman'], [600, 'Hustler'], [1000, 'Stormbreaker'], [1600, 'Bay Legend'], [2500, 'King of the Bay'], [9999, 'King of the Bay']]) {
  test(`rankFor(${respect}) = ${name}`, () => assert.equal(rankFor(respect).name, name));
}
test('nextRankFor returns next rank and null at top', () => {
  assert.equal(nextRankFor(0).name, 'Runner');
  assert.equal(nextRankFor(2499).name, 'King of the Bay');
  assert.equal(nextRankFor(2500), null);
});
test('all districts have unique ids and valid rects', () => {
  const ids = new Set(DISTRICTS.map((d) => d.id));
  assert.equal(ids.size, DISTRICTS.length);
  for (const d of DISTRICTS) {
    assert.ok(d.w > 0 && d.h > 0);
    assert.ok(d.name.length > 0 && d.flavor.length > 0);
  }
});
test('districtAt finds downtown centre and null outside city', () => {
  assert.equal(districtAt(-10, -50).id, 'downtown');
  assert.equal(districtAt(300, 220).id, 'stormpoint');
  assert.equal(districtAt(9999, 9999), null);
});
test('10 districts cover the map', () => assert.equal(DISTRICTS.length, 10));

// ---- Missions ----
test('10 missions, unique ids, days 1-7, stages present', () => {
  assert.equal(MISSIONS.length, 10);
  const ids = new Set(MISSIONS.map((m) => m.id));
  assert.equal(ids.size, 10);
  for (const m of MISSIONS) {
    assert.ok(m.day >= 1 && m.day <= TOTAL_DAYS);
    assert.ok(m.stages.length >= 3);
    assert.ok(m.reward > 0 && m.respect > 0);
    assert.ok(m.title && m.brief && m.giver);
    for (const st of m.stages) assert.ok(st.text && st.kind);
  }
});
test('mission rewards and respect grow over the story', () => {
  assert.ok(MISSIONS[9].reward > MISSIONS[0].reward);
  assert.ok(MISSIONS[9].respect > MISSIONS[0].respect);
});
test('availableMissions only shows day-unlocked, undone missions', () => {
  const s = fresh();
  assert.deepEqual(availableMissions(s).map((m) => m.id), ['m1', 'm2']);
  s.day = 3;
  assert.equal(availableMissions(s).length, 6);
});
test('nextMission returns first available', () => {
  assert.equal(nextMission(fresh()).id, 'm1');
});
test('startMission rejects unknown, future-day and double start', () => {
  const s = fresh();
  assert.equal(startMission(s, 'nope').ok, false);
  assert.equal(startMission(s, 'm3').ok, false); // day 2
  assert.equal(startMission(s, 'm1').ok, true);
  assert.equal(startMission(s, 'm2').ok, false); // already active
});
test('startMission marks active and activeMissionDef/activeStage follow', () => {
  const s = fresh();
  startMission(s, 'm1');
  assert.equal(activeMissionDef(s).id, 'm1');
  assert.equal(activeStage(s).id, 'go');
});
test('goto stages advance on arrive in the right district', () => {
  const s = fresh();
  startMission(s, 'm1');
  assert.equal(progressMission(s, { kind: 'arrive', district: 'downtown' }).advanced, false);
  const r = progressMission(s, { kind: 'arrive', district: 'harbor' });
  assert.equal(r.advanced, true);
  assert.equal(activeStage(s).kind, 'steal');
});
test('full m1 completes: reward money + respect, mission listed done', () => {
  const s = fresh();
  startMission(s, 'm1');
  progressMission(s, { kind: 'arrive', district: 'harbor' });
  progressMission(s, { kind: 'steal', district: 'harbor' });
  const r = progressMission(s, { kind: 'arrive', district: 'crosstown' });
  assert.equal(r.done, true);
  assert.equal(s.missionsDone.length, 1);
  assert.equal(s.money, START_MONEY + 400);
  assert.equal(s.respect, 60);
  assert.equal(s.missionActive, null);
});
test('combat stage counts kills until threshold', () => {
  const s = fresh();
  s.day = 2;
  startMission(s, 'm3');
  progressMission(s, { kind: 'arrive', district: 'downtown' });
  assert.equal(progressMission(s, { kind: 'kill' }).advanced, false);
  assert.equal(progressMission(s, { kind: 'kill' }).advanced, false);
  assert.equal(progressMission(s, { kind: 'kill' }).advanced, true);
  assert.equal(activeStage(s).kind, 'hold');
});
test('race stage counts checkpoints', () => {
  const s = fresh();
  s.day = 3;
  startMission(s, 'm6');
  progressMission(s, { kind: 'arrive', district: 'boardwalk' });
  assert.equal(progressMission(s, { kind: 'checkpoint' }).advanced, false);
  progressMission(s, { kind: 'checkpoint' });
  assert.equal(progressMission(s, { kind: 'checkpoint' }).advanced, true);
});
test('evade stage completes when wanted hits zero', () => {
  const s = fresh();
  startMission(s, 'm2');
  progressMission(s, { kind: 'steal', district: 'bayfront' });
  assert.equal(progressMission(s, { kind: 'evade' }).advanced, true);
});
test('abortMission clears active mission', () => {
  const s = fresh();
  startMission(s, 'm1');
  abortMission(s);
  assert.equal(s.missionActive, null);
});
test('completed mission cannot restart', () => {
  const s = fresh();
  startMission(s, 'm1');
  progressMission(s, { kind: 'arrive', district: 'harbor' });
  progressMission(s, { kind: 'steal', district: 'harbor' });
  progressMission(s, { kind: 'arrive', district: 'crosstown' });
  assert.equal(startMission(s, 'm1').ok, false);
});
test('isStoryComplete false until all 10 done', () => {
  const s = fresh();
  assert.equal(isStoryComplete(s), false);
  s.missionsDone = MISSIONS.map((m) => m.id);
  assert.equal(isStoryComplete(s), true);
});
test('completionPercent starts 0ish and reaches 100-ish at full completion', () => {
  const s = fresh();
  assert.ok(completionPercent(s) < 10);
  s.missionsDone = MISSIONS.map((m) => m.id);
  s.respect = 2500;
  for (const id of Object.keys(CARS)) s.cars[id] = { owned: true, hp: 100, upgrades: [] };
  for (const id of Object.keys(WEAPONS)) s.weapons[id] = { owned: true, ammo: 10 };
  assert.equal(completionPercent(s), 100);
});

// ---- Wanted / police ----
test('addWanted clamps to 0..5', () => {
  const s = fresh();
  assert.equal(addWanted(s, 2), 2);
  assert.equal(addWanted(s, 9), 5);
  assert.equal(addWanted(s, -20), 0);
});
test('policeForWanted: no cops at 0, heli at 3+, roadblock at 4+', () => {
  assert.deepEqual(policeForWanted(0), { cars: 0, heli: false, roadblock: false, aggression: 0.25 });
  assert.equal(policeForWanted(1).cars, 2);
  assert.equal(policeForWanted(3).heli, true);
  assert.equal(policeForWanted(3).roadblock, false);
  assert.equal(policeForWanted(4).roadblock, true);
  assert.equal(policeForWanted(5).cars, 6);
});
test('decayWanted drops a star when heat runs out, faster when hidden', () => {
  const s = fresh();
  addWanted(s, 2);
  decayWanted(s, 1000, true);
  assert.ok(s.wanted < 2);
});
test('decayWanted does nothing at 0 stars', () => {
  const s = fresh();
  assert.equal(decayWanted(s, 100, true), 0);
});
test('payBribe clears wanted for 150/star, refuses when broke or clean', () => {
  const s = fresh();
  assert.equal(payBribe(s).ok, false);
  addWanted(s, 2);
  s.money = 100;
  assert.equal(payBribe(s).ok, false);
  s.money = 1000;
  const r = payBribe(s);
  assert.equal(r.ok, true);
  assert.equal(r.cost, 300);
  assert.equal(s.wanted, 0);
  assert.equal(s.money, 700);
});

// ---- Combat ----
test('fireWeapon fists never runs out, pistol consumes ammo', () => {
  const s = fresh();
  assert.equal(fireWeapon(s).ok, true);
  s.money = 10000;
  buyWeapon(s, 'pistol');
  s.weapon = 'pistol';
  const before = s.weapons.pistol.ammo;
  fireWeapon(s);
  assert.equal(s.weapons.pistol.ammo, before - 1);
});
test('fireWeapon fails when out of ammo', () => {
  const s = fresh();
  s.money = 10000;
  buyWeapon(s, 'pistol');
  s.weapon = 'pistol';
  s.weapons.pistol.ammo = 1;
  assert.equal(fireWeapon(s).ok, true);
  assert.equal(fireWeapon(s).ok, false);
});
test('fireWeapon damage matches weapon table', () => {
  const s = fresh();
  assert.equal(fireWeapon(s).damage, WEAPONS.fists.damage);
});
test('takeDamage drains armor first, then health, never below 0', () => {
  const s = fresh();
  s.armor = 50;
  takeDamage(s, 30);
  assert.equal(s.armor, 20);
  assert.equal(s.health, 100);
  takeDamage(s, 40);
  assert.equal(s.armor, 0);
  assert.equal(s.health, 80);
  takeDamage(s, 999);
  assert.equal(s.health, 0);
});
test('heal caps at 100', () => {
  const s = fresh();
  s.health = 90;
  assert.equal(heal(s, 50), 100);
});
test('buyWeapon refuses unknown, fists, and broke buyers', () => {
  const s = fresh();
  assert.equal(buyWeapon(s, 'nope').ok, false);
  assert.equal(buyWeapon(s, 'fists').ok, false);
  assert.equal(buyWeapon(s, 'rifle').ok, false); // $2200 > $120
});
test('buyWeapon buys and re-buy tops up ammo', () => {
  const s = fresh();
  s.money = 5000;
  assert.equal(buyWeapon(s, 'smg').ok, true);
  assert.equal(s.weapons.smg.ammo, WEAPONS.smg.ammo);
  const ammoBefore = s.weapons.smg.ammo;
  buyWeapon(s, 'smg');
  assert.ok(s.weapons.smg.ammo > ammoBefore);
});
test('buyAmmo adds rounds and charges', () => {
  const s = fresh();
  s.money = 5000;
  buyWeapon(s, 'pistol');
  const r = buyAmmo(s, 'pistol', 60);
  assert.equal(r.ok, true);
  assert.equal(s.weapons.pistol.ammo, 120);
  assert.equal(buyAmmo(s, 'smg', 10).ok, false);
});
test('buyArmor adds 50 armor, refuses at full and when broke', () => {
  const s = fresh();
  s.money = 1000;
  assert.equal(buyArmor(s).ok, true);
  assert.equal(s.armor, 50);
  s.armor = 100;
  assert.equal(buyArmor(s).ok, false);
});
test('all 5 weapons defined with sane stats', () => {
  assert.equal(Object.keys(WEAPONS).length, 5);
  for (const w of Object.values(WEAPONS)) {
    assert.ok(w.damage > 0 && w.range > 0 && w.rate > 0);
  }
});

// ---- Cars / garage ----
test('carStats base equals table, upgrades multiply', () => {
  const s = fresh();
  const base = carStats(s, 'beater');
  assert.equal(base.top, CARS.beater.top);
  s.cars.beater.upgrades = ['engine1', 'tires'];
  const up = carStats(s, 'beater');
  assert.ok(up.top > base.top && up.grip > base.grip);
});
test('carStats returns null for unknown car', () => assert.equal(carStats(fresh(), 'nope'), null));
test('buyCar refuses unknown, duplicate, and broke', () => {
  const s = fresh();
  assert.equal(buyCar(s, 'nope').ok, false);
  assert.equal(buyCar(s, 'beater').ok, false);
  assert.equal(buyCar(s, 'supercar').ok, false);
});
test('buyCar purchases and adds to garage', () => {
  const s = fresh();
  s.money = 5000;
  assert.equal(buyCar(s, 'coupe').ok, true);
  assert.ok(s.garage.includes('coupe'));
  assert.equal(s.money, 5000 - 2400);
});
test('buyUpgrade enforces chain engine2 needs engine1', () => {
  const s = fresh();
  s.money = 10000;
  assert.equal(buyUpgrade(s, 'beater', 'engine2').ok, false);
  assert.equal(buyUpgrade(s, 'beater', 'engine1').ok, true);
  assert.equal(buyUpgrade(s, 'beater', 'engine1').ok, false);
  assert.equal(buyUpgrade(s, 'beater', 'engine2').ok, true);
});
test('buyUpgrade refuses unowned car and unknown upgrade', () => {
  const s = fresh();
  assert.equal(buyUpgrade(s, 'coupe', 'nitro').ok, false);
  assert.equal(buyUpgrade(s, 'beater', 'nope').ok, false);
});
test('repairCar fixes to 100 and charges by damage', () => {
  const s = fresh();
  s.money = 1000;
  s.cars.beater.hp = 50;
  const r = repairCar(s, 'beater');
  assert.equal(r.ok, true);
  assert.equal(r.cost, 200);
  assert.equal(s.cars.beater.hp, 100);
  assert.equal(repairCar(s, 'beater').ok, false);
});
test('stealCar increments counter and adds a star', () => {
  const s = fresh();
  stealCar(s);
  assert.equal(s.carsStolen, 1);
  assert.equal(s.wanted, 1);
});
test('6 cars defined, 5 garage upgrades defined', () => {
  assert.equal(Object.keys(CARS).length, 6);
  assert.equal(GARAGE_UPGRADES.length, 5);
});

// ---- Time / weather / storm ----
test('advanceTime wraps at 24h and counts play seconds', () => {
  const s = fresh();
  s.timeOfDay = 23;
  advanceTime(s, 2);
  assert.equal(s.timeOfDay, 1);
  assert.equal(s.playSeconds, 7200);
});
test('isNight true at 22 and 3, false at 10', () => {
  const s = fresh();
  s.timeOfDay = 22; assert.equal(isNight(s), true);
  s.timeOfDay = 3; assert.equal(isNight(s), true);
  s.timeOfDay = 10; assert.equal(isNight(s), false);
});
test('sleepUntilMorning advances day, heals, clears wanted, raises storm', () => {
  const s = fresh();
  s.health = 40; addWanted(s, 3);
  const day = sleepUntilMorning(s);
  assert.equal(day, 2);
  assert.equal(s.health, 100);
  assert.equal(s.wanted, 0);
  assert.ok(s.storm > 0.05);
});
test('sleep on day 7 stays day 7', () => {
  const s = fresh();
  s.day = 7;
  assert.equal(sleepUntilMorning(s), 7);
});
test('weather worsens as days pass', () => {
  const s = fresh();
  assert.equal(s.weather, 'clear');
  sleepUntilMorning(s); assert.equal(s.weather, 'cloudy'); // day 2
  s.day = 4; sleepUntilMorning(s); assert.equal(s.weather, 'rain');
  s.day = 6; sleepUntilMorning(s); assert.equal(s.weather, 'storm');
});
test('stormIntensity grows toward landfall', () => {
  const s = fresh();
  assert.ok(stormIntensity(s) < stormIntensity({ ...s, day: 7 }));
});
test('hoursToLandfall decreases as days pass', () => {
  const s = fresh();
  assert.ok(hoursToLandfall(s) > hoursToLandfall({ ...s, day: 6 }));
});

// ---- Jobs / races / crew / radio ----
test('4 side jobs defined, doSideJob pays and adds respect', () => {
  assert.equal(SIDE_JOBS.length, 4);
  const s = fresh();
  const r = doSideJob(s, 'taxi');
  assert.equal(r.ok, true);
  assert.equal(s.money, START_MONEY + 120);
  assert.equal(s.jobsDone, 1);
  assert.equal(doSideJob(s, 'nope').ok, false);
});
test('winRace pays base + speed bonus and adds respect', () => {
  const s = fresh();
  const r = winRace(s, 60);
  assert.equal(r.ok, true);
  assert.equal(s.racesWon, 1);
  assert.equal(s.respect, 40);
  assert.ok(r.pay >= 500);
});
test('recruitCrew: luma costs 800, otis half-price repairs', () => {
  const s = fresh();
  s.money = 1000;
  assert.equal(recruitCrew(s, 'luma').ok, true);
  assert.ok(s.crew.includes('luma'));
  assert.equal(recruitCrew(s, 'luma').ok, false);
  assert.equal(recruitCrew(s, 'nope').ok, false);
  s.cars.beater.hp = 50;
  const r = repairCar(s, 'beater');
  assert.equal(r.cost, 200); // luma does not discount repairs; otis does (next test)
});
test('otis halves repair cost', () => {
  const s = fresh();
  s.money = 1000;
  recruitCrew(s, 'otis');
  s.cars.beater.hp = 50;
  assert.equal(repairCar(s, 'beater').cost, 100);
});
test('mara gives 15% shop discount', () => {
  const s = fresh();
  s.money = 5000;
  recruitCrew(s, 'mara');
  const before = s.money;
  buyWeapon(s, 'pistol');
  assert.equal(before - s.money, Math.round(350 * 0.85));
});
test('luma speeds wanted decay', () => {
  const s = fresh();
  addWanted(s, 1);
  const a = decayWanted(s, 10, false);
  const s2 = fresh();
  s2.crew = ['jax', 'luma'];
  addWanted(s2, 1);
  decayWanted(s2, 10, false);
  assert.ok(s2.wantedHeat > s.wantedHeat || s2.wanted <= a);
});
test('4 radio stations, setRadio wraps', () => {
  assert.equal(RADIO_STATIONS.length, 4);
  const s = fresh();
  assert.equal(setRadio(s, 5).id, RADIO_STATIONS[1].id);
  assert.equal(setRadio(s, -1).id, RADIO_STATIONS[3].id);
});
test('4 crew members with unique perks', () => {
  assert.equal(CREW.length, 4);
  const perks = new Set(CREW.map((c) => c.perk));
  assert.equal(perks.size, 4);
});

// ---- Save / load ----
test('serialize/deserialize round-trips state', () => {
  const s = fresh();
  s.money = 9999; s.respect = 500; s.day = 4;
  startMission(s, 'm1');
  const back = deserialize(serialize(s));
  assert.equal(back.money, 9999);
  assert.equal(back.respect, 500);
  assert.equal(back.day, 4);
  assert.equal(back.missionActive.id, 'm1');
});
test('deserialize handles garbage and missing fields', () => {
  assert.equal(deserialize('not json'), null);
  assert.equal(deserialize('null'), null);
  const back = deserialize('{"money": 5}');
  assert.equal(back.money, 5);
  assert.equal(back.health, 100);
  assert.deepEqual(back.missionsDone, []);
});
test('SAVE_KEY is versioned', () => assert.ok(SAVE_KEY.includes('v1')));
