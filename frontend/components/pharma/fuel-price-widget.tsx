"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Plane, Ship, Zap, Fuel } from "lucide-react"

interface FuelPriceWidgetProps {
  transitMode: "air" | "maritime"
  routeDistance_km?: number
  cargo_kg?: number
}

// TODO: replace with GET /api/v1/fuel/prices endpoint
const MOCK_FUEL_DATA = {
  jet_fuel_per_gallon: 2.84,
  jet_fuel_change_pct: 0.3,
  fuel_surcharge_pct: 18.4,
  vlsfo_per_mt: 612,
  vlsfo_change_pct: -2.1,
  baf_per_teu: 340,
}

type DataState = "loading" | "loaded" | "error"

export function FuelPriceWidget({
  transitMode,
  routeDistance_km,
  cargo_kg,
}: FuelPriceWidgetProps) {
  const [dataState, setDataState] = useState<DataState>("loading")

  // Simulate data fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      setDataState("loaded")
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  // Calculate freight cost if both parameters are provided
  const calculateFreightCost = () => {
    if (!routeDistance_km || !cargo_kg) return null

    let estimate: number
    if (transitMode === "air") {
      estimate =
        (routeDistance_km / 1000) *
        cargo_kg *
        4.5 *
        (1 + MOCK_FUEL_DATA.fuel_surcharge_pct / 100)
    } else {
      estimate =
        (routeDistance_km / 1000) *
        cargo_kg *
        0.08 *
        (1 + MOCK_FUEL_DATA.baf_per_teu / 1000)
    }

    const min = Math.round(estimate * 0.85)
    const max = Math.round(estimate * 1.15)
    return { min, max }
  }

  const freightCost = calculateFreightCost()

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
                ) : dataState === "error" ? (
                  <p
                    className="text-[11px] mt-0.5"
                    style={{
                      color: "#484F58",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Unavailable
                  </p>
                ) : (
                  <>
                    <p
                      className="text-[13px] font-bold mt-0.5"
                      style={{
                        color: "#E6EDF3",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {transitMode === "air"
                        ? `$${MOCK_FUEL_DATA.jet_fuel_per_gallon}/gal`
                        : `$${MOCK_FUEL_DATA.vlsfo_per_mt}/MT`}
                    </p>

                    <p
                      className="text-[10px] mt-0.5"
                      style={{
                        color:
                          transitMode === "air"
                            ? MOCK_FUEL_DATA.jet_fuel_change_pct > 0
                              ? "#F0A500"
                              : "#1ECC8B"
                            : "#1ECC8B",
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    >
                      {transitMode === "air"
                        ? `${MOCK_FUEL_DATA.jet_fuel_change_pct > 0 ? "+" : ""}${MOCK_FUEL_DATA.jet_fuel_change_pct}% today`
                        : `-${Math.abs(MOCK_FUEL_DATA.vlsfo_change_pct)}% this week`}
                    </p>
                  </>
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
                ) : dataState === "error" ? (
                  <p
                    className="text-[11px] mt-0.5"
                    style={{
                      color: "#484F58",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Unavailable
                  </p>
                ) : (
                  <p
                    className="text-[13px] font-bold mt-0.5"
                    style={{
                      color: "#E6EDF3",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {transitMode === "air"
                      ? `${MOCK_FUEL_DATA.fuel_surcharge_pct}% of base`
                      : `$${MOCK_FUEL_DATA.baf_per_teu}/TEU`}
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

          {/* Estimated Freight Cost (optional) */}
          {freightCost && (
            <>
              <div
                className="h-px"
                style={{ background: "rgba(255,255,255,0.05)" }}
              />

              <div className="flex flex-col gap-1.5">
                <p
                  className="text-[9px] uppercase tracking-wider"
                  style={{
                    color: "#8B949E",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  EST. FREIGHT COST
                </p>

                {dataState === "loading" ? (
                  <motion.div
                    animate={{ opacity: [0.5, 0.7, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="h-6 bg-gray-700 rounded"
                    style={{ width: "120px" }}
                  />
                ) : dataState === "error" ? (
                  <p
                    className="text-[11px]"
                    style={{
                      color: "#484F58",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Unavailable
                  </p>
                ) : (
                  <>
                    <p
                      className="text-[14px] font-bold"
                      style={{
                        color: "#58A6FF",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      ${freightCost.min.toLocaleString()} – $
                      {freightCost.max.toLocaleString()}
                    </p>
                    <p
                      className="text-[9px]"
                      style={{
                        color: "#8B949E",
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    >
                      Based on current fuel rates · ±15% market variance
                    </p>
                    <p
                      className="text-[8px]"
                      style={{
                        color: "#484F58",
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    >
                      Advisory only · Not a binding quote
                    </p>
                  </>
                )}
              </div>
            </>
          )}
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
