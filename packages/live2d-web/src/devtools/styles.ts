export const DEVTOOLS_STYLES = `
:host {
  --devtools-accent: #ff718f;
  color-scheme: dark;
  display: block;
  min-width: 0;
  height: 100%;
  color: #f5f5f6;
  background: #111318;
  font: 13px/1.45 'MiSans Latin', 'Pretendard Variable', ui-sans-serif, system-ui, sans-serif;
}

* { box-sizing: border-box; }
button, input, select { font: inherit; }
button, input, select {
  color: inherit;
  border: 1px solid #343942;
  border-radius: 6px;
  background: #1d2128;
}
button, select { min-height: 34px; padding: 7px 9px; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .45; }
button:focus-visible, input:focus-visible, select:focus-visible {
  outline: 2px solid var(--devtools-accent);
  outline-offset: 2px;
}
input[type='text'], input[type='number'] { width: 100%; padding: 7px 9px; }
input[type='range'] { width: 100%; accent-color: var(--devtools-accent); }

.shell { display: flex; min-height: 100%; flex-direction: column; }
.top { padding: 14px; border-bottom: 1px solid #292d34; }
.top strong { display: block; font-size: 14px; }
.top span { color: #868c96; font-size: 11px; }
.tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid #292d34;
}
.tabs button { position: relative; min-width: 0; border-color: transparent; background: transparent; color: #b9bdc6; font-size: 12px; }
.tabs button[aria-selected='true'] { border-color: #343942; background: #171a20; color: #f5f5f6; }
.tabs button[aria-selected='true']::after { content: ''; position: absolute; right: 8px; bottom: -9px; left: 8px; height: 2px; background: var(--devtools-accent); }
.panel { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; scrollbar-color: #343942 transparent; scrollbar-width: thin; }
.panel::-webkit-scrollbar { width: 10px; }
.panel::-webkit-scrollbar-track { background: transparent; }
.panel::-webkit-scrollbar-thumb { border: 2px solid transparent; border-radius: 999px; background: #343942; background-clip: padding-box; }
.panel::-webkit-scrollbar-thumb:hover { background: #505762; background-clip: padding-box; }
.stack { display: grid; gap: 10px; }
.card { padding: 11px; border: 1px solid #292d34; border-radius: 7px; background: #171a20; }
.card-title { margin: 0 0 8px; font-size: 12px; font-weight: 600; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.row + .row { margin-top: 7px; }
.muted { color: #868c96; }
.value { color: #d7dbe3; font-family: ui-monospace, monospace; font-size: 11px; }
.field { display: grid; gap: 5px; }
.field > span { color: #b9bdc6; font-size: 12px; }
.actions { display: flex; flex-wrap: wrap; gap: 7px; }
.actions button { flex: 1; }
.parameter { display: grid; gap: 6px; padding: 9px 0; border-bottom: 1px solid #292d34; }
.parameter:last-child { border-bottom: 0; }
.parameter-name { overflow-wrap: anywhere; font-family: ui-monospace, monospace; font-size: 11px; }
.parameter-controls { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 7px; }
.parameter-controls button { min-height: 28px; padding: 4px 7px; font-size: 10px; }
.status { min-height: 28px; padding: 7px 12px; border-top: 1px solid #292d34; color: #868c96; font-size: 11px; }
.status[data-error='true'] { color: #ffaaa5; }
.queue { margin: 0; padding-left: 20px; color: #b9bdc6; }
.empty { padding: 24px 10px; color: #868c96; text-align: center; }
@media (max-width: 420px) {
  .tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`
