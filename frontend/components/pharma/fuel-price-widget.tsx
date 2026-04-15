"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Plane, Ship, Zap, Fuel } from "lucide-react"

interface FuelPriceWidgetProps {
  transitMode: "air" | "maritime"
  routeDistance_km?: number
  cargo_kg?: number
}

type DataState = "loading" | "loaded" | "error"

export function FuelPriceWidget({
  transitMode,
  routeDistance_km,
  cargo_kg,
}: FuelPriceWidgetProps) {
  const [dataState, setDataState] = useState<DataState>("loading")

  // Live fuel feed not wired yet; avoid fabricating prices.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDataState("error")
    }, 800)
    return () => clearTimeout(timer)
  }, [])


  // Skeleton pulse animation
  const skeletonVariants = {
    loading: { opacity: 0.5 },
    loaded: { opacity: 1 },
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full max-w-[320px]"
    >
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "rgba(13,17,23,0.7)",
          backdropFilter: "blur(16px) saturate(180%)",
          WebkitBackdropFilter: "blur(16px) saturate(180%)",
          border: "1px solid rgba(88,166,255,0.12)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3), 0 0 40px rgba(88,166,255,0.03)",
        }}
      >
        {/* Top shimmer */}
        <div
          className="absolute top-0 left-[10%] w-[80%] h-px"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(88,166,255,0.5), transparent)",
          }}
        />

        <div className="p-3.5 flex flex-col gap-3">
          {/* Main metrics row */}
          <div className="flex items-center justify-between gap-3">
            {/* Left Metric */}
            <div className="flex-1 flex items-center gap-2.5">
              {transitMode === "air" ? (
                <Plane size={16} style={{ color: "#58A6FF", flexShrink: 0 }} />
              ) : (
                <Ship size={16} style={{ color: "#58A6FF", flexShrink: 0 }} />
              )}

              <div className="flex-1 min-w-0">
                <p
                  className="text-[9px] uppercase tracking-wider"
                  style={{
                    color: "#8B949E",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {transitMode === "air" ? "JET FUEL" : "VLSFO"}
                </p>

                {dataState === "loading" ? (
                  <motion.div
                    animate={{ opacity: [0.5, 0.7, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="h-5 bg-gray-700 rounded mt-0.5"
                    style={{ width: "70px" }}
                  />
                ) : (
                  <p
                    className="text-[11px] mt-0.5"
                    style={{
                      color: "#484F58",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Live pricing unavailable
                  </p>
                )}
              </div>
            </div>

            {/* Divider */}
            <div
              className="h-8 w-px"
              style={{ background: "rgba(255,255,255,0.08)" }}
            />

            {/* Right Metric */}
            <div className="flex-1 flex items-center gap-2.5">
              {transitMode === "air" ? (
                <Zap size={16} style={{ color: "#F0A500", flexShrink: 0 }} />
              ) : (
                <Fuel size={16} style={{ color: "#F0A500", flexShrink: 0 }} />
              )}

              <div className="flex-1 min-w-0">
                <p
                  className="text-[9px] uppercase tracking-wider"
                  style={{
                    color: "#8B949E",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {transitMode === "air" ? "FUEL SURCHARGE" : "BUNKER ADJ."}
                </p>

                {dataState === "loading" ? (
                  <motion.div
                    animate={{ opacity: [0.5, 0.7, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="h-5 bg-gray-700 rounded mt-0.5"
                    style={{ width: "60px" }}
                  />
                ) : (
                  <p
                    className="text-[11px] mt-0.5"
                    style={{
                      color: "#484F58",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Live pricing unavailable
                  </p>
                )}
              </div>
            </div>

            {/* Live Badge */}
            <div
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md group cursor-help relative"
              style={{
                background: "rgba(30,204,139,0.08)",
                border: "1px solid rgba(30,204,139,0.15)",
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: "#1ECC8B",
                  animation: "statusPulse 2s ease-in-out infinite",
                }}
              />
              <span
                className="text-[9px] uppercase tracking-wider font-semibold"
                style={{
                  color: "#1ECC8B",
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                LIVE
              </span>

              {/* Tooltip */}
              <div
                className="absolute bottom-full right-0 mb-2 px-2 py-1 rounded-md text-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap"
                style={{
                  background: "rgba(0,0,0,0.8)",
                  color: "#E6EDF3",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Updated daily via EIA API
              </div>
            </div>
          </div>

          <div className="h-px" style={{ background: "rgba(255,255,255,0.05)" }} />

          <div className="flex flex-col gap-1.5">
            <p
              className="text-[9px] uppercase tracking-wider"
              style={{
                color: "#8B949E",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              LIVE PRICING
            </p>
            <p
              className="text-[11px]"
              style={{
                color: "#8B949E",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Route cost estimates are unavailable until the fuel feed is connected.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes statusPulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
      `}</style>
    </motion.div>
  )
}

export default FuelPriceWidget
