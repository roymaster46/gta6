// Ember Harbor — r7 weather + day/night gameplay. Weather is no longer
// scenery: rain makes roads slick (longer braking, more drift), fog cuts
// police sight range, night makes patrols stricter (heat builds faster,
// roadblocks appear a star earlier), and storms ground the helicopter.
// The cycle runs on the same 6-minute day as the renderer; this module
// owns the rules, the renderer owns the sky.

import { clamp, lerp } from './utils.js';

export const WEATHER_TYPES = ['clear', 'rain', 'fog', 'storm', 'heat-haze'];
export const WEATHER_LABELS = {
  clear: 'Clear skies',
  rain: 'Rain — roads are slick',
  fog: 'Fog — visibility down',
  storm: 'Storm — heli grounded',
  'heat-haze': 'Heat haze — the city shimmers',
};

export function weatherLabel(w) {
  return WEATHER_LABELS[w] || WEATHER_TYPES[0];
}

export const DAY_PHASES = [
  { id: 'night', from: 0.0, to: 0.22, label: 'Deep night', light: 0.15, patrol: 1.35 },
  { id: 'dawn', from: 0.22, to: 0.32, label: 'Dawn', light: 0.5, patrol: 1.1 },
  { id: 'morning', from: 0.32, to: 0.5, label: 'Morning', light: 1.0, patrol: 1.0 },
  { id: 'afternoon', from: 0.5, to: 0.68, label: 'Afternoon', light: 1.0, patrol: 1.0 },
  { id: 'dusk', from: 0.68, to: 0.78, label: 'Dusk', light: 0.55, patrol: 1.15 },
  { id: 'evening', from: 0.78, to: 0.85, label: 'Evening', light: 0.35, patrol: 1.25 },
  { id: 'night', from: 0.85, to: 1.0, label: 'Night', light: 0.2, patrol: 1.35 },
];

export function phaseAt(dayTime) {
  for (const p of DAY_PHASES) {
    if (dayTime >= p.from && dayTime < p.to) return p;
  }
  return DAY_PHASES[DAY_PHASES.length - 1];
}

export function isNight(dayTime) {
  return dayTime < 0.22 || dayTime >= 0.85;
}

export function isDusk(dayTime) {
  return (dayTime >= 0.68 && dayTime < 0.85) || (dayTime >= 0.16 && dayTime < 0.22);
}

export function lightLevel(dayTime) {
  return phaseAt(dayTime).light;
}

export function patrolMultiplier(dayTime) {
  return phaseAt(dayTime).patrol;
}

export function createWeatherState() {
  return {
    current: 'clear',
    previous: 'clear',
    timer: 75,
    intensity: 0,
    targetIntensity: 0,
    changes: 0,
    rainTotal: 0,
    stormTotal: 0,
    nightMinutes: 0,
    slick: 0,
    visibility: 1,
    forecast: ['clear', 'clear', 'rain'],
  };
}

// Gameplay modifiers for the current weather. Slickness is 0..1 (rain),
// visibility 0..1 (fog), heliGrounded is a hard rule for storms.
export function weatherModifiers(weather, intensity) {
  const i = clamp(intensity ?? 1, 0, 1);
  if (weather === 'rain') {
    return { slick: 0.45 * i, visibility: 0.85, gripFactor: 1 - 0.35 * i, brakeFactor: 1 + 0.5 * i, heliGrounded: false, patrol: 0.9, label: 'Rain — slick roads' };
  }
  if (weather === 'fog') {
    return { slick: 0.05, visibility: 0.45, gripFactor: 1, brakeFactor: 1, heliGrounded: false, patrol: 0.75, label: 'Fog — cops cannot see far' };
  }
  if (weather === 'storm') {
    return { slick: 0.7, visibility: 0.55, gripFactor: 0.55, brakeFactor: 1.8, heliGrounded: true, patrol: 1.1, label: 'Storm — no flying' };
  }
  if (weather === 'heat-haze') {
    return { slick: 0, visibility: 0.8, gripFactor: 1, brakeFactor: 1, heliGrounded: false, patrol: 1.05, label: 'Heat haze' };
  }
  return { slick: 0, visibility: 1, gripFactor: 1, brakeFactor: 1, heliGrounded: false, patrol: 1, label: 'Clear skies' };
}

export function pickNextWeather(rng, current, dayTime) {
  const night = isNight(dayTime);
  const roll = rng();
  if (current === 'clear') {
    if (roll < 0.42) return 'rain';
    if (roll < 0.58) return 'fog';
    if (roll < 0.64 && night) return 'storm';
    if (roll < 0.72 && !night) return 'heat-haze';
    return 'clear';
  }
  if (current === 'rain') {
    if (roll < 0.25) return 'storm';
    if (roll < 0.7) return 'clear';
    return 'fog';
  }
  if (current === 'storm') return roll < 0.7 ? 'rain' : 'clear';
  if (current === 'fog') return roll < 0.6 ? 'clear' : 'rain';
  return 'clear';
}

export function updateWeather(state, dt, rng, dayTime) {
  state.timer -= dt;
  if (isNight(dayTime)) state.nightMinutes += dt / 60;
  const mods = weatherModifiers(state.current, state.intensity);
  state.slick = mods.slick;
  state.visibility = mods.visibility;
  if (state.current === 'rain') state.rainTotal += dt;
  if (state.current === 'storm') state.stormTotal += dt;
  // Intensity eases toward its target so rain fades in, not on.
  state.intensity = lerp(state.intensity, state.targetIntensity, Math.min(1, dt * 0.4));
  if (state.timer <= 0) {
    const next = pickNextWeather(rng, state.current, dayTime);
    state.previous = state.current;
    state.current = next;
    state.timer = 70 + rng() * 70;
    state.targetIntensity = next === 'clear' ? 0 : 0.55 + rng() * 0.45;
    state.changes += 1;
    state.forecast = [next, pickNextWeather(rng, next, dayTime), pickNextWeather(rng, next, dayTime)];
    return { type: 'weather-changed', from: state.previous, to: next, label: weatherLabel(next) };
  }
  return null;
}

export function forceWeather(state, weather) {
  state.previous = state.current;
  state.current = weather;
  state.targetIntensity = weather === 'clear' ? 0 : 1;
  state.intensity = weather === 'clear' ? 0 : 0.8;
  state.timer = 90;
  return state.current;
}

// How much the weather changes a chase: rain helps the player lose cops
// (they slide too), fog hides the player, night makes cops arrive faster.
export function chaseModifiers(weather, dayTime, intensity) {
  const w = weatherModifiers(weather, intensity);
  const night = patrolMultiplier(dayTime);
  return {
    copSpeed: w.patrol * (night > 1.2 ? 1.08 : 1),
    copSight: w.visibility * (night > 1.2 ? 0.85 : 1),
    playerGrip: w.gripFactor,
    heliAllowed: !w.heliGrounded,
    roadblockEarly: night > 1.2,
  };
}

export function heatRateMultiplier(weather, dayTime) {
  // Night patrols are stricter: the same crime builds heat faster.
  // Rain gives a small break — fewer witnesses out in it.
  const night = patrolMultiplier(dayTime);
  const rainBreak = weather === 'rain' ? 0.9 : weather === 'fog' ? 0.85 : 1;
  return night * rainBreak;
}

export function roadblockStars(weather, dayTime) {
  // At night the PD seals avenues at 3 stars instead of 4.
  return isNight(dayTime) ? 3 : 4;
}

export function heliStars(weather, dayTime) {
  return isNight(dayTime) ? 3 : 4;
}

export function visibilityRange(base, weather, intensity) {
  return base * weatherModifiers(weather, intensity).visibility;
}

export function rainIntensityLabel(state) {
  if (state.current !== 'rain' && state.current !== 'storm') return 'dry';
  if (state.intensity > 0.8) return 'downpour';
  if (state.intensity > 0.45) return 'steady rain';
  return 'drizzle';
}

export function weatherSummary(state, dayTime) {
  const phase = phaseAt(dayTime);
  const mods = weatherModifiers(state.current, state.intensity);
  return {
    weather: state.current,
    label: weatherLabel(state.current),
    phase: phase.label,
    light: phase.light,
    night: isNight(dayTime),
    slick: Math.round(mods.slick * 100) / 100,
    visibility: mods.visibility,
    heliGrounded: mods.heliGrounded,
    intensity: Math.round(state.intensity * 100) / 100,
    changes: state.changes,
    forecast: state.forecast.slice(),
  };
}

export function forecastText(state) {
  return `Later: ${state.forecast.map((w) => weatherLabel(w)).join(' → ')}`;
}

export function dayLengthMinutes(dayTime) {
  return Math.floor(dayTime * 24 * 60);
}

export function timeUntilPhase(dayTime, phaseId) {
  const target = DAY_PHASES.find((p) => p.id === phaseId);
  if (!target) return null;
  let d = target.from - dayTime;
  if (d <= 0) d += 1;
  return Math.round(d * 360);
}

export function stormWarning(state) {
  return state.current === 'storm' && state.intensity > 0.6;
}
