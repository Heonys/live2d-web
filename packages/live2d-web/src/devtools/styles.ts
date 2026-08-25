export const DEVTOOLS_STYLES = `
:host {
  color-scheme: dark;
  display: block;
  min-width: 0;
  height: 100%;
  color: #ecebf4;
  background: #15131d;
  font: 13px/1.45 Inter, ui-sans-serif, system-ui, sans-serif;
}

* { box-sizing: border-box; }
button, input, select { font: inherit; }
button, input, select {
  color: inherit;
  border: 1px solid #3d394c;
  border-radius: 8px;
  background: #211e2b;
}
button, select { min-height: 34px; padding: 7px 9px; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .45; }
button:focus-visible, input:focus-visible, select:focus-visible {
  outline: 2px solid #a99cff;
  outline-offset: 2px;
}
input[type='text'], input[type='number'] { width: 100%; padding: 7px 9px; }
input[type='range'] { width: 100%; accent-color: #9e91ef; }

.shell { display: flex; min-height: 100%; flex-direction: column; }
.top { padding: 14px; border-bottom: 1px solid #302c3b; }
.top strong { display: block; font-size: 14px; }
.top span { color: #8f8a9d; font-size: 11px; }
.tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid #302c3b;
}
.tabs button { min-width: 0; border-color: transparent; background: transparent; font-size: 11px; }
.tabs button[aria-selected='true'] { border-color: #504a62; background: #292536; color: #c9c1ff; }
.panel { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; }
.stack { display: grid; gap: 10px; }
.card { padding: 11px; border: 1px solid #302c3b; border-radius: 10px; background: #1b1823; }
.card h3 { margin: 0 0 8px; font-size: 12px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.row + .row { margin-top: 7px; }
.muted { color: #8f8a9d; }
.value { color: #c9c1ff; font-family: ui-monospace, monospace; font-size: 11px; }
.field { display: grid; gap: 5px; }
.field > span { color: #aaa5b7; font-size: 11px; }
.actions { display: flex; flex-wrap: wrap; gap: 7px; }
.actions button { flex: 1; }
.parameter { display: grid; gap: 6px; padding: 9px 0; border-bottom: 1px solid #2b2735; }
.parameter:last-child { border-bottom: 0; }
.parameter-name { overflow-wrap: anywhere; font-family: ui-monospace, monospace; font-size: 11px; }
.parameter-controls { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 7px; }
.parameter-controls button { min-height: 28px; padding: 4px 7px; font-size: 10px; }
.status { min-height: 28px; padding: 7px 12px; border-top: 1px solid #302c3b; color: #8f8a9d; font-size: 11px; }
.status[data-error='true'] { color: #ffb4b4; }
.queue { margin: 0; padding-left: 20px; color: #aaa5b7; }
.empty { padding: 24px 10px; color: #8f8a9d; text-align: center; }
@media (max-width: 420px) {
  .tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`
