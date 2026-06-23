import { Text } from '@react-three/drei'
import {
  Canvas,
  useFrame,
  useThree,
} from '@react-three/fiber'
import {
  useEffect,
  useRef,
  useState,
} from 'react'
import * as THREE from 'three'

import interMedium from './Inter-Medium.woff'
import { LanyardScene } from './lanyard'

interface SpikeStat {
  label: string
  value: number
  suffix: string
  precision?: number
}

const stats: SpikeStat[] = [
  { label: 'sessions', value: 842, suffix: '' },
  { label: 'tokens', value: 18.4, suffix: 'M', precision: 1 },
  { label: 'turns', value: 2300, suffix: '' },
]

export function LanyardStatsSpikeView() {
  return (
    <section className="relative h-dvh min-h-[720px] overflow-hidden bg-[var(--bg-marketing)] font-[var(--font-display)] text-[var(--text-primary)]">
      <Atmosphere />

      <main className="relative z-10 h-full">
        <Canvas
          camera={{ position: [0, 0, 24], fov: 20, near: 1, far: 70 }}
          dpr={[1, 1.6]}
          gl={{ alpha: true, antialias: true }}
          onCreated={({ gl }) => gl.setClearColor(new THREE.Color(0x00_00_00), 0)}
        >
          <LanyardStatsScene />
        </Canvas>
      </main>

      <AccessibleStats />
    </section>
  )
}

function LanyardStatsScene() {
  const { viewport } = useThree()
  const isNarrow = viewport.width < 7

  return (
    <>
      <LanyardScene
        ambientIntensity={Math.PI}
        cardEmissiveIntensity={0.08}
        environment
        gravity={[0, -38, 0]}
        lanyardWidth={isNarrow ? 0.82 : 0.92}
        origin={isNarrow ? [-1.2, 0.05, 0] : [-3.45, 0.25, 0]}
      />
      <StatsTextGroup isNarrow={isNarrow} />
    </>
  )
}

function StatsTextGroup({ isNarrow }: { isNarrow: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const x = isNarrow ? -1.42 : 1.72
  const y = isNarrow ? -2.4 : 2.22
  const scale = isNarrow ? 0.66 : 1

  useFrame((state) => {
    if (!groupRef.current) {
      return
    }

    groupRef.current.position.y = y + Math.sin(state.clock.elapsedTime * 0.52) * 0.025
  })

  return (
    <group ref={groupRef} position={[x, y, 0]} scale={scale}>
      <Text
        anchorX="left"
        anchorY="middle"
        font={interMedium}
        fontSize={0.18}
        letterSpacing={0.07}
        position={[0, 0.46, 0]}
      >
        PERSONAL CODING MONITOR
        <meshBasicMaterial color="#d0d6e0" depthWrite={false} opacity={0.62} toneMapped={false} transparent />
      </Text>

      {stats.map((stat, index) => (
        <CanvasStatLine key={stat.label} index={index} stat={stat} y={-0.58 - index * 1.88} />
      ))}
    </group>
  )
}

function CanvasStatLine({ stat, index, y }: { stat: SpikeStat; index: number; y: number }) {
  const value = useAnimatedStat(stat, index)
  const fontSize = stat.label.length > 7 ? 0.74 : 1

  return (
    <group position={[0, y, 0]}>
      <mesh position={[2.34, 0.72, -0.01]}>
        <planeGeometry args={[4.68, 0.012]} />
        <meshBasicMaterial color="#f7f8f8" depthWrite={false} opacity={0.1} toneMapped={false} transparent />
      </mesh>
      <Text
        anchorX="left"
        anchorY="middle"
        font={interMedium}
        fontSize={0.17}
        letterSpacing={0.05}
        position={[0, 0.32, 0]}
      >
        {stat.label.toUpperCase()}
        <meshBasicMaterial color="#d0d6e0" depthWrite={false} opacity={0.68} toneMapped={false} transparent />
      </Text>
      <Text
        anchorX="left"
        anchorY="middle"
        font={interMedium}
        fontSize={fontSize}
        letterSpacing={0}
        position={[0, -0.36, 0]}
      >
        {value}
        <meshBasicMaterial color="#f7f8f8" depthWrite={false} opacity={0.96} toneMapped={false} transparent />
      </Text>
    </group>
  )
}

function useAnimatedStat(stat: SpikeStat, index: number) {
  const precision = stat.precision ?? 0
  const [value, setValue] = useState(() => {
    const reduceMotion = globalThis.window?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false
    return reduceMotion ? stat.value : 0
  })

  useEffect(() => {
    const media = globalThis.window?.matchMedia('(prefers-reduced-motion: reduce)')
    if (media?.matches) {
      return
    }

    let frame = 0
    const duration = 820
    const delay = 120 + index * 80
    const start = performance.now() + delay

    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / duration))
      const eased = 1 - (1 - progress) ** 3
      setValue(stat.value * eased)
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [index, stat.value])

  return `${value.toFixed(precision)}${stat.suffix}`
}

function AccessibleStats() {
  return (
    <main className="sr-only">
      <h1>Personal Coding Monitor</h1>
      <dl>
        {stats.map(item => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>
              {item.value.toFixed(item.precision ?? 0)}
              {item.suffix}
            </dd>
          </div>
        ))}
      </dl>
    </main>
  )
}

function Atmosphere() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_44%,rgba(255,255,255,0.11),transparent_27%),linear-gradient(90deg,#08090a_0%,rgba(8,9,10,0.82)_44%,rgba(8,9,10,0.96)_68%,#08090a_100%)]" />
      <div className="absolute inset-0 opacity-[0.13] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="absolute left-[12%] top-[18%] h-px w-[62vw] rotate-[-11deg] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)]" />
      <div className="absolute inset-x-0 bottom-0 h-[32%] bg-[linear-gradient(0deg,#08090a,rgba(8,9,10,0))]" />
    </div>
  )
}
