// Retro computer built as a layered Atropos scene from the
// frosted-ivory-lamplit-screen-baked variant. Atropos owns tilt/depth; the
// shell uses three layers and the keyboard two layers so pointer motion
// reveals thickness. The CRT screen is baked into the shell image.
// Ported from the variant's preview.html + manifest.json offsets.
import 'atropos/css'

import Atropos from 'atropos/react'

import computerShell from './assets/computer-shell.png'
import keyboard from './assets/keyboard.png'

export interface RetroComputerAtroposProps {
  /** Disable tilt interaction (reduced motion / calm intensity). */
  inactive?: boolean
  /** Atropos pointer-follow highlight (white radial). False for tight surfaces. */
  highlight?: boolean
  className?: string
}

export function RetroComputerAtropos({
  inactive = false,
  highlight = true,
  className,
}: RetroComputerAtroposProps) {
  return (
    <Atropos
      activeOffset={34}
      shadow={false}
      highlight={highlight}
      rotateXMax={10}
      rotateYMax={10}
      className={`${className ?? ''}${inactive ? ' retro-computer-atropos--inactive' : ''}`}
    >
      <div className="onboard-atropos-scene">
        {/* Letter glitch background — deep field (radial gradients) */}
        <div className="onboard-layer onboard-letter-bg" data-atropos-offset={-8} />

        {/* Ambient rim light spill */}
        <div className="onboard-layer onboard-rim" data-atropos-offset={-3} />

        {/* Shell depth back */}
        <div className="onboard-layer onboard-asset onboard-shell-back" data-atropos-offset={4}>
          <img src={computerShell} alt="" draggable={false} />
        </div>

        {/* Shell depth mid */}
        <div className="onboard-layer onboard-asset onboard-shell-mid" data-atropos-offset={7}>
          <img src={computerShell} alt="" draggable={false} />
        </div>

        {/* Shell main — CRT screen is baked into this image */}
        <div className="onboard-layer onboard-asset onboard-shell" data-atropos-offset={12}>
          <img src={computerShell} alt="" draggable={false} />
        </div>

        {/* Keyboard depth */}
        <div className="onboard-layer onboard-asset onboard-keyboard-back" data-atropos-offset={18}>
          <img src={keyboard} alt="" draggable={false} />
        </div>

        {/* Keyboard main */}
        <div className="onboard-layer onboard-asset onboard-keyboard" data-atropos-offset={26}>
          <img src={keyboard} alt="" draggable={false} />
        </div>

        {/* Foreground fragments */}
        <div className="onboard-layer onboard-frags" data-atropos-offset={34}>
          <span className="onboard-frag">#Z</span>
          <span className="onboard-frag">&lt;/&gt;</span>
          <span className="onboard-frag">0x</span>
        </div>
      </div>
    </Atropos>
  )
}
