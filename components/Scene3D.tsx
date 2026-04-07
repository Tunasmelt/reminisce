'use client'

import { useEffect, useRef, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float, MeshDistortMaterial, Sphere, Stars } from '@react-three/drei'
import * as THREE from 'three'

function hexToThree(hex: string): THREE.Color {
  if (!hex || hex.length < 7) return new THREE.Color(0.96, 0.62, 0.04)
  return new THREE.Color(
    parseInt(hex.slice(1,3),16)/255,
    parseInt(hex.slice(3,5),16)/255,
    parseInt(hex.slice(5,7),16)/255,
  )
}

function Node({ position, size, color, speed, distort, emissiveIntensity = 0.55 }: {
  position: [number,number,number]
  size: number; color: THREE.Color; speed: number
  distort: number; emissiveIntensity?: number
}) {
  return (
    <Float speed={speed} rotationIntensity={0.35} floatIntensity={0.75}>
      <mesh position={position}>
        <Sphere args={[size, 64, 64]}>
          <MeshDistortMaterial
            color={color} distort={distort} speed={1.6}
            roughness={0.04} metalness={0.95}
            emissive={color} emissiveIntensity={emissiveIntensity}
          />
        </Sphere>
      </mesh>
    </Float>
  )
}

function Edges({ positions, color }: {
  positions: [number,number,number][]
  color: THREE.Color
}) {
  const ref = useRef<THREE.LineSegments>(null)
  const geo = new THREE.BufferGeometry()
  const verts: number[] = []
  const CONNECT_DIST = 3.8
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dx = positions[i][0]-positions[j][0]
      const dy = positions[i][1]-positions[j][1]
      const dz = positions[i][2]-positions[j][2]
      if (Math.sqrt(dx*dx+dy*dy+dz*dz) < CONNECT_DIST)
        verts.push(...positions[i], ...positions[j])
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  useFrame(({ clock }) => {
    if (!ref.current) return
    const mat = ref.current.material as THREE.LineBasicMaterial
    mat.opacity = 0.1 + Math.sin(clock.elapsedTime * 0.55) * 0.07
  })
  return (
    <lineSegments ref={ref} geometry={geo}>
      <lineBasicMaterial color={color} transparent opacity={0.14} />
    </lineSegments>
  )
}

function Rig() {
  const { camera } = useThree()
  const mouse = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const h = (e: MouseEvent) => {
      mouse.current.x = (e.clientX/window.innerWidth - 0.5) * 2
      mouse.current.y = -(e.clientY/window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', h)
    return () => window.removeEventListener('mousemove', h)
  }, [])
  useFrame(() => {
    camera.position.x += (mouse.current.x * 1.5 - camera.position.x) * 0.025
    camera.position.y += (mouse.current.y * 1.0 - camera.position.y) * 0.025
    camera.lookAt(0, 0, 0)
  })
  return null
}

function SceneContents({ accent }: { accent: string }) {
  const ac   = hexToThree(accent)
  const dim  = new THREE.Color(0.14, 0.14, 0.25)
  const soft = new THREE.Color(0.82, 0.82, 0.98)

  const positions: [number,number,number][] = [
    [0, 0, 0],
    [2.2, 1.0, -0.7], [-2.2, 1.0, -0.7],
    [1.3, -1.7, 0.7], [-1.3, -1.7, 0.7],
    [0, 2.5, 0.3], [0, -2.5, 0.3],
    [3.2, -0.2, -0.3], [-3.2, -0.2, -0.3],
    [2.3, 0.4, 1.3], [-2.3, 0.4, 1.3],
    [1.1, 2.7, -0.5], [-1.1, 2.7, -0.5],
  ]

  const nodes = positions.map((pos, i) => ({
    pos,
    // Central hub is accent-coloured and significantly larger
    color:            i === 0 ? ac : i < 3 ? soft : dim,
    size:             i === 0 ? 0.52 : i < 3 ? 0.26 : i < 7 ? 0.15 : 0.10,
    speed:            0.38 + (i * 0.19) % 1.3,
    distort:          i === 0 ? 0.52 : 0.12 + (i * 0.045) % 0.28,
    emissiveIntensity:i === 0 ? 0.8  : i < 3 ? 0.5 : 0.3,
  }))

  return (
    <>
      <ambientLight intensity={0.18} />
      <pointLight position={[7, 7, 7]}   intensity={1.6} color={accent} />
      <pointLight position={[-6, -5, 5]} intensity={0.8} color="#2828cc" />
      <pointLight position={[0, 0, 6]}   intensity={0.25} color="#ffffff" />
      <Stars radius={120} depth={60} count={1800} factor={3.4} saturation={0.1} fade speed={0.3} />
      <Edges positions={positions} color={ac} />
      {nodes.map((n, i) => (
        <Node
          key={i}
          position={n.pos}
          size={n.size}
          color={n.color}
          speed={n.speed}
          distort={n.distort}
          emissiveIntensity={n.emissiveIntensity}
        />
      ))}
      <Rig />
    </>
  )
}

export default function Scene3D({ accent }: { accent: string }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 7.8], fov: 58 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <Suspense fallback={null}>
        <SceneContents accent={accent} />
      </Suspense>
    </Canvas>
  )
}
