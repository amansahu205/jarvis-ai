"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null)
  const opacityOffsets = useMemo(() => new Float32Array(3000).map(() => Math.random() * Math.PI * 2), [])

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(3000 * 3)
    const colors = new Float32Array(3000 * 3)
    const color = new THREE.Color("#58A6FF")
    for (let i = 0; i < 3000; i++) {
      const phi = Math.acos(2 * Math.random() - 1)
      const theta = Math.random() * Math.PI * 2
      const r = 8 * Math.cbrt(Math.random())
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    return { positions, colors }
  }, [])

  useFrame((state) => {
    if (!pointsRef.current) return
    pointsRef.current.rotation.y += 0.0003
    const mat = pointsRef.current.material as THREE.PointsMaterial
    mat.opacity = 0.5 + 0.1 * Math.sin(state.clock.elapsedTime + opacityOffsets[0])
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.025} vertexColors opacity={0.6} transparent sizeAttenuation />
    </points>
  )
}

function FloatingWireframe({ size, speedX, speedY, floatOffset }: { size: number; speedX: number; speedY: number; floatOffset: number }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!meshRef.current) return
    meshRef.current.rotation.x += speedX
    meshRef.current.rotation.y += speedY
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5 + floatOffset) * 0.4
  })

  return (
    <mesh ref={meshRef} position={[Math.sin(floatOffset) * 3, 0, Math.cos(floatOffset) * 2]}>
      <icosahedronGeometry args={[size, 1]} />
      <meshBasicMaterial wireframe color="#58A6FF" transparent opacity={0.08} />
    </mesh>
  )
}

function ConnectingLines() {
  const lines = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const points: THREE.Vector3[] = []
      for (let j = 0; j < 5; j++) {
        points.push(
          new THREE.Vector3(
            (Math.random() - 0.5) * 16,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 8
          )
        )
      }
      const curve = new THREE.CatmullRomCurve3(points)
      const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.005, 4, false)
      return { geo: tubeGeo, phaseOffset: i * 1.2 }
    })
  }, [])

  const refs = useRef<(THREE.Mesh | null)[]>([])

  useFrame((state) => {
    refs.current.forEach((mesh, i) => {
      if (!mesh) return
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.opacity = 0.05 + 0.1 * Math.abs(Math.sin(state.clock.elapsedTime * 0.7 + lines[i].phaseOffset))
    })
  })

  return (
    <>
      {lines.map((line, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el }}>
          <primitive object={line.geo} attach="geometry" />
          <meshBasicMaterial color="#58A6FF" transparent opacity={0.15} />
        </mesh>
      ))}
    </>
  )
}

function GridPlane() {
  return (
    <gridHelper
      args={[40, 40, "#58A6FF", "#58A6FF"]}
      position={[0, -3.5, 0]}
      // @ts-ignore
      material-transparent
      // @ts-ignore
      material-opacity={0.04}
    />
  )
}

function Scene() {
  return (
    <>
      <fog attach="fog" args={["#020408", 5, 30]} />
      <ParticleField />
      <FloatingWireframe size={1.2} speedX={0.002} speedY={0.003} floatOffset={0} />
      <FloatingWireframe size={0.8} speedX={0.004} speedY={0.002} floatOffset={2.1} />
      <FloatingWireframe size={0.5} speedX={0.003} speedY={0.005} floatOffset={4.2} />
      <ConnectingLines />
      <GridPlane />
    </>
  )
}

export function ThreeBackground() {
  return (
    <div className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
      <Canvas
        camera={{ fov: 60, position: [0, 0, 5] }}
        style={{ background: "#020408" }}
        gl={{ antialias: true, alpha: false }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
