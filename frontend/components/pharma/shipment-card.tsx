"use client"

import { motion } from "framer-motion"
import { AlertTriangle, TrendingUp, WifiOff, Clock, ChevronRight } from "lucide-react"

type ShipmentStatus = "critical" | "warning" | "normal" | "feed-lost"

interface ShipmentCardProps {
  status: ShipmentStatus
  shipmentId: string
  route: string
  temp?: string
  trend?: string
  timeRemaining?: string
  riskPercent?: string
  countdownTime?: string
  crisisMessage?: string
  warningNote?: string
  lastReading?: string
  onReview?: () => void
}

const statusConfig = {
  critical: {
    borderColor: "#FF4444",
    bgColor: "rgba(10,5,5,0.8)",
    pillBg: "rgba(255,68,68,0.15)",
    pillBorder: "rgba(255,68,68,0.4)",
    pillText: "#FF4444",
    shadow: "0 0 0 1px rgba(255,68,68,0.2), 0 8px 32px rgba(0,0,0,0.7), 0 0 60px rgba(255,68,68,0.1)",
    shimmerColor: "rgba(255,68,68,0.5)",
    hasSpinner: true,
  },
  warning: {
    borderColor: "#F0A500",
    bgColor: "rgba(10,8,3,0.8)",
    pillBg: "rgba(240,165,0,0.15)",
    pillBorder: "rgba(240,165,0,0.4)",
    pillText: "#F0A500",
    shadow: "0 0 0 1px rgba(240,165,0,0.2), 0 8px 32px rgba(0,0,0,0.7), 0 0 60px rgba(240,165,0,0.1)",
    shimmerColor: "rgba(240,165,0,0.5)",
    hasSpinner: true,
  },
  normal: {
    borderColor: "#1ECC8B",
    bgColor: "rgba(8,11,15,0.8)",
    pillBg: "rgba(30,204,139,0.15)",
    pillBorder: "rgba(30,204,139,0.3)",
    pillText: "#1ECC8B",
    shadow: "0 0 0 1px rgba(30,204,139,0.15), 0 8px 32px rgba(0,0,0,0.6)",
    shimmerColor: "rgba(30,204,139,0.5)",
    hasSpinner: false,
  },
  "feed-lost": {
    borderColor: "#484F58",
    bgColor: "rgba(72,79,88,0.08)",
    pillBg: "rgba(72,79,88,0.15)",
    pillBorder: "rgba(72,79,88,0.3)",
    pillText: "#8B949E",
    shadow: "0 8px 32px rgba(0,0,0,0.4)",
    shimmerColor: "transparent",
    hasSpinner: false,
  },
}

export function ShipmentCard({
  status,
  shipmentId,
  route,
  temp,
  trend,
  timeRemaining,
  riskPercent,
  countdownTime,
  crisisMessage,
  warningNote,
  lastReading,
  onReview,
}: ShipmentCardProps) {
  const config = statusConfig[status]
  const isFeedLost = status === "feed-lost"

  return (
    <div className="relative" style={{ "--border-color": config.borderColor } as React.CSSProperties}>
      {/* Spinning border wrapper (only for critical/warning) */}
      {config.hasSpinner && (
        <div
          className="absolute inset-0 rounded-2xl spinning-border"
          style={{
            background: `conic-gradient(from var(--angle, 0deg), transparent 20%, ${config.borderColor} 40%, transparent 60%)`,
          }}
        />
      )}

      {/* Card content */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: config.bgColor,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: config.hasSpinner ? "none" : `1px solid ${config.borderColor}40`,
          boxShadow: config.shadow,
          margin: config.hasSpinner ? "1px" : 0,
          opacity: isFeedLost ? 0.6 : 1,
        }}
      >
        {/* Top shimmer */}
        {!isFeedLost && (
          <div
            className="absolute top-0 left-[10%] w-[80%] h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${config.shimmerColor}, transparent)`,
            }}
          />
        )}

        <div className="p-5">
          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            {/* Status pill */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md"
              style={{
                background: config.pillBg,
                border: `1px solid ${config.pillBorder}`,
                boxShadow: status === "critical" ? `0 0 12px ${config.borderColor}40` : "none",
              }}
            >
              <span
                className="text-[10px] uppercase font-bold tracking-wider"
                style={{ color: config.pillText, fontFamily: "JetBrains Mono, monospace" }}
              >
                {status === "critical" ? "CRITICAL L1" : status === "warning" ? "WARNING L2" : status === "feed-lost" ? "FEED LOST" : "NORMAL"}
              </span>
            </div>

            {/* Countdown (for critical/warning) */}
            {countdownTime && (
              <span
                className="text-[14px] font-mono"
                style={{
                  color: config.pillText,
                  fontFamily: "JetBrains Mono, monospace",
                  textShadow: `0 0 12px ${config.borderColor}60`,
                }}
              >
                {countdownTime}
              </span>
            )}
          </div>

          {/* Feed lost centered content */}
          {isFeedLost ? (
            <div className="flex flex-col items-center py-6">
              <WifiOff size={32} style={{ color: "#484F58" }} />
              <p
                className="text-[14px] mt-3"
                style={{ color: "#8B949E", fontFamily: "Inter, sans-serif" }}
              >
                Telemetry feed interrupted
              </p>
              <p
                className="text-[11px] mt-1"
                style={{ color: "#484F58", fontFamily: "JetBrains Mono, monospace" }}
              >
                Last reading: {lastReading}
              </p>
            </div>
          ) : (
            <>
              {/* Shipment info */}
              <div className="mb-4">
                <span
                  className="text-[22px] font-mono"
                  style={{ color: "#E6EDF3", fontFamily: "JetBrains Mono, monospace" }}
                >
                  {shipmentId}
                </span>
                <p
                  className="text-[13px] mt-1"
                  style={{ color: "#8B949E", fontFamily: "Inter, sans-serif" }}
                >
                  {route}
                </p>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {/* Temp */}
                <div
                  className="p-3 rounded-xl"
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <span
                    className="text-[9px] uppercase block"
                    style={{ color: "#484F58", fontFamily: "JetBrains Mono, monospace" }}
                  >
                    TEMP
                  </span>
                  <span
                    className="text-[18px] font-bold"
                    style={{
                      color: status === "critical" ? "#FF4444" : "#1ECC8B",
                      fontFamily: "JetBrains Mono, monospace",
                      textShadow: status === "critical" ? "0 0 16px rgba(255,68,68,0.2)" : "none",
                    }}
                  >
                    {temp}
                  </span>
                </div>

                {/* Trend or ETA */}
                <div
                  className="p-3 rounded-xl"
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <span
                    className="text-[9px] uppercase block"
                    style={{ color: "#484F58", fontFamily: "JetBrains Mono, monospace" }}
                  >
                    {trend ? "TREND" : "STATUS"}
                  </span>
                  <div className="flex items-center gap-1">
                    {trend && <TrendingUp size={12} style={{ color: config.pillText }} />}
                    <span
                      className="text-[14px]"
                      style={{
                        color: trend ? config.pillText : "#1ECC8B",
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    >
                      {trend || "On schedule"}
                    </span>
                  </div>
                </div>

                {/* Time/Risk */}
                <div
                  className="p-3 rounded-xl"
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <span
                    className="text-[9px] uppercase block"
                    style={{ color: "#484F58", fontFamily: "JetBrains Mono, monospace" }}
                  >
                    {timeRemaining ? "SPOILAGE" : "RISK"}
                  </span>
                  <span
                    className="text-[14px]"
                    style={{
                      color: timeRemaining ? "#F0A500" : "#1ECC8B",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {timeRemaining || riskPercent}
                  </span>
                </div>
              </div>

              {/* Crisis strip (for critical) */}
              {crisisMessage && (
                <div
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{
                    background: "rgba(255,68,68,0.08)",
                    border: "1px solid rgba(255,68,68,0.25)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} style={{ color: "#FF4444" }} />
                    <span
                      className="text-[12px] font-medium"
                      style={{ color: "#FF4444", fontFamily: "Inter, sans-serif" }}
                    >
                      {crisisMessage}
                    </span>
                  </div>
                  <button
                    onClick={onReview}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] transition-all duration-200"
                    style={{
                      background: "rgba(88,166,255,0.1)",
                      border: "1px solid rgba(88,166,255,0.3)",
                      color: "#58A6FF",
                      fontFamily: "Inter, sans-serif",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    Review
                    <ChevronRight size={12} />
                  </button>
                </div>
              )}

              {/* Warning note (for warning status) */}
              {warningNote && (
                <p
                  className="text-[11px] mt-3"
                  style={{ color: "#F0A500", fontFamily: "Inter, sans-serif" }}
                >
                  {warningNote}
                </p>
              )}

              {/* Normal status note */}
              {status === "normal" && (
                <p
                  className="text-[11px] italic"
                  style={{ color: "#484F58", fontFamily: "Inter, sans-serif" }}
                >
                  No alerts
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* CSS for spinning border animation is in globals.css */}
    </div>
  )
}
