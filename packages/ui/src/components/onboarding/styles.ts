/**
 * Onboarding setup gate styles — frosted-ivory-lamplit Atropos retro computer scene.
 * Layered construction: Atropos tilt reveals shell + keyboard thickness.
 *
 * Rendered by OnboardingGate via <style>. RetroComputerAtropos is a child
 * component that trusts the parent has loaded these styles.
 */
export const onboardingStyles = `
/* Ambient letter-glitch field sits at the bottom and never blocks the pointer. */
.onboarding-spike .onboard-letter-field {
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0.16;
  pointer-events: none;
}
/* Size the Atropos root directly (.atropos is display:block; its scale/rotate/
 * inner are 100% — without an explicit size the interactive surface collapses). */
.onboarding-spike .retro-computer-atropos {
  position: relative;
  z-index: 1;
  width: min(86vw, 760px);
  aspect-ratio: 1 / 1;
}
.onboarding-spike .retro-computer-atropos--inactive {
  pointer-events: none;
}
/* Scene wrapper fills the atropos-inner so absolute layers resolve against it. */
.onboarding-spike .onboard-atropos-scene {
  position: absolute;
  inset: 0;
}
.onboarding-spike .retro-computer-atropos .atropos-inner {
  overflow: visible;
  border-radius: 0;
  background: transparent;
}
.onboard-atropos-scene .onboard-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.onboard-letter-bg {
  z-index: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 42% 34%, rgba(255, 178, 86, 0.09), transparent 28%),
    radial-gradient(circle at 50% 48%, rgba(75, 255, 204, 0.07), transparent 34%);
}
.onboard-letter-bg pre {
  margin: -24px;
  white-space: pre-wrap;
  opacity: 0.68;
  text-shadow: 0 0 10px rgba(83, 247, 209, 0.2);
  transform: rotate(-1deg) scale(1.04);
}
.onboard-rim {
  z-index: 1;
  background:
    radial-gradient(circle at 37% 30%, rgba(255, 184, 96, 0.13), transparent 24%),
    radial-gradient(circle at 55% 49%, rgba(104, 255, 213, 0.14), transparent 22%);
  mix-blend-mode: screen;
}
.onboard-asset {
  display: grid;
  place-items: center;
}
.onboard-asset img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform-origin: center;
  display: block;
}
.onboard-shell-back {
  z-index: 2;
  opacity: 0.68;
}
.onboard-shell-back img {
  transform: translateY(-1%) scale(0.88) translate(18px, 14px);
  filter: brightness(0.34) saturate(0.72);
}
.onboard-shell-mid {
  z-index: 3;
  opacity: 0.5;
}
.onboard-shell-mid img {
  transform: translateY(-1%) scale(0.88) translate(9px, 7px);
  filter: brightness(0.56) saturate(0.82);
}
.onboard-shell {
  z-index: 5;
}
.onboard-shell img {
  transform: translateY(-1%) scale(0.88);
  filter: drop-shadow(0 30px 32px rgba(0, 0, 0, 0.5));
}
.onboard-keyboard-back {
  z-index: 6;
  opacity: 0.5;
}
.onboard-keyboard-back img {
  transform: translate(-6%, 36%) scale(0.7) translate(10px, 8px);
  filter: brightness(0.44) saturate(0.82);
}
.onboard-keyboard {
  z-index: 7;
}
.onboard-keyboard img {
  transform: translate(-6%, 36%) scale(0.7);
  filter: drop-shadow(0 20px 22px rgba(0, 0, 0, 0.42));
}
.onboard-frags {
  z-index: 8;
}
.onboard-frag {
  position: absolute;
  color: rgba(118, 255, 216, 0.58);
  font: 800 16px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  text-shadow: 0 0 12px rgba(118, 255, 216, 0.36);
}
.onboard-frag:nth-child(1) { left: 18%; top: 28%; }
.onboard-frag:nth-child(2) { right: 19%; top: 36%; }
.onboard-frag:nth-child(3) { left: 23%; bottom: 24%; }

/* Onboarding gate layout */
.onboarding-spike {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 4rem;
  min-height: 100dvh;
  padding: 3rem 1.5rem;
  background: var(--bg-marketing);
  color: var(--text-primary);
  font-family: var(--font-display);
}
.onboarding-spike .retro-computer-atropos {
  width: min(42vw, 380px);
}
.onboarding-spike .onboard-text {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.5rem;
  max-width: 26rem;
}
.onboarding-spike .onboard-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  text-align: left;
}
.onboarding-spike .onboard-title {
  font-size: clamp(1.5rem, 4vw, 2.25rem);
  font-weight: 700;
  letter-spacing: -0.02em;
}
.onboarding-spike .onboard-body {
  font-size: 0.95rem;
  line-height: 1.6;
  opacity: 0.72;
}
.onboarding-spike .onboard-status-line {
  font-size: 0.85rem;
  line-height: 1.5;
  opacity: 0.55;
  font-family: var(--font-mono, ui-monospace, monospace);
}
.onboarding-spike .onboard-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: flex-start;
}
@media (max-width: 860px) {
  .onboarding-spike {
    flex-direction: column;
    gap: 2.5rem;
  }
  .onboarding-spike .retro-computer-atropos {
    width: min(70vw, 420px);
  }
  .onboarding-spike .onboard-text {
    align-items: center;
  }
  .onboarding-spike .onboard-copy {
    align-items: center;
    text-align: center;
  }
  .onboarding-spike .onboard-actions {
    justify-content: center;
  }
}

/* Reduced motion: disable tilt, glitch, fragment motion; keep static scene. */
@media (prefers-reduced-motion: reduce) {
  .onboarding-spike .retro-computer-atropos .atropos-inner { pointer-events: none; }
}
`
