"use client"

import { useEffect, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { motion } from "framer-motion"
import { getActiveShipments, type ActiveShipmentItem } from "@/lib/api"
import * as THREE from "three"
import { ShipmentCard } from "./shipment-card"

// Background accent panel
function BackgroundScene() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background: 'radial-gradient(circle at 20% 20%, rgba(88,166,255,0.08), transparent 32%), radial-gradient(circle at 80% 30%, rgba(30,204,139,0.06), transparent 28%), linear-gradient(180deg, rgba(8,11,15,0.95), rgba(8,11,15,0.75))',
      }}
    />
  )
}

interface ActiveShipmentsPageProps {
  initialShipments?: ActiveShipmentItem[]
}

function mapShipmentCards(rows: ActiveShipmentItem[]) {
  return rows.map((row) => ({
    status: row.status === "feed_lost" ? "feed-lost" : row.status,
    shipmentId: row.shipmentId,
    route: `${row.origin} → ${row.destination}`,
    temp: row.currentTemp,
    trend: row.trend ?? undefined,
    timeRemaining: row.eta,
    countdownTime: row.countdownTime ?? row.eta,
    crisisMessage: row.crisisMessage ?? undefined,
    warningNote: row.warningNote ?? undefined,
    lastReading: row.lastReading ?? undefined,
  }))
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

export function ActiveShipmentsPage({ initialShipments }: ActiveShipmentsPageProps) {
  const [shipments, setShipments] = useState<any[]>(() => (initialShipments ? mapShipmentCards(initialShipments) : []))

  useEffect(() => {
    if (initialShipments) {
      setShipments(mapShipmentCards(initialShipments))
      return
    }

    let cancelled = false
    getActiveShipments()
      .then((rows) => {
        if (cancelled) return
        setShipments(mapShipmentCards(rows))
      })
      .catch(() => setShipments([]))
    return () => {
      cancelled = true
    }
  }, [initialShipments])

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

