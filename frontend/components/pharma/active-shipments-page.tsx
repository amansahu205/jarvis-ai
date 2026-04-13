"use client"

import { useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { motion } from "framer-motion"
import * as THREE from "three"
import { ShipmentCard } from "./shipment-card"

// Background wireframe globe
function WireframeGlobe() {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001
      meshRef.current.rotation.x += 0.0003
    }
  })

  return (
    <mesh ref={meshRef} position={[3, 0, -2]}>
      <icosahedronGeometry args={[4, 2]} />
      <meshBasicMaterial wireframe color="#58A6FF" transparent opacity={0.04} />
    </mesh>
  )
}

function BackgroundScene() {
  return (
    <>
      <WireframeGlobe />
      <ambientLight intensity={0.5} />
    </>
  )
}

// System health pill component
function HealthPill({ name, status }: { name: string; status: "online" | "degraded" | "offline" }) {
  const config = {
    online: { bg: "rgba(30,204,139,0.06)", border: "rgba(30,204,139,0.15)", color: "#1ECC8B" },
    degraded: { bg: "rgba(240,165,0,0.06)", border: "rgba(240,165,0,0.15)", color: "#F0A500" },
    offline: { bg: "rgba(255,68,68,0.06)", border: "rgba(255,68,68,0.15)", color: "#FF4444" },
  }
  const cfg = config[status]

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <span className="status-dot" style={{ backgroundColor: cfg.color }} />
      <span
        className="text-[10px] uppercase"
        style={{ color: cfg.color, fontFamily: "JetBrains Mono, monospace" }}
      >
        {name}
      </span>
    </div>
  )
}

export function ActiveShipmentsPage() {
  const shipments = [
    {
      status: "critical" as const,
      shipmentId: "SHP-2026-0441",
      route: "Mumbai → New York",
      temp: "7.4°C",
      trend: "+0.6°C/hr",
      timeRemaining: "9h 42m",
      countdownTime: "09:42:17",
      crisisMessage: "Crisis Active — Pending RP Approval",
    },
    {
      status: "warning" as const,
      shipmentId: "SHP-2026-0438",
      route: "Frankfurt → Singapore",
      temp: "3.1°C",
      timeRemaining: "6h 14m",
      countdownTime: "06:14:00",
      warningNote: "Port dwell 6h 14m at FRA · Customs hold",
    },
    {
      status: "normal" as const,
      shipmentId: "SHP-2026-0435",
      route: "London → Johannesburg",
      temp: "4.8°C",
      riskPercent: "Risk 8%",
    },
    {
      status: "feed-lost" as const,
      shipmentId: "SHP-2026-0431",
      route: "Tokyo → Sydney",
      lastReading: "47m ago",
    },
  ]

  return (
    <div className="relative min-h-screen" style={{ background: "#080B0F" }}>
      {/* Three.js background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Canvas
          camera={{ fov: 60, position: [0, 0, 8] }}
          style={{ background: "transparent" }}
        >
          <BackgroundScene />
        </Canvas>
      </div>

      {/* Content */}
      <div className="relative z-10 pt-20 px-8 pb-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1
              className="text-[26px] font-extrabold"
              style={{ color: "#E6EDF3", fontFamily: "Inter, sans-serif" }}
            >
              ACTIVE SHIPMENTS
            </h1>
            <p
              className="text-[12px] mt-1"
              style={{ color: "#8B949E", fontFamily: "JetBrains Mono, monospace" }}
            >
              Sentinel monitoring · Last sync 3s ago
            </p>
          </div>

          {/* System health indicators */}
          <div className="flex items-center gap-3">
            <HealthPill name="Sentinel" status="online" />
            <HealthPill name="ReguMap" status="online" />
            <HealthPill name="LangGraph" status="online" />
          </div>
        </div>

        {/* Card grid */}
        <motion.div
          className="grid grid-cols-2 gap-5"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.1 } },
          }}
        >
          {shipments.map((shipment) => (
            <motion.div
              key={shipment.shipmentId}
              variants={{
                hidden: { y: 24, opacity: 0 },
                visible: { y: 0, opacity: 1 },
              }}
              transition={{ type: "spring", stiffness: 80 }}
            >
              <ShipmentCard {...shipment} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
