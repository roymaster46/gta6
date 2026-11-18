// input.js — keyboard + mouse state for Solmarina.
// The game reads keys by logical name; this module owns the listeners.
// New bindings in this revision: G opens the garage upgrade shop near the
// Pay-n-Spray, N fires the nitro boost in a car that has the kit fitted,
// and C cycles the car radio through its four stations.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // keys pressed since last poll (edge-triggered)
  const mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false, clicked: false, rdown: false };
  let anyKey = false;

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    Space: 'handbrake',
    KeyE: 'enter', KeyP: 'pause', KeyM: 'mute', KeyR: 'restart',
    KeyF: 'interact', Escape: 'escape', Enter: 'confirm', KeyH: 'horn',
    KeyG: 'garage', KeyN: 'nitro', KeyC: 'station',
  };

  function onKeyDown(e) {
    const name = KEYMAP[e.code];
    if (!name) return;
    if (['up', 'down', 'left', 'right', 'handbrake'].includes(name)) e.preventDefault();
    if (!keys.has(name)) pressed.add(name);
    keys.add(name);
    anyKey = true;
  }
  function onKeyUp(e) {
    const name = KEYMAP[e.code];
    if (name) keys.delete(name);
  }
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }
  function onMouseDown(e) {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
    if (e.button === 2) mouse.rdown = true;
  }
  function onMouseUp(e) {
    if (e.button === 0) mouse.down = false;
    if (e.button === 2) mouse.rdown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys, pressed, mouse,
    is(name) { return keys.has(name); },
    // True once, on the frame the key went down.
    wasPressed(name) { return pressed.has(name); },
    consume(name) { pressed.delete(name); },
    endFrame() { pressed.clear(); mouse.clicked = false; },
    get anyKey() { return anyKey; },
    clearAnyKey() { anyKey = false; },
  };
}
