// Ember Harbor — keyboard + mouse input. The browser side only: it tracks
// held keys, turns them into a movement vector, and fires one-shot actions
// (interact, shoot, pause...) that the game loop consumes exactly once.
// Mouse drag orbits the third-person camera; the wheel zooms it.

export const ACTION_INTERACT = 1;
export const ACTION_JUMP = 2;
export const ACTION_PAUSE = 4;
export const ACTION_CONFIRM = 8;
export const ACTION_SHOOT = 16;
export const ACTION_NITRO = 32;
export const ACTION_HORN = 64;
export const ACTION_CAMERA = 128;
// r6: shop (buy at the gun shop), descend (bring the heli down), and
// vigilante (take the next wanted criminal job).
export const ACTION_SHOP = 256;
export const ACTION_DESCEND = 512;
export const ACTION_VIGILANTE = 1024;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'jump',
  KeyE: 'interact',
  KeyF: 'shoot',
  KeyN: 'nitro',
  KeyH: 'horn',
  KeyC: 'camera',
  KeyP: 'pause', Escape: 'pause',
  Enter: 'confirm',
  Digit1: 'w1', Digit2: 'w2', Digit3: 'w3', Digit4: 'w4', Digit5: 'w5',
  KeyM: 'mute', KeyR: 'reload', KeyG: 'garage',
  // r6 keys: B shop, X heli descend, V vigilante job, Ctrl crouch/stealth.
  KeyB: 'shop', KeyX: 'descend', KeyV: 'vigilante',
  ControlLeft: 'crouch', ControlRight: 'crouch',
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let camYaw = Math.PI;
  let camPitch = 0.42;
  let camDist = 11;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let mouseDown = false;

  function onKeyDown(e) {
    const name = KEYMAP[e.code];
    if (!name) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    held.add(name);
    if (name === 'interact') actions |= ACTION_INTERACT;
    if (name === 'jump') actions |= ACTION_JUMP;
    if (name === 'pause') actions |= ACTION_PAUSE;
    if (name === 'confirm') actions |= ACTION_CONFIRM;
    if (name === 'shoot') actions |= ACTION_SHOOT;
    if (name === 'nitro') actions |= ACTION_NITRO;
    if (name === 'horn') actions |= ACTION_HORN;
    if (name === 'camera') actions |= ACTION_CAMERA;
    if (name === 'shop') actions |= ACTION_SHOP;
    if (name === 'descend') actions |= ACTION_DESCEND;
    if (name === 'vigilante') actions |= ACTION_VIGILANTE;
  }

  function onKeyUp(e) {
    const name = KEYMAP[e.code];
    if (name) held.delete(name);
  }

  function onMouseDown(e) {
    if (e.button === 0) {
      mouseDown = true;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      actions |= ACTION_SHOOT;
    }
    if (e.button === 2) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
  }

  function onMouseMove(e) {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    camYaw -= dx * 0.005;
    camPitch = Math.max(0.12, Math.min(1.1, camPitch + dy * 0.003));
  }

  function onMouseUp() {
    dragging = false;
    mouseDown = false;
  }

  function onWheel(e) {
    e.preventDefault();
    camDist = Math.max(6, Math.min(20, camDist + Math.sign(e.deltaY) * 1.2));
  }

  function onBlur() {
    held.clear();
    dragging = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    get camYaw() { return camYaw; },
    get camPitch() { return camPitch; },
    get camDist() { return camDist; },
    get mouseDown() { return mouseDown; },
    setCamYaw(v) { camYaw = v; },
    move() {
      const x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      const y = (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0);
      return { moveX: x, moveY: y, sprint: held.has('sprint'), jump: held.has('jump'), crouch: held.has('crouch') };
    },
    isHeld(name) { return held.has(name); },
    takeActions() {
      const a = actions;
      actions = 0;
      return a;
    },
    peekActions() { return actions; },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
    },
  };
}
