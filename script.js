const defaults = {
  primary: '#f15a2c',
  accent: '#4cc2ff',
  bg: '#101216',
  surface: '#1a1f28',
  text: '#f5f7ff',
  muted: '#94a3b8',
  sidebar: '#0b0e13',
  fontFamily: 'Inter',
  fontSize: 15,
  radius: 12,
  shadow: 45,
};

const ids = ['primary', 'accent', 'bg', 'surface', 'text', 'muted', 'sidebar'];
const root = document.documentElement;
const output = document.getElementById('css-output');
const fontSelect = document.getElementById('font-family');
const fontSize = document.getElementById('font-size');
const radius = document.getElementById('radius');
const shadow = document.getElementById('shadow');
const fontSizeOut = document.getElementById('font-size-out');
const radiusOut = document.getElementById('radius-out');
const shadowOut = document.getElementById('shadow-out');
const fontLink = document.getElementById('google-font-link');

function fontUrl(name) {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400;500;600;700&display=swap`;
}

function currentState() {
  const colorState = Object.fromEntries(ids.map((id) => [id, document.getElementById(id).value]));
  return {
    ...colorState,
    fontFamily: fontSelect.value,
    fontSize: Number(fontSize.value),
    radius: Number(radius.value),
    shadow: Number(shadow.value),
  };
}

function renderCSS(state) {
  return `/* Generated for Unraid - Custom WebUI CSS */
@import url('${fontUrl(state.fontFamily)}');

:root {
  --my-primary: ${state.primary};
  --my-accent: ${state.accent};
  --my-bg: ${state.bg};
  --my-surface: ${state.surface};
  --my-text: ${state.text};
  --my-muted: ${state.muted};
  --my-sidebar: ${state.sidebar};
  --my-radius: ${state.radius}px;
}

body,
#root,
.unraid-body,
.app {
  background: var(--my-bg) !important;
  color: var(--my-text) !important;
  font-family: '${state.fontFamily}', system-ui, sans-serif !important;
  font-size: ${state.fontSize}px !important;
}

.sidebar,
nav,
.navigation,
.left-nav {
  background: var(--my-sidebar) !important;
}

.card,
.panel,
.widget,
.modal-content,
.table,
.react-grid-item {
  background: var(--my-surface) !important;
  border-radius: var(--my-radius) !important;
  border-color: color-mix(in oklab, var(--my-surface), white 14%) !important;
  box-shadow: 0 10px 30px rgba(0,0,0,${(state.shadow / 100).toFixed(2)}) !important;
}

a,
.link,
.text-primary,
.btn-primary,
button.btn-primary {
  color: var(--my-primary) !important;
}

.btn-primary,
button.btn-primary,
.badge-primary,
.progress-bar {
  background: var(--my-primary) !important;
  border-color: var(--my-primary) !important;
}

.text-muted,
.small,
.card-subtitle {
  color: var(--my-muted) !important;
}

.status-ok,
.text-success,
.online-indicator {
  color: var(--my-accent) !important;
}`;
}

function apply(state) {
  ids.forEach((id) => root.style.setProperty(`--${id}`, state[id]));
  root.style.setProperty('--font-family', `'${state.fontFamily}', system-ui, sans-serif`);
  root.style.setProperty('--font-size', `${state.fontSize}px`);
  root.style.setProperty('--radius', `${state.radius}px`);
  root.style.setProperty('--shadow-strength', `${state.shadow}%`);

  fontSizeOut.value = `${state.fontSize}px`;
  radiusOut.value = `${state.radius}px`;
  shadowOut.value = `${state.shadow}%`;

  fontLink.href = fontUrl(state.fontFamily);
  output.value = renderCSS(state);
}

function resetForm() {
  ids.forEach((id) => {
    document.getElementById(id).value = defaults[id];
  });

  fontSelect.value = defaults.fontFamily;
  fontSize.value = defaults.fontSize;
  radius.value = defaults.radius;
  shadow.value = defaults.shadow;

  apply(currentState());
}

ids.forEach((id) => {
  document.getElementById(id).addEventListener('input', () => apply(currentState()));
});

[fontSelect, fontSize, radius, shadow].forEach((el) => {
  el.addEventListener('input', () => apply(currentState()));
});

document.getElementById('copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(output.value);
  const original = document.getElementById('copy').textContent;
  document.getElementById('copy').textContent = 'Kopieret!';
  setTimeout(() => {
    document.getElementById('copy').textContent = original;
  }, 1200);
});

document.getElementById('reset').addEventListener('click', resetForm);

apply({ ...defaults });
