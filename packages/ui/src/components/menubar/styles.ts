/**
 * Menubar popover shell styles — popover container, title, view buttons,
 * chart area, KPI values, labels, footer, open button.
 *
 * Rendered by MenubarActivity (via menubar-page.tsx) and MenubarOnboard
 * via <style>. Child components (view-switch, recent-heatmap) trust the
 * parent has loaded these styles.
 */
export const menubarPopoverStyles = `
.menubar-popover {
  background: var(--menubar-popover-bg);
  backdrop-filter: var(--menubar-popover-backdrop);
  border: 1px solid var(--menubar-popover-border);
  border-radius: var(--menubar-popover-radius);
  box-shadow: var(--menubar-popover-shadow);
  clip-path: var(--menubar-popover-clip);
}

.menubar-popover::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: var(--menubar-popover-overlay);
  mix-blend-mode: screen;
}

.menubar-popover::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 0.125rem;
  pointer-events: none;
  background: var(--menubar-popover-accent);
  box-shadow: var(--menubar-title-shadow);
}

[data-theme='cyberpunk'] .menubar-popover::after {
  right: auto;
  width: 50%;
}

.menubar-popover-corner {
  position: absolute;
  right: 0;
  bottom: 1.125rem;
  width: 1.125rem;
  height: 1.125rem;
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
  background: var(--menubar-popover-corner);
  opacity: 0.5;
  pointer-events: none;
}

.menubar-title {
  color: var(--menubar-title-color);
  font-family: var(--menubar-title-font);
  font-size: var(--menubar-title-size);
  font-weight: var(--menubar-title-weight);
  letter-spacing: var(--menubar-title-letter-spacing);
  line-height: 1;
  text-shadow: var(--menubar-title-shadow);
  text-transform: uppercase;
}

.menubar-title::before {
  content: var(--menubar-title-prefix);
  color: var(--menubar-title-prefix-color);
  text-shadow: var(--menubar-switch-hover-shadow);
}

.menubar-view-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--menubar-switch-size);
  height: var(--menubar-switch-size);
  padding: 0;
  color: var(--menubar-switch-color);
  background: transparent;
  border: 1px solid var(--menubar-switch-border);
  border-radius: var(--menubar-switch-radius);
  clip-path: var(--menubar-switch-clip);
  cursor: pointer;
  line-height: 1;
  transition:
    color var(--motion-fast) var(--motion-ease-out),
    background-color var(--motion-fast) var(--motion-ease-out),
    border-color var(--motion-fast) var(--motion-ease-out);
}

.menubar-view-button:hover {
  color: var(--menubar-switch-hover-color);
  background: var(--menubar-switch-hover-bg);
  border-color: var(--menubar-switch-hover-border);
  text-shadow: var(--menubar-switch-hover-shadow);
}

.menubar-view-button[data-active='true'] {
  color: var(--menubar-switch-active-color);
  background: var(--menubar-switch-active-bg);
  border-color: var(--menubar-switch-active-border);
  filter: var(--menubar-switch-active-shadow);
}

.menubar-chart-area {
  background: var(--menubar-chart-bg);
}

.menubar-kpi-value {
  color: var(--menubar-kpi-token-color);
  font-family: var(--menubar-kpi-font);
  font-size: var(--menubar-kpi-size);
  font-weight: var(--menubar-kpi-weight);
  letter-spacing: var(--menubar-kpi-letter-spacing);
  line-height: var(--menubar-kpi-line-height);
  font-variant-numeric: tabular-nums;
}

.menubar-kpi-value[data-kpi='tokens'] {
  color: var(--menubar-kpi-token-color);
  text-shadow: var(--menubar-kpi-token-shadow);
}

.menubar-kpi-value[data-kpi='sessions'] {
  color: var(--menubar-kpi-session-color);
  text-shadow: var(--menubar-kpi-session-shadow);
}

.menubar-kpi-value[data-kpi='peak'] {
  color: var(--menubar-kpi-peak-color);
  text-shadow: var(--menubar-kpi-peak-shadow);
}

.menubar-label {
  color: var(--menubar-label-color);
  font-family: var(--menubar-label-font);
  font-size: var(--menubar-label-size);
  font-weight: var(--menubar-label-weight);
  letter-spacing: var(--menubar-label-letter-spacing);
  text-transform: uppercase;
}

.menubar-footer-meta {
  color: var(--menubar-footer-meta-color);
  text-shadow: var(--menubar-open-shadow);
}

.menubar-open {
  color: var(--menubar-open-color);
  background: var(--menubar-open-bg);
  border: 1px solid var(--menubar-open-border);
  clip-path: var(--menubar-open-clip);
  padding: var(--menubar-open-padding);
  text-shadow: var(--menubar-open-shadow);
}

.menubar-open:hover {
  color: var(--menubar-open-hover-color);
  border-color: currentColor;
}
`

/**
 * Compact onboarding state styles — shrunk retro-computer scene + centered copy.
 * Rendered by MenubarOnboard via <style> (combined with menubarPopoverStyles).
 */
export const menubarOnboardStyles = `
.menubar-onboard-scene {
  position: relative;
  height: 188px;
  margin: 0 -0.25rem 0.5rem;
  overflow: hidden;
  border-radius: var(--menubar-popover-radius);
  display: flex;
  align-items: center;
  justify-content: center;
}
.menubar-onboard-glitch {
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0.14;
  pointer-events: none;
}
.menubar-onboard-computer {
  position: relative;
  z-index: 1;
  width: 132px;
  aspect-ratio: 1 / 1;
}
.menubar-onboard-computer .atropos-inner {
  overflow: visible;
  border-radius: 0;
  background: transparent;
}
.menubar-onboard-computer .onboard-atropos-scene {
  position: absolute;
  inset: 0;
}
.menubar-onboard-computer .onboard-keyboard img,
.menubar-onboard-computer .onboard-keyboard-back img {
  transform: translate(-6%, 28%) scale(0.7);
}
.menubar-onboard-computer .onboard-keyboard-back img {
  transform: translate(-6%, 28%) scale(0.7) translate(10px, 8px);
}
.menubar-onboard-computer .onboard-letter-bg,
.menubar-onboard-computer .onboard-rim {
  display: none;
}
.menubar-onboard-head {
  text-align: center;
  font-family: var(--font-display);
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  line-height: 1.25;
}
.menubar-onboard-sub {
  text-align: center;
  font-family: var(--menubar-label-font);
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--menubar-label-color);
  max-width: 16rem;
  margin: 0.125rem auto 0;
}
.menubar-onboard-status {
  text-align: center;
  font-family: var(--font-mono, var(--menubar-label-font));
  font-size: 0.6875rem;
  line-height: 1.4;
  color: var(--menubar-title-prefix-color);
  margin-top: 0.25rem;
}
`
