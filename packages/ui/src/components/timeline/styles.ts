/**
 * Timeline page chrome styles — page title, lede, tabs, filter, stats.
 * Rendered by TimelineView via <style>.
 */
export const timelinePageStyles = `
.timeline-page-title {
  color: var(--timeline-title-color);
  font-family: var(--timeline-title-font);
  font-size: var(--timeline-title-size);
  font-weight: var(--timeline-title-weight);
  letter-spacing: var(--timeline-title-letter-spacing);
  line-height: var(--timeline-title-line-height);
  text-shadow: var(--timeline-title-shadow);
  text-transform: var(--timeline-title-transform);
}
.timeline-page-title::before {
  content: var(--timeline-title-prefix);
  color: var(--timeline-title-prefix-color);
  font-weight: 400;
  text-shadow: var(--timeline-title-prefix-shadow);
}
.timeline-page-lede {
  color: var(--timeline-lede-color);
  font-family: var(--timeline-lede-font);
  font-size: var(--timeline-lede-size);
  font-weight: var(--timeline-lede-weight);
  letter-spacing: var(--timeline-lede-letter-spacing);
  line-height: var(--timeline-lede-line-height);
}
.timeline-tabs {
  border: 1px solid var(--timeline-control-border);
  border-radius: var(--timeline-control-radius);
  background: var(--timeline-control-bg);
  clip-path: var(--timeline-control-clip);
}
.timeline-tab {
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: var(--timeline-control-color);
  font-family: var(--timeline-control-font);
  font-size: var(--timeline-control-size);
  font-weight: var(--timeline-control-weight);
  letter-spacing: var(--timeline-control-letter-spacing);
  line-height: 1.2;
  text-transform: var(--timeline-control-transform);
  box-shadow: none !important;
  text-shadow: none;
}
.timeline-tab + .timeline-tab {
  border-left: 1px solid var(--border-subtle);
}
.timeline-tab:hover {
  color: var(--timeline-control-hover-color);
  text-shadow: var(--timeline-control-hover-shadow);
}
.timeline-tab[data-state='active'] {
  background: var(--timeline-control-active-bg) !important;
  color: var(--timeline-control-active-color) !important;
  box-shadow: var(--timeline-control-active-shadow) !important;
  text-shadow: var(--timeline-control-active-text-shadow) !important;
}
.timeline-filter-select {
  border: 1px solid var(--timeline-select-border);
  border-radius: var(--timeline-control-radius);
  background: var(--timeline-select-bg) !important;
  color: var(--timeline-select-color);
  clip-path: var(--timeline-control-clip);
  font-family: var(--timeline-control-font);
  font-size: var(--timeline-control-size);
  font-weight: var(--timeline-control-weight);
  letter-spacing: var(--timeline-control-letter-spacing);
  line-height: 1.2;
  text-shadow: var(--timeline-control-hover-shadow);
  text-transform: var(--timeline-control-transform);
}
.timeline-filter-select:hover,
.timeline-filter-select[data-state='open'] {
  border-color: var(--timeline-select-hover-border);
  box-shadow: var(--timeline-select-hover-shadow);
}
.timeline-filter-label {
  color: var(--timeline-select-label-color);
  text-shadow: none;
}
.timeline-filter-value {
  color: var(--timeline-select-color);
}
.timeline-stats {
  color: var(--timeline-stats-color);
  font-family: var(--timeline-stats-font);
  letter-spacing: var(--timeline-stats-letter-spacing);
}
.timeline-stats b {
  color: var(--timeline-stats-value-color);
  font-weight: 500;
  text-shadow: var(--timeline-stats-shadow);
}
.timeline-stats .sep {
  color: var(--timeline-stats-sep-color);
}
`

/**
 * Heatmap card styles — card container, month strip, DOW labels, legend.
 * Rendered by ContributionGraph via <style>.
 */
export const heatmapCardStyles = `
.timeline-heatmap-card {
  background: var(--heatmap-panel-bg);
  border: 1px solid var(--heatmap-panel-border);
  border-radius: var(--heatmap-panel-radius);
  box-shadow: var(--heatmap-panel-shadow);
  clip-path: var(--heatmap-panel-clip);
}
.timeline-heatmap-card::before,
.timeline-heatmap-card::after {
  content: '';
  position: absolute;
  width: var(--heatmap-corner-size);
  height: var(--heatmap-corner-size);
  pointer-events: none;
}
.timeline-heatmap-card::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--heatmap-corner-a-color);
  border-left: 2px solid var(--heatmap-corner-a-color);
  box-shadow: var(--heatmap-corner-a-shadow);
}
.timeline-heatmap-card::after {
  right: -1px;
  bottom: -1px;
  border-right: 2px solid var(--heatmap-corner-b-color);
  border-bottom: 2px solid var(--heatmap-corner-b-color);
  box-shadow: var(--heatmap-corner-b-shadow);
}
.timeline-heatmap-months {
  color: var(--heatmap-month-color);
  font-family: var(--heatmap-month-font);
  font-weight: var(--heatmap-month-weight);
  letter-spacing: var(--heatmap-month-letter-spacing);
  text-shadow: var(--heatmap-month-shadow);
}
.timeline-heatmap-dows {
  color: var(--heatmap-dow-color);
  font-family: var(--heatmap-dow-font);
  font-weight: var(--heatmap-dow-weight);
  letter-spacing: var(--heatmap-dow-letter-spacing);
}
.timeline-heatmap-dow-visible {
  color: var(--heatmap-dow-active-color);
  text-shadow: var(--heatmap-dow-active-shadow);
}
.timeline-heatmap-legend {
  color: var(--heatmap-legend-color);
  font-family: var(--heatmap-legend-font);
  font-size: var(--heatmap-legend-size);
  font-weight: 400;
  letter-spacing: var(--heatmap-legend-letter-spacing);
  text-transform: uppercase;
}
[data-theme='cyberpunk'] .timeline-heatmap-card::before {
  top: 0;
  left: 0;
  width: 30%;
  height: 0.125rem;
  background: var(--accent-primary);
  border: 0;
  box-shadow: var(--text-glow);
}
`
