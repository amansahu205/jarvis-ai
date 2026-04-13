"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  Loader2,
  ChevronDown,
} from "lucide-react"

// ============================================
// CallStatusCalling
// ============================================
export function CallStatusCalling() {
  return (
    <div
      className="relative w-full flex items-center gap-3 p-3.5 px-4 rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.02)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(88,166,255,0.25)",
        boxShadow: "0 0 16px rgba(88,166,255,0.08), 0 4px 12px rgba(0,0,0,0.4)",
      }}
    >
      {/* Top shimmer */}
      <div
        className="absolute top-0 left-[10%] w-[80%] h-px"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(88,166,255,0.6), transparent)",
        }}
      />

      {/* Pulsing phone icon */}
      <motion.div
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
      >
        <PhoneCall size={18} style={{ color: "#58A6FF" }} />
      </motion.div>

      {/* Content */}
      <div className="flex-1">
        <p
          className="text-[13px] font-medium"
          style={{ color: "#E6EDF3", fontFamily: "Inter, sans-serif" }}
        >
          Contacting Dr. Aris Papadopoulos...
        </p>
        <p
          className="text-[12px] mt-0.5"
          style={{ color: "#8B949E", fontFamily: "JetBrains Mono, monospace" }}
        >
          +1 (202) 555-0147
        </p>
      </div>

      {/* Spinner */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      >
        <Loader2 size={16} style={{ color: "#58A6FF" }} />
      </motion.div>
    </div>
  )
}

// ============================================
// CallStatusDelivered (with transcript toggle)
// ============================================
export function CallStatusDelivered() {
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false)

  return (
    <div className="w-full">
      <div
        className="flex items-center gap-3 p-3.5 px-4 rounded-xl"
        style={{
          background: "rgba(255,255,255,0.02)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(30,204,139,0.2)",
          borderLeft: "3px solid #1ECC8B",
          boxShadow: "0 0 16px rgba(30,204,139,0.08), 0 4px 12px rgba(0,0,0,0.4)",
        }}
      >
        <PhoneIncoming size={18} style={{ color: "#1ECC8B" }} />

        <div className="flex-1">
          <p
            className="text-[13px] font-medium"
            style={{ color: "#E6EDF3", fontFamily: "Inter, sans-serif" }}
          >
            Call delivered · Dr. Aris Papadopoulos
          </p>
          <p
            className="text-[12px] mt-0.5"
            style={{ color: "#8B949E", fontFamily: "JetBrains Mono, monospace" }}
          >
            02:14 AM · Duration: 1m 24s · Briefing complete
          </p>
        </div>

        <button
          onClick={() => setIsTranscriptOpen(!isTranscriptOpen)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] transition-all duration-150"
          style={{
            background: "rgba(88,166,255,0.08)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(88,166,255,0.2)",
            color: "#58A6FF",
            fontFamily: "Inter, sans-serif",
          }}
        >
          View Transcript
          <motion.div animate={{ rotate: isTranscriptOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={12} />
          </motion.div>
        </button>
      </div>

      {/* Transcript card */}
      <AnimatePresence>
        {isTranscriptOpen && (
          <TranscriptCard />
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================
// CallStatusUnanswered
// ============================================
export function CallStatusUnanswered() {
  return (
    <div
      className="w-full flex items-center gap-3 p-3.5 px-4 rounded-xl"
      style={{
        background: "rgba(255,255,255,0.02)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(240,165,0,0.2)",
        boxShadow: "0 0 16px rgba(240,165,0,0.06), 0 4px 12px rgba(0,0,0,0.4)",
      }}
    >
      <PhoneMissed size={18} style={{ color: "#F0A500" }} />

      <div className="flex-1">
        <p
          className="text-[13px] font-medium"
          style={{ color: "#E6EDF3", fontFamily: "Inter, sans-serif" }}
        >
          Call unanswered — fallback active
        </p>
        <p
          className="text-[12px] mt-0.5"
          style={{ color: "#8B949E", fontFamily: "JetBrains Mono, monospace" }}
        >
          Push + email delivered at 02:14 AM
        </p>
      </div>

      <span
        className="px-2.5 py-1 rounded-md text-[10px] uppercase"
        style={{
          background: "rgba(240,165,0,0.15)",
          border: "1px solid rgba(240,165,0,0.3)",
          color: "#F0A500",
          fontFamily: "JetBrains Mono, monospace",
        }}
      >
        FALLBACK
      </span>
    </div>
  )
}

// ============================================
// CallStatusFailed
// ============================================
export function CallStatusFailed() {
  return (
    <div
      className="w-full flex items-center gap-3 p-3.5 px-4 rounded-xl"
      style={{
        background: "rgba(255,255,255,0.02)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,68,68,0.2)",
        boxShadow: "0 0 16px rgba(255,68,68,0.06), 0 4px 12px rgba(0,0,0,0.4)",
      }}
    >
      <PhoneOff size={18} style={{ color: "#FF4444" }} />

      <div className="flex-1">
        <p
          className="text-[13px] font-medium"
          style={{ color: "#E6EDF3", fontFamily: "Inter, sans-serif" }}
        >
          ElevenLabs call failed
        </p>
        <p
          className="text-[12px] mt-0.5"
          style={{ color: "#FF4444", opacity: 0.7, fontFamily: "JetBrains Mono, monospace" }}
        >
          ERR-2026-0441-CALL · Logged to audit ledger
        </p>
      </div>

      <a
        href="#"
        className="text-[11px] transition-colors duration-150 hover:underline"
        style={{ color: "#58A6FF", fontFamily: "Inter, sans-serif" }}
      >
        View Log
      </a>
    </div>
  )
}

// ============================================
// TranscriptCard
// ============================================
export function TranscriptCard() {
  const messages = [
    {
      speaker: "SYSTEM",
      color: "#58A6FF",
      text: "Dr. Aris, this is PharmaGuard AI. Shipment SHP-2026-0441 in the Suez Canal has a critical refrigeration failure. Internal temperature is rising at 0.5°C per hour. Time to spoilage: approximately 9 hours. The Strategist has identified an emergency diversion to Port Said. Can you confirm you're available to review?",
    },
    {
      speaker: "DR. ARIS",
      color: "#1ECC8B",
      text: "Yes, opening the dashboard now.",
    },
    {
      speaker: "SYSTEM",
      color: "#58A6FF",
      text: "Thank you. Your approval dashboard is ready at pharmaguard.ai/crisis/TKT-2026-0441. Approval requires your digital signature — verbal confirmation is not sufficient.",
    },
    {
      speaker: "DR. ARIS",
      color: "#1ECC8B",
      text: "Understood.",
    },
  ]

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
    >
      <div
        className="mt-2 p-4 rounded-xl"
        style={{
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[9px] uppercase tracking-wider"
            style={{ color: "#484F58", fontFamily: "JetBrains Mono, monospace" }}
          >
            CALL TRANSCRIPT
          </span>
          <span
            className="text-[9px] uppercase"
            style={{ color: "#484F58", fontFamily: "JetBrains Mono, monospace" }}
          >
            02:14 AM · 1m 24s
          </span>
        </div>

        {/* Messages */}
        <motion.div
          className="max-h-40 overflow-y-auto custom-scrollbar flex flex-col gap-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.1 } },
          }}
        >
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              variants={{
                hidden: { x: -8, opacity: 0 },
                visible: { x: 0, opacity: 1 },
              }}
              transition={{ duration: 0.3 }}
            >
              <span
                className="text-[9px] uppercase block mb-1"
                style={{ color: msg.color, fontFamily: "JetBrains Mono, monospace" }}
              >
                {msg.speaker}
              </span>
              <p
                className="text-[12px] leading-relaxed"
                style={{
                  color: msg.speaker === "DR. ARIS" ? "#E6EDF3" : "#8B949E",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {msg.text}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Footer */}
        <p
          className="text-[10px] italic text-center mt-3"
          style={{ color: "#484F58", fontFamily: "Inter, sans-serif" }}
        >
          Stored in audit ledger · Immutable record
        </p>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(88, 166, 255, 0.3);
          border-radius: 1px;
        }
      `}</style>
    </motion.div>
  )
}

// ============================================
// Demo wrapper for all states
// ============================================
export function DemoCallCards() {
  return (
    <div className="flex flex-col gap-3 p-6 max-w-xl mx-auto">
      <CallStatusCalling />
      <CallStatusDelivered />
      <CallStatusUnanswered />
      <CallStatusFailed />
    </div>
  )
}

export default CallStatusDelivered
