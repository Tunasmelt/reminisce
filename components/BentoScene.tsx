'use client'

import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial, Sphere } from '@react-three/drei'
import * as THREE from 'three'

function Orb({ color }: { color: string }) {
  const ref = useRef<THREE.Mesh>(null)
  const c = new THREE.Color(color)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.position.y = Math.sin(clock.elapsedTime * 0.7) * 0.18
    ref.current.rotation.y = clock.elapsedTime * 0.4
  })
  return (
    <mesh ref={ref}>
      <Sphere args={[0.72, 32, 32]}>
        <MeshDistortMaterial
          color={c} distort={0.3} speed={1.8}
          roughness={0.05} metalness={0.92}
          emissive={c} emissiveIntensity={0.65}
        />
      </Sphere>
    </mesh>
  )
}

// Single exported canvas — render only ONE instance on the page.
// Large bento card uses this; medium card uses a CSS glow instead.
export default function BentoScene({ accent }: { accent: string }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 2.4], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.2} />
        <pointLight position={[3, 3, 3]} intensity={2} color={accent} />
        <pointLight position={[-3, -2, 2]} intensity={0.8} color="#3030cc" />
        <Orb color={accent} />
      </Suspense>
    </Canvas>
  )
}
