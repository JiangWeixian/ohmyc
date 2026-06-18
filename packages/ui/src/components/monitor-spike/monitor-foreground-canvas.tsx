import { Text } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  Bloom,
  EffectComposer,
  ToneMapping,
} from '@react-three/postprocessing'
import {
  useEffect,
  useRef,
  useState,
} from 'react'
import * as THREE from 'three'

import interMedium from './Inter-Medium.woff'
import { LanyardScene } from './lanyard'

export interface MonitorCanvasStat {
  label: string
  value: number
  suffix: string
  precision?: number
}

interface MonitorForegroundCanvasProps {
  stats: MonitorCanvasStat[]
  reduceMotion: boolean
}

export function MonitorForegroundCanvas({ stats, reduceMotion }: MonitorForegroundCanvasProps) {
  const [isMobile, setIsMobile] = useState(() => globalThis.window !== undefined && window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 overflow-hidden max-md:hidden">
      <Canvas
        shadows
        dpr={[1, isMobile ? 1.25 : 1.5]}
        camera={{ position: [0, 0, 32], fov: 20, near: 1, far: 70 }}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color(0x00_00_00), 0)}
      >
        <ForegroundScene isMobile={isMobile} reduceMotion={reduceMotion} stats={stats} />
      </Canvas>
    </div>
  )
}

function ForegroundScene({
  isMobile,
  reduceMotion,
  stats,
}: {
  isMobile: boolean
  reduceMotion: boolean
  stats: MonitorCanvasStat[]
}) {
  return (
    <>
      <LanyardScene isMobile={isMobile} gravity={[0, -34, 0]} lanyardWidth={0.82} origin={[-3.7, -0.75, 0]} />

      <StatsTextGroup reduceMotion={reduceMotion} stats={stats} />

      <EffectComposer enableNormalPass={false}>
        <Bloom luminanceThreshold={0.22} mipmapBlur luminanceSmoothing={0.14} intensity={0.38} />
        <ToneMapping />
      </EffectComposer>
    </>
  )
}

function StatsTextGroup({
  reduceMotion,
  stats,
}: {
  reduceMotion: boolean
  stats: MonitorCanvasStat[]
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (reduceMotion || !groupRef.current) {
      return
    }

    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.65) * 0.035
    groupRef.current.rotation.y = -0.12 + Math.sin(state.clock.elapsedTime * 0.42) * 0.015
  })

  return (
    <group ref={groupRef} position={[2.48, 0, -0.3]} rotation={[0, -0.12, 0]}>
      {stats.map((stat, index) => (
        <StatTextLine key={stat.label} reduceMotion={reduceMotion} stat={stat} y={1.72 - index * 1.72} />
      ))}
    </group>
  )
}

function StatTextLine({
  reduceMotion,
  stat,
  y,
}: {
  reduceMotion: boolean
  stat: MonitorCanvasStat
  y: number
}) {
  const value = useAnimatedStat(stat, reduceMotion)
  const valueFontSize = value.length > 4 ? 0.86 : 1.05

  return (
    <group position={[0, y, 0]}>
      <mesh position={[1.75, 0.54, -0.012]} renderOrder={1}>
        <planeGeometry args={[3.5, 0.012]} />
        <meshBasicMaterial
          color="#f7f8f8"
          depthWrite={false}
          opacity={0.12}
          toneMapped={false}
          transparent
        />
      </mesh>

      <Text
        anchorX="left"
        anchorY="middle"
        font={interMedium}
        fontSize={0.14}
        letterSpacing={0.14}
        position={[0, 0.32, 0]}
        renderOrder={2}
      >
        {stat.label.toUpperCase()}
        <meshBasicMaterial
          color="#d0d6e0"
          depthWrite={false}
          opacity={0.62}
          toneMapped={false}
          transparent
        />
      </Text>

      <Text
        anchorX="left"
        anchorY="middle"
        font={interMedium}
        fontSize={valueFontSize}
        letterSpacing={-0.015}
        position={[0, -0.2, 0]}
        renderOrder={3}
      >
        {value}
        <meshBasicMaterial
          color="#f7f8f8"
          depthWrite={false}
          opacity={0.94}
          toneMapped={false}
          transparent
        />
      </Text>
    </group>
  )
}

function useAnimatedStat(stat: MonitorCanvasStat, reduceMotion: boolean) {
  const target = stat.value
  const precision = stat.precision ?? 0
  const suffix = stat.suffix
  const [displayValue, setDisplayValue] = useState(reduceMotion ? target : 0)

  useEffect(() => {
    if (reduceMotion) {
      return
    }

    let raf = 0
    const duration = 900
    const start = performance.now()
    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - progress) ** 3
      setDisplayValue(target * eased)
      if (progress < 1) {
        raf = requestAnimationFrame(animate)
      }
    }

    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [precision, reduceMotion, target])

  const renderedValue = reduceMotion ? target : displayValue

  return `${renderedValue.toFixed(precision)}${suffix}`
}
