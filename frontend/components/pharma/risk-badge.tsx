"use client"

import { motion } from "framer-motion"
import { AlertTriangle, Thermometer, Clock, TrendingUp } from "lucide-react"

interface RiskBadgeProps {
  shipmentId?: string
  temp?: string
  trend?: string
  timeToSpoilage?: string
  level?: "CRITICAL_L1" | "WARNING_L2" | "NORMAL"
}

const levelConfig = {
  CRITICAL_L1: {
    bg: "rgba(255,68,68,0.15)",
    border: "rgba(255,68,68,0.4)",
    glow: "0 0 30px rgba(255,68,68,0.3)",
    color: "#FF4444",
    label: "CRITICAL L1",
  },
  WARNING_L2: {
    bg: "rgba(240,165,0,0.15)",
    border: "rgba(240,165,0,0.4)",
    glow: "0 0 30px rgba(240,165,0,0.3)",
    color: "#F0A500",
    label: "WARNING L2",
  },
  NORMAL: {
    bg: "rgba(30,204,139,0.15)",
    border: "rgba(30,204,139,0.4)",
    glow: "0 0 30px rgba(30,204,139,0.3)",
    color: "#1ECC8B",
    label: "NORMAL",
  },
}

export function RiskBadge({
  shipmentId = "SHP-2026-0441",
  temp = "7.4°C",
  trend = "+0.6°C/hr",
  timeToSpoilage = "9h 42m",
  level = "CRITICAL_L1",
}: RiskBadgeProps) {
  const config = levelConfig[level]

  return (
    <motion.div
      initial={{ y: 20, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.2, type: "spring", stiffness: 100 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
    >
      <div
        className="relative flex items-center gap-4 px-5 py-3 rounded-2xl"
        style={{
          background: "rgba(13,17,23,0.9)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          border: `1px solid ${config.border}`,
          boxShadow: `${config.glow}, 0 8px 32px rgba(0,0,0,0.6)`,
        }}
      >
        {/* Pulsing border effect for critical */}
        {level === "CRITICAL_L1" && (
          <motion.div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ border: `2px solid ${config.color}` }}
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <motion.div
            animate={level === "CRITICAL_L1" ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <AlertTriangle size={20} style={{ color: config.color }} />
          </motion.div>
          <div
            className="px-2 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold"
            style={{
              background: config.bg,
              border: `1px solid ${config.border}`,
              color: config.color,
              fontFamily: "JetBrains Mono, monospace",
              textShadow: `0 0 10px ${config.color}`,
            }}
          >
            {config.label}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.1)" }} />

        {/* Shipment ID */}
        <div>
          <span
            className="text-[10px] uppercase block"
            style={{ color: "#484F58", fontFamily: "JetBrains Mono, monospace" }}
          >
            SHIPMENT
          </span>
          <span
            className="text-[14px] font-mono"
            style={{ color: "#E6EDF3", fontFamily: "JetBrains Mono, monospace" }}
          >
            {shipmentId}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.1)" }} />

        {/* Temperature */}
        <div className="flex items-center gap-2">
          <Thermometer size={16} style={{ color: config.color }} />
          <div>
            <span
              className="text-[10px] uppercase block"
              style={{ color: "#484F58", fontFamily: "JetBrains Mono, monospace" }}
            >
              TEMP
            </span>
            <span
              className="text-[14px] font-bold"
              style={{
                color: config.color,
                fontFamily: "JetBrains Mono, monospace",
                textShadow: `0 0 8px ${config.color}`,
              }}
            >
              {temp}
            </span>
          </div>
        </div>

        {/* Trend */}
        <div className="flex items-center gap-2">
          <TrendingUp size={16} style={{ color: config.color }} />
          <div>
            <span
              className="text-[10px] uppercase block"
              style={{ color: "#484F58", fontFamily: "JetBrains Mono, monospace" }}
            >
              TREND
            </span>
            <span
              className="text-[14px]"
              style={{ color: config.color, fontFamily: "JetBrains Mono, monospace" }}
            >
              {trend}
            </span>
          </div>
        </div>

        {/* Time to spoilage */}
        <div className="flex items-center gap-2">
          <Clock size={16} style={{ color: "#F0A500" }} />
          <div>
            <span
              className="text-[10px] uppercase block"
              style={{ color: "#484F58", fontFamily: "JetBrains Mono, monospace" }}
            >
              SPOILAGE
            </span>
            <span
              className="text-[14px] font-bold"
              style={{
                color: "#F0A500",
                fontFamily: "JetBrains Mono, monospace",
                textShadow: "0 0 8px rgba(240,165,0,0.5)",
              }}
            >
              {timeToSpoilage}
            </span>
          </div>
        </div>

        {/* Action button */}
        <button
          className="ml-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all duration-200"
          style={{
            background: `linear-gradient(135deg, ${config.color}, ${config.color}dd)`,
            color: "#fff",
            fontFamily: "Inter, sans-serif",
            boxShadow: `0 0 20px ${config.color}80`,
          }}
        >
          View Crisis
        </button>
      </div>
    </motion.div>
  )
}
