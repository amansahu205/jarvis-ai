"use client"

import { useRef, useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Ship,
  Plane,
  Shield,
} from "lucide-react"

interface RerouteOption {
  id: string
  title: string
  type: "maritime" | "air"
  duration: string
  cost: string
  complianceStatus: "PASS" | "CRISIS" | "WARNING"
  regulations: string[]
  regulationDetails?: { [key: string]: string }
  description: string
}

interface ComplianceSidebarProps {
  onOptionSelect?: (option: RerouteOption) => void
  onApprove?: (option: RerouteOption) => void
  selectedOptionId?: string
  userRole?: 'logistics_planner' | 'responsible_person'
}

const rerouteOptions: RerouteOption[] = [
  {
    id: "opt-1",
    title: "Port Said Emergency Diversion",
    type: "maritime",
    duration: "6h 30m",
    cost: "$12,400",
    complianceStatus: "PASS",
    regulations: ["EDA-442", "WHO-TRS-961", "GDP-EU"],
    regulationDetails: {
      "EDA-442": "EU Dangerous Goods Regulation - Port redirection permitted for pharmaceutical cargo in emergency. Clause 4.2.1 exempts emergency diversions from standard manifest requirements.",
      "WHO-TRS-961": "WHO Technical Report Series 961 - Good Distribution Practices for pharmaceutical products. Clause 3.5 requires cold-chain integrity maintenance. Port Said facility meets storage requirements.",
      "GDP-EU": "Good Distribution Practice Guidelines (EU) - Temperature monitoring mandatory (2-8°C). Port Said Maersk facility certified for emergency pharmaceutical storage per EU Directive 2001/83/EC.",
    },
    description: "Immediate canal exit via Port Said. Cold storage at Maersk facility.",
  },
  {
    id: "opt-2",
    title: "Air Relay via Cairo",
    type: "air",
    duration: "4h 15m",
    cost: "$48,200",
    complianceStatus: "PASS",
    regulations: ["IATA-PCT", "FAA-AC", "WHO-TRS-961"],
    regulationDetails: {
      "IATA-PCT": "IATA Pharmaceutical Container Tracking - Emergency air evacuation approved under IATA DG Code 5.A.4. Helicopter extraction permitted for time-critical pharma shipments.",
      "FAA-AC": "FAA Advisory Circular - Emergency pharmaceutical cargo on chartered aircraft. 747F freighter meets cold-chain equipment standards. Cairo-JFK routing pre-approved for pharmaceutical emergencies.",
      "WHO-TRS-961": "WHO Technical Report Series 961 - Air transport refrigeration mandatory. 747F equipped with -10°C cold room meets WHO standards for emergency pharmaceutical transport.",
    },
    description: "Helicopter extraction to CAI, chartered 747F to JFK.",
  },
  {
    id: "opt-3",
    title: "Continue Original Route",
    type: "maritime",
    duration: "18h",
    cost: "$0",
    complianceStatus: "CRISIS",
    regulations: ["BREACH: EDA-442", "BREACH: GDP-EU"],
    regulationDetails: {
      "BREACH: EDA-442": "Temperature excursion beyond 8°C triggers regulatory non-compliance. Continuing at current rate (+0.6°C/hr) will breach EDA-442 by hour 4. Regulatory penalties: €50,000-€200,000.",
      "BREACH: GDP-EU": "GDP-EU mandates redirection upon thermal failure. Continuing without intervention violates Directive 2001/83/EC Annex 15. Cargo will be non-compliant and unsaleable upon arrival.",
    },
    description: "Risk of total cargo loss. Regulatory violations guaranteed.",
  },
]

const statusConfig = {
  PASS: {
    bg: "rgba(30,204,139,0.08)",
    border: "rgba(30,204,139,0.3)",
    color: "#1ECC8B",
    glow: "0 0 12px rgba(30,204,139,0.2)",
    icon: CheckCircle2,
  },
  WARNING: {
    bg: "rgba(240,165,0,0.08)",
    border: "rgba(240,165,0,0.3)",
    color: "#F0A500",
    glow: "0 0 12px rgba(240,165,0,0.2)",
    icon: Clock,
  },
  CRISIS: {
    bg: "rgba(255,68,68,0.08)",
    border: "rgba(255,68,68,0.3)",
    color: "#FF4444",
    glow: "0 0 12px rgba(255,68,68,0.2)",
    icon: AlertCircle,
  },
}

export function ComplianceSidebar({
  onOptionSelect,
  onApprove,
  selectedOptionId,
  userRole = 'logistics_planner',
}: ComplianceSidebarProps) {
  const [visibleCards, setVisibleCards] = useState<Set<string>>(new Set())
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // IntersectionObserver for card-to-map sync
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute("data-option-id")
          if (!id) return

          setVisibleCards((prev) => {
            const next = new Set(prev)
            if (entry.isIntersecting) {
              next.add(id)
            } else {
              next.delete(id)
            }
            return next
          })
        })
      },
      { threshold: 0.5 }
    )

    cardRefs.current.forEach((el) => {
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="fixed right-6 top-20 bottom-6 z-40 w-[380px] flex flex-col"
    >
      {/* Main card */}
      <div
        className="flex-1 rounded-2xl overflow-hidden flex flex-col"
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
        <div className="p-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl"
              style={{ background: "rgba(88,166,255,0.1)", border: "1px solid rgba(88,166,255,0.25)" }}
            >
              <Shield size={20} color="#58A6FF" />
            </div>
            <div>
              <h2
                className="text-[15px] font-bold"
                style={{ color: "#E6EDF3", fontFamily: "Inter, sans-serif" }}
              >
                Compliance Strategist
              </h2>
              <p
                className="text-[11px]"
                style={{ color: "#8B949E", fontFamily: "JetBrains Mono, monospace" }}
              >
                3 reroute options generated
              </p>
            </div>
          </div>

          {/* Crisis context */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{
              background: "rgba(255,68,68,0.06)",
              border: "1px solid rgba(255,68,68,0.15)",
            }}
          >
            <AlertCircle size={14} color="#FF4444" />
            <span
              className="text-[11px]"
              style={{ color: "#FF4444", fontFamily: "Inter, sans-serif" }}
            >
              SHP-2026-0441 · Suez Canal · 9h 42m to spoilage
            </span>
          </div>
        </div>

        {/* Options list */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
          {rerouteOptions.map((option, index) => {
            const config = statusConfig[option.complianceStatus]
            const StatusIcon = config.icon
            const isSelected = selectedOptionId === option.id
            const TypeIcon = option.type === "air" ? Plane : Ship

            return (
              <motion.div
                key={option.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(option.id, el)
                }}
                data-option-id={option.id}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                onClick={() => onOptionSelect?.(option)}
                className="relative p-4 rounded-xl cursor-pointer transition-all duration-200 group"
                style={{
                  background: isSelected ? "rgba(88,166,255,0.08)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isSelected ? "rgba(88,166,255,0.4)" : config.border}`,
                  boxShadow: isSelected ? "0 0 20px rgba(88,166,255,0.15)" : "none",
                }}
              >
                {/* Option number */}
                <div
                  className="absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: "rgba(88,166,255,0.15)",
                    border: "1px solid rgba(88,166,255,0.4)",
                    color: "#58A6FF",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {index + 1}
                </div>

                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TypeIcon size={16} style={{ color: "#8B949E" }} />
                    <span
                      className="text-[13px] font-semibold"
                      style={{ color: "#E6EDF3", fontFamily: "Inter, sans-serif" }}
                    >
                      {option.title}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md"
                    style={{
                      background: config.bg,
                      border: `1px solid ${config.border}`,
                      boxShadow: config.glow,
                    }}
                  >
                    <StatusIcon size={12} style={{ color: config.color }} />
                    <span
                      className="text-[9px] uppercase font-bold"
                      style={{ color: config.color, fontFamily: "JetBrains Mono, monospace" }}
                    >
                      {option.complianceStatus}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p
                  className="text-[12px] mb-3"
                  style={{ color: "#8B949E", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}
                >
                  {option.description}
                </p>

                {/* Stats row */}
                <div className="flex items-center gap-4 mb-3">
                  <div>
                    <span
                      className="text-[9px] uppercase block"
                      style={{ color: "#484F58", fontFamily: "JetBrains Mono, monospace" }}
                    >
                      DURATION
                    </span>
                    <span
                      className="text-[13px]"
                      style={{ color: "#E6EDF3", fontFamily: "JetBrains Mono, monospace" }}
                    >
                      {option.duration}
                    </span>
                  </div>
                  <div>
                    <span
                      className="text-[9px] uppercase block"
                      style={{ color: "#484F58", fontFamily: "JetBrains Mono, monospace" }}
                    >
                      COST
                    </span>
                    <span
                      className="text-[13px]"
                      style={{ color: "#F0A500", fontFamily: "JetBrains Mono, monospace" }}
                    >
                      {option.cost}
                    </span>
                  </div>
                </div>

                {/* Regulations */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {option.regulations.map((reg) => {
                    const isBreach = reg.startsWith("BREACH:")
                    return (
                      <span
                        key={reg}
                        className="px-2 py-0.5 rounded text-[9px]"
                        style={{
                          background: isBreach ? "rgba(255,68,68,0.1)" : "rgba(88,166,255,0.1)",
                          border: `1px solid ${isBreach ? "rgba(255,68,68,0.3)" : "rgba(88,166,255,0.25)"}`,
                          color: isBreach ? "#FF4444" : "#58A6FF",
                          fontFamily: "JetBrains Mono, monospace",
                        }}
                      >
                        {reg}
                      </span>
                    )
                  })}
                </div>

                {/* Regulation details (expanded when selected) */}
                {isSelected && option.regulationDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mb-3 overflow-hidden"
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      border: "1px solid rgba(88,166,255,0.15)",
                      borderRadius: "8px",
                      padding: "12px",
                    }}
                  >
                    {Object.entries(option.regulationDetails).map(([reg, detail]) => (
                      <div key={reg} className="mb-2.5 last:mb-0">
                        <div
                          className="text-[10px] uppercase font-bold mb-1"
                          style={{
                            color: reg.startsWith("BREACH") ? "#FF4444" : "#58A6FF",
                            fontFamily: "JetBrains Mono, monospace",
                          }}
                        >
                          {reg}
                        </div>
                        <div
                          className="text-[11px] leading-relaxed"
                          style={{ color: "#8B949E", fontFamily: "Inter, sans-serif" }}
                        >
                          {detail}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* Approve button (shown only to Responsible Persons when selected and PASS) */}
                {isSelected && option.complianceStatus === "PASS" && userRole === 'responsible_person' && (
                  <motion.button
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onApprove?.(option)
                    }}
                    className="mt-4 w-full py-2.5 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-2 transition-all duration-200"
                    style={{
                      background: "linear-gradient(135deg, #1ECC8B, #1ECC8Bdd)",
                      color: "#fff",
                      fontFamily: "Inter, sans-serif",
                      boxShadow: "0 0 20px rgba(30,204,139,0.4)",
                    }}
                  >
                    <FileText size={14} />
                    Approve & Sign
                    <ChevronRight size={14} />
                  </motion.button>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Footer */}
        <div
          className="p-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[10px]"
              style={{ color: "#484F58", fontFamily: "JetBrains Mono, monospace" }}
            >
              AI-generated · Human approval required
            </span>
            <div className="flex items-center gap-1">
              <span className="status-dot" />
              <span
                className="text-[10px]"
                style={{ color: "#1ECC8B", fontFamily: "JetBrains Mono, monospace" }}
              >
                Strategist Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(88, 166, 255, 0.3);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(88, 166, 255, 0.5);
        }
      `}</style>
    </motion.div>
  )
}
