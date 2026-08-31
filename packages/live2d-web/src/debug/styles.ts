export const DEBUG_OVERLAY_STYLES = `
:host {
  --debug-accent: #ff718f;
  --debug-line: #343942;
  position: absolute;
  inset: 0;
  z-index: 2147483000;
  color-scheme: dark;
  color: #f5f5f6;
  font: 12px/1.45 'MiSans Latin', 'Pretendard Variable', ui-sans-serif, system-ui, sans-serif;
}

* { box-sizing: border-box; }

.surface {
  position: absolute;
  inset: 0;
  cursor: grab;
  touch-action: none;
  outline: none;
}
.surface[data-dragging='true'] { cursor: grabbing; }
.surface:focus-visible { box-shadow: inset 0 0 0 2px var(--debug-accent); }

.frame {
  position: absolute;
  inset: 0;
  border: 1px dashed rgba(245, 245, 246, .3);
  pointer-events: none;
}
.crosshair {
  position: absolute;
  background: rgba(245, 245, 246, .16);
  pointer-events: none;
}
.crosshair.x { left: 50%; top: 0; bottom: 0; width: 1px; }
.crosshair.y { top: 50%; left: 0; right: 0; height: 1px; }

/* One row at every width. A wrapping toolbar grew to a third of a phone-sized
   canvas, covering the model it exists to position. */
.bar {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0;
  max-width: calc(100% - 24px);
  padding: 5px 7px;
  overflow-x: auto;
  scrollbar-width: none;
  border-radius: 13px;
  background: rgba(23, 26, 32, .94);
  white-space: nowrap;
}
.bar::-webkit-scrollbar { display: none; }
.bar[data-dragging='true'] { opacity: .3; }
@media (prefers-reduced-motion: no-preference) {
  .bar { transition: opacity .12s ease; }
}

/* Hierarchy by brightness, not by filling the selected item. A high-contrast
   chip on a near-black canvas pulls the eye off the model being positioned. */
button {
  flex: none;
  min-height: 26px;
  padding: 4px 10px;
  color: #8b919c;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font: inherit;
  cursor: pointer;
}
button:hover { color: #d7dae0; }
button:disabled { color: #565c66; cursor: default; }
button:focus-visible { outline: 2px solid var(--debug-accent); outline-offset: -2px; }
button[aria-pressed='true'] { color: #f5f5f6; }
button.step { min-width: 28px; padding: 4px 0; font-size: 15px; }

.zoom {
  flex: none;
  min-width: 44px;
  color: #f5f5f6;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.divider {
  flex: none;
  width: 1px;
  height: 16px;
  margin: 0 7px;
  background: rgba(245, 245, 246, .12);
}

/* Onboarding, not chrome: it goes once the tool has been touched. */
.hint {
  position: absolute;
  left: 50%;
  bottom: 56px;
  transform: translateX(-50%);
  max-width: calc(100% - 24px);
  margin: 0;
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(23, 26, 32, .82);
  color: #8b919c;
  text-align: center;
}

/* Only shown when the clipboard refuses, so the value can still be selected. */
.value {
  position: absolute;
  left: 50%;
  bottom: 52px;
  transform: translateX(-50%);
  max-width: calc(100% - 24px);
  overflow-x: auto;
  padding: 6px 10px;
  border: 1px solid var(--debug-line);
  border-radius: 7px;
  background: #0b0d11;
  color: #d7dae0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: nowrap;
  user-select: all;
}

[hidden] { display: none !important; }
`
