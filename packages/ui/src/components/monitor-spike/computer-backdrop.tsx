import { BakeShadows, MeshReflectorMaterial } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  Bloom,
  DepthOfField,
  EffectComposer,
  ToneMapping,
} from '@react-three/postprocessing'
import { easing } from 'maath'
import { useRef, useState } from 'react'
import * as THREE from 'three'

import { Computers, Instances } from './computers-scene'

interface MonitorFocus {
  id: string
  point: [number, number, number]
  normal: [number, number, number]
}

export function ComputerBackdrop() {
  const [focusedMonitor, setFocusedMonitor] = useState<MonitorFocus | null>(null)

  return (
    <div className="absolute inset-0 overflow-hidden">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [-1.5, 1, 5.5], fov: 45, near: 1, far: 20 }}
        gl={{ alpha: true, antialias: false }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color(0x00_00_00), 0)}
        onPointerMissed={() => setFocusedMonitor(null)}
      >
        <color attach="background" args={['#000000']} />
        <hemisphereLight intensity={0.15} groundColor="black" />
        <spotLight
          decay={0}
          position={[10, 20, 10]}
          angle={0.12}
          penumbra={1}
          intensity={1}
          castShadow
          shadow-mapSize={1024}
        />
        <group position={[0, -1, 0]}>
          <Instances>
            <Computers
              focusedMonitorId={focusedMonitor?.id ?? null}
              onFocusMonitor={setFocusedMonitor}
              scale={0.5}
            />
          </Instances>
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[50, 50]} />
            <MeshReflectorMaterial
              blur={[300, 30]}
              resolution={1024}
              mixBlur={1}
              mixStrength={120}
              roughness={1}
              depthScale={1.2}
              minDepthThreshold={0.4}
              maxDepthThreshold={1.4}
              color="#202020"
              metalness={0.8}
            />
          </mesh>
          <pointLight distance={1.5} intensity={0.75} position={[-0.15, 0.7, 0]} color="#f7f8f8" />
        </group>
        <EffectComposer enableNormalPass={false}>
          <Bloom luminanceThreshold={0} mipmapBlur luminanceSmoothing={0} intensity={1.2} />
          <DepthOfField target={[0, 0, 13]} focalLength={0.12} bokehScale={0.65} height={700} />
          <ToneMapping />
        </EffectComposer>
        <CameraRig focusedMonitor={focusedMonitor} />
        <BakeShadows />
      </Canvas>
    </div>
  )
}

function CameraRig({ focusedMonitor }: { focusedMonitor: MonitorFocus | null }) {
  const lookAt = useRef(new THREE.Vector3(0, 0, 0))
  const desiredCamera = useRef(new THREE.Vector3(-1.5, 1, 5.5))
  const desiredLookAt = useRef(new THREE.Vector3(0, 0, 0))

  useFrame((state, delta) => {
    if (focusedMonitor) {
      const [x, y, z] = focusedMonitor.point
      const [nx, ny, nz] = focusedMonitor.normal
      desiredLookAt.current.set(x, y + 0.08, z)
      desiredCamera.current.set(x + nx * 2.35, y + ny * 2.35 + 0.45, z + nz * 2.35)
    } else {
      desiredLookAt.current.set(0, 0, 0)
      desiredCamera.current.set(-1 + (state.pointer.x * state.viewport.width) / 3, (1 + state.pointer.y) / 2, 5.5)
    }

    easing.damp3(state.camera.position, desiredCamera.current, focusedMonitor ? 0.32 : 0.5, delta)
    lookAt.current.lerp(desiredLookAt.current, 1 - Math.exp(-delta * (focusedMonitor ? 6 : 4)))
    state.camera.lookAt(lookAt.current)
  })

  return null
}
