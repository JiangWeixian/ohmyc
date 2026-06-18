import { BakeShadows, MeshReflectorMaterial } from '@react-three/drei'
import {
  Canvas,
  createPortal,
  useFrame,
  useThree,
} from '@react-three/fiber'
import {
  Bloom,
  DepthOfField,
  EffectComposer,
  ToneMapping,
} from '@react-three/postprocessing'
import { easing } from 'maath'
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import * as THREE from 'three'

import { Computers, Instances } from './computers-scene'
import { LanyardScene } from './lanyard'

interface MonitorFocus {
  id: string
  point: [number, number, number]
  normal: [number, number, number]
}

export function ComputerBackdrop() {
  const [focusedMonitor, setFocusedMonitor] = useState<MonitorFocus | null>(null)
  const [isMobile, setIsMobile] = useState(() => globalThis.window !== undefined && window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
        <ForegroundLayer>
          <SceneBackdropBlend />
          <LanyardScene
            ambientIntensity={0.4}
            cardEmissiveIntensity={0.18}
            environment={false}
            isMobile={isMobile}
            gravity={[0, -34, 0]}
            lanyardWidth={0.48}
            origin={[1.24, 0.4, 0.8]}
            renderOrder={20}
            unitScale={0.38}
          />
        </ForegroundLayer>
        <CameraRig focusedMonitor={focusedMonitor} />
        <BakeShadows />
      </Canvas>
    </div>
  )
}

function ForegroundLayer({ children }: { children: ReactNode }) {
  const { gl, camera } = useThree()
  const [scene] = useState(() => new THREE.Scene())

  useFrame(() => {
    const autoClear = gl.autoClear
    // Three foreground passes need to preserve the already-composited scene.
    // eslint-disable-next-line react-hooks/immutability
    gl.autoClear = false
    gl.clearDepth()
    gl.render(scene, camera)
    gl.autoClear = autoClear
  }, 2)

  return createPortal(children, scene, { events: { priority: 3 } })
}

function SceneBackdropBlend() {
  return (
    <mesh frustumCulled={false} renderOrder={10}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        transparent
        depthTest={false}
        depthWrite={false}
        vertexShader={`
          varying vec2 vUv;

          void main() {
            vUv = position.xy * 0.5 + 0.5;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;

          void main() {
            vec2 uv = vec2(vUv.x, 1.0 - vUv.y);

            float linearMask = 0.0;
            if (uv.x < 0.42) {
              linearMask = mix(0.08, 0.24, smoothstep(0.0, 0.42, uv.x));
            } else if (uv.x < 0.72) {
              linearMask = mix(0.24, 0.88, smoothstep(0.42, 0.72, uv.x));
            } else {
              linearMask = mix(0.88, 1.0, smoothstep(0.72, 1.0, uv.x));
            }

            float rightMask = smoothstep(0.6, 0.88, uv.x);
            float bottomMask = 1.0 - smoothstep(0.0, 0.34, uv.y);
            float blackAlpha = max(max(linearMask, rightMask), bottomMask);

            float radialDistance = distance(uv, vec2(0.34, 0.38));
            float whiteAlpha = (1.0 - smoothstep(0.0, 0.28, radialDistance)) * 0.08;
            float alpha = blackAlpha + whiteAlpha * (1.0 - blackAlpha);
            vec3 color = mix(vec3(0.0), vec3(1.0), whiteAlpha * (1.0 - blackAlpha) / max(alpha, 0.001));

            gl_FragColor = vec4(color, alpha);
          }
        `}
      />
    </mesh>
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
