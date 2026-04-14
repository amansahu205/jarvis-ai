"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import { MapContainer } from "./map-container"
import { RiskBadge } from "./risk-badge"
import { SignatureModal } from "./signature-modal"
import { CheckCircle, AlertCircle, Radio, Clock, DollarSign, Zap } from "lucide-react"

// Dynamically import map to avoid SSR issues
const MapContainerDynamic = dynamic(
  () => import("./map-container").then((mod) => ({ default: mod.MapContainer })),
  { ssr: false }
)

// Mock crisis data
const MOCK_CRISIS = {
  shipmentId: "SHP-2026-0441",
  location: "Suez Canal",
  lat: 30.5,
  lng: 32.35,
  level: "CRITICAL_L1" as const,
  currentTemp: "7.4°C",
  trend: "+0.6°C/hr",
  timeToSpoilage: "9h 42m",
  telemetryReadings: [
    { time: "09:38", temp: "6.2°C", humidity: "65%" },
    { time: "09:42", temp: "6.8°C", humidity: "67%" },
    { time: "09:44", temp: "7.1°C", humidity: "68%" },
    { time: "09:46", temp: "7.4°C", humidity: "70%" },
    { time: "09:48", temp: "7.8°C", humidity: "71%" },
  ],
  rerouteOptions: [
    {
      id: "option-1",
      title: "Port Said Emergency Diversion",
      duration: "14.5h",
      cost: "$24,000",
      status: "PASS" as const,
    },
    {
      id: "option-2",
      title: "Continue + Cold Pack",
      duration: "22.4h",
      cost: "$8,200",
      status: "FLAG" as const,
    },
  ],
  complianceCards: [
    {
      jurisdiction: "Egypt — Suez Canal Transit",
      regulation: "Egyptian Drug Authority Resolution 442",
      status: "FLAG" as const,
    },
    {
      jurisdiction: "International Waters",
      regulation: "IMO MARPOL Annex II",
      status: "PASS" as const,
    },
    {
      jurisdiction: "USA — Destination",
      regulation: "FDA 21 CFR Part 211",
      status: "PASS" as const,
    },
  ],
  diplomats: [
    {
      id: "diplomat-1",
      name: "Dr. Ahmed Hassan",
      title: "Egyptian Customs Authority",
      message: 'Requesting emergency staging at Port Said. EDA approval expected within 4 hours.',
    },
    {
      id: "diplomat-2",
      name: "James Mitchell",
      title: "US FDA Port Coordinator",
      message: 'Temperature excursion noted. Submitting Form 2877 for expedited review. Cold chain breach assessment: moderate risk.',
    },
    {
      id: "diplomat-3",
      name: "Dr. Priya Sharma",
      title: "WHO Supply Chain Manager",
      message: 'Evaluating reroute feasibility. Recommend immediate diversion to Port Said. Cold pack infrastructure available.',
    },
  ],
}

interface SelectedOption {
  title: string
  duration: string
  cost: string
  status: "PASS" | "FLAG"
}

interface DashboardProps {
  userRole?: 'logistics_planner' | 'responsible_person'
}

export function Dashboard({ userRole = 'logistics_planner' }: DashboardProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string>("option-1")
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false)
  const [selectedOption, setSelectedOption] = useState<SelectedOption>({
    title: "Port Said Emergency Diversion",
    duration: "14.5h",
    cost: "$24,000",
    status: "PASS",
  })
  const [expandedDiplomats, setExpandedDiplomats] = useState<Set<string>>(new Set())

  const handleOptionSelect = (optionId: string) => {
    setSelectedOptionId(optionId)
    const option = MOCK_CRISIS.rerouteOptions.find(o => o.id === optionId)
    if (option) {
      setSelectedOption({
        title: option.title,
        duration: option.duration,
        cost: option.cost,
        status: option.status,
      })
    }
  }

  const toggleDiplomatExpanded = (id: string) => {
    const newExpanded = new Set(expandedDiplomats)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedDiplomats(newExpanded)
  }

  const handleApprove = () => {
    if (userRole === 'responsible_person') {
      setIsSignatureModalOpen(true)
    }
  }

  const handleSignatureApprove = () => {
    setIsSignatureModalOpen(false)
    setSelectedOptionId("")
  }

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: "#080B0F" }}>
      {/* Map background */}
      <MapContainerDynamic focusCoords={{ lng: MOCK_CRISIS.lng, lat: MOCK_CRISIS.lat, zoom: 8 }} />

      {/* Left 60%: Map with Crisis Header and Telemetry */}
      <div className="absolute inset-0 w-3/5 flex flex-col">
        {/* Crisis Header Bar */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="m-4 p-4 rounded-2xl backdrop-blur-xl"
          style={{
            background: "rgba(255, 68, 68, 0.1)",
            border: "1px solid rgba(255, 68, 68, 0.3)",
            boxShadow: "0 0 30px rgba(255, 68, 68, 0.2)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-lg font-mono font-bold text-[#FF4444]">
                {MOCK_CRISIS.shipmentId}
              </div>
              <div className="text-xs font-mono text-[#FF4444]">·</div>
              <div className="text-lg font-mono font-bold text-[#FF4444]">
                CRITICAL L1
              </div>
              <div className="text-xs font-mono text-[#FF4444]">·</div>
              <div className="flex items-center gap-1 text-lg font-mono font-bold text-[#F0A500]">
                <Clock size={16} />
                <span>{MOCK_CRISIS.timeToSpoilage} countdown</span>
              </div>
            </div>
            <div className="text-xs font-mono text-[#8B949E]">
              {MOCK_CRISIS.location}
            </div>
          </div>
        </motion.div>

        {/* Telemetry Strip */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mx-4 p-3 rounded-xl flex gap-2 overflow-x-auto"
          style={{
            background: "rgba(8, 11, 15, 0.85)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(88, 166, 255, 0.15)",
          }}
        >
          {MOCK_CRISIS.telemetryReadings.map((reading, idx) => (
            <div
              key={idx}
              className="flex-shrink-0 p-2 rounded-lg"
              style={{
                background: idx === MOCK_CRISIS.telemetryReadings.length - 1 
                  ? "rgba(255, 68, 68, 0.15)" 
                  : "rgba(255, 255, 255, 0.03)",
                border: idx === MOCK_CRISIS.telemetryReadings.length - 1
                  ? "1px solid rgba(255, 68, 68, 0.3)"
                  : "1px solid rgba(255, 255, 255, 0.05)",
              }}
            >
              <div className="text-[10px] font-mono text-[#484F58]">{reading.time}</div>
              <div className="text-xs font-mono font-bold text-[#E6EDF3]">{reading.temp}</div>
              <div className="text-[10px] font-mono text-[#8B949E]">{reading.humidity}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Right 40%: Decision Panel */}
      <motion.div
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="absolute right-0 top-0 w-2/5 h-screen overflow-y-auto p-4 flex flex-col gap-4"
        style={{
          background: "rgba(8, 11, 15, 0.9)",
          backdropFilter: "blur(20px)",
          borderLeft: "1px solid rgba(88, 166, 255, 0.15)",
        }}
      >
        {/* Reroute Options */}
        <div>
          <div className="text-xs font-mono text-[#484F58] uppercase tracking-wider mb-2">
            Reroute Options
          </div>
          <div className="space-y-2">
            {MOCK_CRISIS.rerouteOptions.map((option) => (
              <motion.div
                key={option.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => handleOptionSelect(option.id)}
                className="p-3 rounded-lg cursor-pointer transition-all"
                style={{
                  background: selectedOptionId === option.id
                    ? "rgba(88, 166, 255, 0.15)"
                    : "rgba(255, 255, 255, 0.03)",
                  border: selectedOptionId === option.id
                    ? "1px solid rgba(88, 166, 255, 0.4)"
                    : "1px solid rgba(255, 255, 255, 0.05)",
                  boxShadow: selectedOptionId === option.id
                    ? "0 0 20px rgba(88, 166, 255, 0.1)"
                    : "none",
                }}
              >
                <div className="flex items-start gap-2 mb-2">
                  <div className="mt-0.5">
                    <Radio
                      size={16}
                      style={{
                        color: selectedOptionId === option.id ? "#58A6FF" : "#484F58",
                      }}
                      fill={selectedOptionId === option.id ? "#58A6FF" : "none"}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-[#E6EDF3]">{option.title}</div>
                    <div className="flex gap-3 mt-1 text-xs font-mono text-[#8B949E]">
                      <span>· {option.duration}</span>
                      <span>· {option.cost}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end">
                  <div
                    className="px-2 py-1 rounded text-[10px] font-mono font-bold"
                    style={{
                      background: option.status === "PASS"
                        ? "rgba(30, 204, 139, 0.15)"
                        : "rgba(240, 165, 0, 0.15)",
                      color: option.status === "PASS" ? "#1ECC8B" : "#F0A500",
                      border: option.status === "PASS"
                        ? "1px solid rgba(30, 204, 139, 0.3)"
                        : "1px solid rgba(240, 165, 0, 0.3)",
                    }}
                  >
                    {option.status}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Compliance Cards */}
        <div>
          <div className="text-xs font-mono text-[#484F58] uppercase tracking-wider mb-2">
            Compliance Status (Selected)
          </div>
          <div className="space-y-2">
            {MOCK_CRISIS.complianceCards.map((card, idx) => (
              <motion.div
                key={idx}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="p-3 rounded-lg"
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-[#E6EDF3] mb-1">
                      {card.jurisdiction}
                    </div>
                    <div className="text-[10px] font-mono text-[#8B949E]">
                      {card.regulation}
                    </div>
                  </div>
                  {card.status === "PASS" ? (
                    <CheckCircle size={16} style={{ color: "#1ECC8B", flexShrink: 0 }} />
                  ) : (
                    <AlertCircle size={16} style={{ color: "#F0A500", flexShrink: 0 }} />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Diplomat Drafts */}
        <div>
          <div className="text-xs font-mono text-[#484F58] uppercase tracking-wider mb-2">
            Diplomat Drafts
          </div>
          <div className="space-y-2">
            {MOCK_CRISIS.diplomats.map((diplomat) => (
              <motion.div
                key={diplomat.id}
                className="p-3 rounded-lg cursor-pointer transition-all"
                onClick={() => toggleDiplomatExpanded(diplomat.id)}
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-[#E6EDF3]">{diplomat.name}</div>
                    <div className="text-[10px] font-mono text-[#8B949E] mb-2">{diplomat.title}</div>
                    {expandedDiplomats.has(diplomat.id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="text-[11px] leading-relaxed text-[#E6EDF3] mt-2"
                      >
                        {diplomat.message}
                      </motion.div>
                    )}
                  </div>
                  <div className="text-xs text-[#58A6FF] flex-shrink-0">
                    {expandedDiplomats.has(diplomat.id) ? "−" : "+"}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ElevenLabs Call Record */}
        <div
          className="p-3 rounded-lg"
          style={{
            background: "rgba(88, 166, 255, 0.08)",
            border: "1px solid rgba(88, 166, 255, 0.2)",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} style={{ color: "#58A6FF" }} />
            <div className="text-xs font-semibold text-[#58A6FF]">ElevenLabs Call Record</div>
          </div>
          <div className="text-[10px] font-mono text-[#8B949E]">
            Call-ID: elab_2026_0441_092440
          </div>
          <div className="text-[10px] font-mono text-[#8B949E]">Duration: 14m 32s</div>
          <div className="text-[10px] font-mono text-[#8B949E]">Status: Completed</div>
        </div>

        {/* Action Bar */}
        {userRole === 'responsible_person' && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-auto pt-4 border-t space-y-2"
            style={{
              borderColor: "rgba(255, 255, 255, 0.05)",
            }}
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleApprove}
              className="w-full py-2.5 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all"
              style={{
                background: "linear-gradient(135deg, rgba(30, 204, 139, 0.85), rgba(20, 120, 75, 0.85))",
                border: "1px solid rgba(30, 204, 139, 0.5)",
                boxShadow: "0 0 20px rgba(30, 204, 139, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
              }}
            >
              <CheckCircle size={16} />
              <span className="text-sm font-mono">Approve Reroute</span>
            </motion.button>
            <button
              className="w-full py-2.5 rounded-lg font-semibold transition-all"
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#E6EDF3",
              }}
            >
              <span className="text-sm font-mono">Reject & Escalate</span>
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* Risk Badge */}
      <RiskBadge
        shipmentId={MOCK_CRISIS.shipmentId}
        temp={MOCK_CRISIS.currentTemp}
        trend={MOCK_CRISIS.trend}
        timeToSpoilage={MOCK_CRISIS.timeToSpoilage}
        level={MOCK_CRISIS.level}
      />

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        selectedOption={selectedOption}
        onApprove={handleSignatureApprove}
        onClose={() => setIsSignatureModalOpen(false)}
      />
    </div>
  )
}
