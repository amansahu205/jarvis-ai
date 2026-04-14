"use client"

import { useRef, useState, useEffect } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { motion } from "framer-motion"
import * as THREE from "three"
import { Monitor, X, Maximize2, Globe } from "lucide-react"

const MIN_WIDTH = 1200

// Particle field for background
function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null)

  const positions = new Float32Array(2000 * 3)
  for (let i = 0; i < 2000; i++) {
    const phi = Math.acos(2 * Math.random() - 1)
    const theta = Math.random() * Math.PI * 2
    const r = 6 * Math.cbrt(Math.random())
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi)
  }

  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.0001
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.02} color="#58A6FF" transparent opacity={0.2} sizeAttenuation />
    </points>
  )
}

function WireframeGlobe() {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.0008
      meshRef.current.rotation.x += 0.0002
    }
  })

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[2, 2]} />
      <meshBasicMaterial wireframe color="#58A6FF" transparent opacity={0.06} />
    </mesh>
  )
}

function BackgroundScene() {
  return (
    <>
      <ParticleField />
      <WireframeGlobe />
      <ambientLight intensity={0.3} />
    </>
  )
}

export function MobileBlocker() {
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    const checkWidth = () => {
      setIsMobile(window.innerWidth < MIN_WIDTH)
    }
    
    checkWidth()
    window.addEventListener('resize', checkWidth)
    return () => window.removeEventListener('resize', checkWidth)
  }, [])

  // Don't render anything until mounted (avoids hydration mismatch)
  if (!mounted) return null
  
  // Only show blocker on mobile/small screens
  if (!isMobile) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "#080B0F" }}>
      {/* Three.js background */}
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ fov: 60, position: [0, 0, 5] }}
          style={{ background: "transparent" }}
        >
          <BackgroundScene />
        </Canvas>
      </div>

      {/* Glass card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 80, delay: 0.3 }}
        className="relative z-10 p-9 text-center"
        style={{
          width: "min(340px, calc(100vw - 48px))",
          background: "rgba(8,11,15,0.8)",
          backdropFilter: "blur(32px) saturate(180%)",
          WebkitBackdropFilter: "blur(32px) saturate(180%)",
          border: "1px solid rgba(88,166,255,0.2)",
          borderRadius: "24px",
          boxShadow:
            "0 0 0 1px rgba(88,166,255,0.06), 0 20px 60px rgba(0,0,0,0.7), 0 0 100px rgba(88,166,255,0.07)",
        }}
      >
        {/* Top shimmer */}
        <div
          className="absolute top-0 left-[15%] w-[70%] h-px"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(88,166,255,0.7), transparent)",
          }}
        />

        {/* Icon cluster */}
        <div className="flex justify-center mb-0">
          <div
            className="relative flex items-center justify-center"
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "rgba(88,166,255,0.06)",
              border: "1px solid rgba(88,166,255,0.15)",
              boxShadow: "0 0 24px rgba(88,166,255,0.08)",
            }}
          >
            <Monitor size={32} style={{ color: "#58A6FF" }} />

            {/* X badge */}
            <div
              className="absolute -bottom-1 -right-1 flex items-center justify-center"
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: "rgba(255,68,68,0.15)",
                border: "1px solid rgba(255,68,68,0.4)",
                boxShadow: "0 0 8px rgba(255,68,68,0.2)",
              }}
            >
              <X size={12} style={{ color: "#FF4444" }} />
            </div>
          </div>
        </div>

        {/* Title */}
        <motion.h1
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-[22px] font-bold mt-5"
          style={{ color: "#E6EDF3", fontFamily: "Inter, sans-serif" }}
        >
          Desktop Required
        </motion.h1>

        {/* Body text */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-2.5"
        >
          <p
            className="text-[14px] leading-relaxed"
            style={{ color: "#8B949E", fontFamily: "Inter, sans-serif" }}
          >
            PharmaGuard AI requires a desktop or laptop.
          </p>
          <p
            className="text-[12px] mt-1.5"
            style={{ color: "#484F58", fontFamily: "Inter, sans-serif" }}
          >
            Geospatial compliance workflows require minimum 1200px.
          </p>
        </motion.div>

        {/* Divider */}
        <div
          className="my-5"
          style={{
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
          }}
        />

        {/* Requirements list */}
        <div>
          <span
            className="text-[9px] uppercase tracking-widest block mb-2.5"
            style={{ color: "#484F58", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.1em" }}
          >
            WHAT YOU NEED
          </span>
          <div className="flex flex-col gap-2 items-start mx-auto" style={{ width: "fit-content" }}>
            {[
              { icon: Monitor, label: "Desktop or laptop" },
              { icon: Maximize2, label: "1200px minimum width" },
              { icon: Globe, label: "Chrome, Firefox, or Safari" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2.5">
                <item.icon size={14} style={{ color: "#58A6FF" }} />
                <span
                  className="text-[12px]"
                  style={{ color: "#8B949E", fontFamily: "Inter, sans-serif" }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Team badge */}
        <div
          className="mt-6 inline-flex flex-col items-center px-4 py-2 rounded-full"
          style={{
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <span
            className="text-[10px] uppercase"
            style={{ color: "#484F58", fontFamily: "JetBrains Mono, monospace" }}
          >
            PHARMAGAURD AI
          </span>
          <span
            className="text-[10px] mt-0.5"
            style={{ color: "#484F58", fontFamily: "Inter, sans-serif" }}
          >
            by Jarvis AI · UMD Agentic AI Challenge 2026
          </span>
        </div>
      </motion.div>
    </div>
  )
}

export default MobileBlocker
