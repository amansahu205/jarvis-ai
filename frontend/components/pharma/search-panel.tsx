"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Filter, ChevronDown, MapPin, Package, AlertTriangle, X } from "lucide-react"
import { getLatestShipmentSummary } from "@/lib/api"

interface SearchPanelProps {
  onShipmentSelect?: (shipmentId: string) => void
}

const statusColors = {
  critical: { bg: "rgba(255,68,68,0.1)", border: "rgba(255,68,68,0.3)", text: "#FF4444" },
  warning: { bg: "rgba(240,165,0,0.1)", border: "rgba(240,165,0,0.3)", text: "#F0A500" },
  normal: { bg: "rgba(30,204,139,0.1)", border: "rgba(30,204,139,0.3)", text: "#1ECC8B" },
}

export function SearchPanel({ onShipmentSelect }: SearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isExpanded, setIsExpanded] = useState(true)
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null)
  const [shipments, setShipments] = useState<Array<{ id: string; route: string; status: "critical" | "warning" | "normal"; temp: string; eta: string }>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getLatestShipmentSummary()
      .then((rows) => {
        if (cancelled) return
        setShipments(
          rows.map((row) => ({
            id: row.shipment_id,
            route: row.route,
            status: row.status === "critical" || row.status === "warning" ? row.status : "normal",
            temp: row.temp,
            eta: row.eta,
          })),
        )
        setIsLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setShipments([])
          setIsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filteredShipments = shipments.filter((s) => {
    const matchesSearch =
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.route.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = !selectedFilter || s.status === selectedFilter
    return matchesSearch && matchesFilter
  })

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="fixed left-6 top-20 z-40 w-[320px]"
    >
      {/* Search Card */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(13,17,23,0.85)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          border: "1px solid rgba(88,166,255,0.15)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 60px rgba(88,166,255,0.05)",
        }}
      >
        {/* Top shimmer */}
        <div
          className="absolute top-0 left-[15%] w-[70%] h-px"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(88,166,255,0.6), transparent)",
          }}
        />

        {/* Header */}
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-[13px] font-semibold"
              style={{ color: "#E6EDF3", fontFamily: "Inter, sans-serif" }}
            >
              Active Shipments
            </h2>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center justify-center w-6 h-6 rounded transition-colors"
              style={{ background: "rgba(255,255,255,0.05)", color: "#8B949E" }}
            >
              <motion.div animate={{ rotate: isExpanded ? 0 : -90 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={14} />
              </motion.div>
            </button>
          </div>

          {/* Search input */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "#484F58" }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shipments..."
              className="w-full h-10 pl-10 pr-4 rounded-lg text-[13px] outline-none transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#E6EDF3",
                fontFamily: "Inter, sans-serif",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "#484F58" }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mt-3">
            <Filter size={12} style={{ color: "#484F58" }} />
            {["critical", "warning", "normal"].map((filter) => {
              const isActive = selectedFilter === filter
              const colors = statusColors[filter as keyof typeof statusColors]
              return (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(isActive ? null : filter)}
                  className="px-2 py-1 rounded-md text-[10px] uppercase tracking-wider transition-all duration-150"
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    background: isActive ? colors.bg : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isActive ? colors.border : "rgba(255,255,255,0.06)"}`,
                    color: isActive ? colors.text : "#8B949E",
                  }}
                >
                  {filter}
                </button>
              )
            })}
          </div>
        </div>

        {/* Shipment list */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div
                className="px-4 pb-4 flex flex-col gap-2"
                style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div className="pt-3" />
                {isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div
                      className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: "rgba(88,166,255,0.35)", borderTopColor: "transparent" }}
                    />
                  </div>
                ) : filteredShipments.length === 0 ? (
                  <div
                    className="rounded-xl px-4 py-6 text-center"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="text-sm font-medium" style={{ color: "#E6EDF3" }}>
                      No active shipments found. Upload a PO to begin.
                    </div>
                    <div className="mt-2 text-xs" style={{ color: "#8B949E" }}>
                      Search results will appear here once telemetry and shipment rows are hydrated.
                    </div>
                  </div>
                ) : (
                  filteredShipments.map((shipment, index) => {
                    const colors = statusColors[shipment.status as keyof typeof statusColors]
                    return (
                      <motion.button
                        key={shipment.id}
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        onClick={() => onShipmentSelect?.(shipment.id)}
                        className="w-full p-3 rounded-xl text-left transition-all duration-200 group"
                        style={{
                          background: "rgba(255,255,255,0.02)",
                          border: `1px solid ${colors.border}`,
                          borderLeft: `3px solid ${colors.text}`,
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span
                              className="text-[12px] font-mono"
                              style={{ color: "#E6EDF3", fontFamily: "JetBrains Mono, monospace" }}
                            >
                              {shipment.id}
                            </span>
                            <div className="flex items-center gap-1 mt-1">
                              <MapPin size={10} style={{ color: "#484F58" }} />
                              <span
                                className="text-[11px]"
                                style={{ color: "#8B949E", fontFamily: "Inter, sans-serif" }}
                              >
                                {shipment.route}
                              </span>
                            </div>
                          </div>
                          <span
                            className="px-2 py-0.5 rounded text-[9px] uppercase"
                            style={{
                              background: colors.bg,
                              color: colors.text,
                              fontFamily: "JetBrains Mono, monospace",
                            }}
                          >
                            {shipment.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <Package size={10} style={{ color: "#484F58" }} />
                            <span
                              className="text-[11px]"
                              style={{ color: colors.text, fontFamily: "JetBrains Mono, monospace" }}
                            >
                              {shipment.temp}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {shipment.status === "critical" && (
                              <AlertTriangle size={10} style={{ color: "#FF4444" }} />
                            )}
                            <span
                              className="text-[11px]"
                              style={{
                                color: shipment.status === "critical" ? "#FF4444" : "#8B949E",
                                fontFamily: "JetBrains Mono, monospace",
                              }}
                            >
                              {shipment.eta}
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    )
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
