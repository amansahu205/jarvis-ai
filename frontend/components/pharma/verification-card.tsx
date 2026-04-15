"use client"

import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2, ArrowRight, RotateCcw } from "lucide-react"

interface VerificationCardProps {
  shipment: {
    shipment_code: string
    sensor_id: string
    medication_name: string
    lot_number: string
    temp_min_c: number
    temp_max_c: number
    humidity_min_pct: number
    humidity_max_pct: number
    origin_locode: string
    destination_locode: string
  }
  status: "verifying" | "active"
  onConfirm: () => void
  onReset: () => void
}

export function VerificationCard({ shipment, status, onConfirm, onReset }: VerificationCardProps) {
  const rows = [
    ["Shipment", shipment.shipment_code],
    ["Sensor", shipment.sensor_id],
    ["Medication", shipment.medication_name],
    ["Lot", shipment.lot_number],
    ["Temp Band", `${shipment.temp_min_c.toFixed(1)}°C - ${shipment.temp_max_c.toFixed(1)}°C`],
    ["Humidity Band", `${shipment.humidity_min_pct.toFixed(0)}% - ${shipment.humidity_max_pct.toFixed(0)}%`],
    ["Route", `${shipment.origin_locode} → ${shipment.destination_locode}`],
  ] as const

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.985 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl p-5"
        style={{
          background: "rgba(8,11,15,0.92)",
          border: "1px solid rgba(88,166,255,0.2)",
          boxShadow: "0 0 36px rgba(88,166,255,0.08)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs uppercase tracking-[0.28em]" style={{ color: "#58A6FF" }}>
              Verification
            </div>
            <h3 className="text-lg font-semibold mt-1" style={{ color: "#E6EDF3" }}>
              Review extracted shipment details
            </h3>
          </div>
          <span
            className="px-3 py-1 rounded-full text-xs font-mono"
            style={{
              background: status === "active" ? "rgba(30,204,139,0.15)" : "rgba(88,166,255,0.15)",
              color: status === "active" ? "#1ECC8B" : "#58A6FF",
            }}
          >
            {status === "active" ? "ACTIVE" : "VERIFYING"}
          </span>
        </div>

        <div className="grid gap-2">
          {rows.map(([label, value], index) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.04 }}
              className="flex items-center justify-between rounded-xl px-3 py-2"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <span className="text-xs uppercase tracking-wider" style={{ color: "#8B949E" }}>
                {label}
              </span>
              <span className="text-sm font-medium" style={{ color: "#E6EDF3" }}>
                {value}
              </span>
            </motion.div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={onReset}
            className="flex-1 rounded-xl px-4 py-3 text-sm font-medium"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#E6EDF3",
            }}
          >
            <span className="inline-flex items-center gap-2 justify-center">
              <RotateCcw size={14} />
              Reset
            </span>
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold"
            style={{
              background: "linear-gradient(135deg, #58A6FF, #3870C8)",
              color: "#fff",
              boxShadow: "0 0 24px rgba(88,166,255,0.22)",
            }}
          >
            <span className="inline-flex items-center gap-2 justify-center">
              {status === "active" ? <CheckCircle2 size={14} /> : <ArrowRight size={14} />}
              {status === "active" ? "Activated" : "Verify & Activate"}
            </span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
