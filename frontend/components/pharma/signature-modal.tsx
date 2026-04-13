"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  Database,
  AlertCircle,
  Lock,
  Check,
  Ship,
  Plane,
} from "lucide-react"

type ModalState = "idle" | "verifying" | "writing" | "error" | "success"

interface SelectedOption {
  title: string
  type: "maritime" | "air"
  duration: string
  cost: string
  complianceStatus: "PASS" | "CRISIS" | "WARNING"
}

interface SignatureModalProps {
  isOpen: boolean
  selectedOption: SelectedOption
  onApprove: () => void
  onClose: () => void
  showAllStates?: boolean // Debug mode
}

export function SignatureModal({
  isOpen,
  selectedOption,
  onApprove,
  onClose,
  showAllStates = false,
}: SignatureModalProps) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [modalState, setModalState] = useState<ModalState>("idle")
  const [hasError, setHasError] = useState(false)

  const handleSign = async () => {
    if (!password) {
      setHasError(true)
      return
    }

    setHasError(false)
    setModalState("verifying")

    // Simulate verification
    await new Promise((r) => setTimeout(r, 1500))

    setModalState("writing")

    // Simulate audit ledger write
    await new Promise((r) => setTimeout(r, 1200))

    // Random success/failure for demo (90% success)
    if (Math.random() > 0.1) {
      setModalState("success")
      await new Promise((r) => setTimeout(r, 1000))
      onApprove()
      onClose()
      setModalState("idle")
      setPassword("")
    } else {
      setModalState("error")
    }
  }

  const TypeIcon = selectedOption.type === "air" ? Plane : Ship

  const renderButton = (state: ModalState) => {
    const baseStyle = {
      fontFamily: "Inter, sans-serif",
      transition: "all 0.2s",
    }

    switch (state) {
      case "idle":
        return (
          <motion.button
            key="idle"
            onClick={handleSign}
            whileHover={{ y: -2, boxShadow: "0 0 50px rgba(88,166,255,0.4)" }}
            className="w-full h-14 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2"
            style={{
              ...baseStyle,
              background: "linear-gradient(135deg, #58A6FF, #3870C8)",
              color: "#fff",
              border: "1px solid rgba(88,166,255,0.6)",
              boxShadow: "0 0 30px rgba(88,166,255,0.3), 0 4px 15px rgba(0,0,0,0.4)",
            }}
          >
            <ShieldCheck size={18} />
            Sign & Authorize
          </motion.button>
        )

      case "verifying":
        return (
          <div
            key="verifying"
            className="relative w-full h-14 rounded-xl text-[14px] font-medium flex items-center justify-center gap-2 overflow-hidden"
            style={{
              ...baseStyle,
              background: "linear-gradient(135deg, #58A6FF, #3870C8)",
              color: "#fff",
              opacity: 0.7,
              border: "1px solid rgba(88,166,255,0.6)",
            }}
          >
            {/* Shimmer */}
            <motion.div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
              }}
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <Loader2 size={18} />
            </motion.div>
            Verifying credentials...
          </div>
        )

      case "writing":
        return (
          <div
            key="writing"
            className="w-full h-14 rounded-xl text-[14px] font-medium flex items-center justify-center gap-2"
            style={{
              ...baseStyle,
              background: "linear-gradient(135deg, #58A6FF, #3870C8)",
              color: "#fff",
              opacity: 0.7,
              border: "1px solid rgba(88,166,255,0.6)",
            }}
          >
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <Database size={18} />
            </motion.div>
            Writing to audit ledger...
          </div>
        )

      case "error":
        return (
          <motion.button
            key="error"
            onClick={handleSign}
            whileHover={{ scale: 1.01 }}
            className="w-full h-14 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2"
            style={{
              ...baseStyle,
              background: "rgba(255,68,68,0.2)",
              color: "#FF4444",
              border: "1px solid rgba(255,68,68,0.5)",
              boxShadow: "0 0 20px rgba(255,68,68,0.2)",
            }}
          >
            <AlertCircle size={18} />
            Retry — Ledger write failed
          </motion.button>
        )

      case "success":
        return (
          <motion.div
            key="success"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="w-full h-14 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2"
            style={{
              ...baseStyle,
              background: "rgba(30,204,139,0.2)",
              color: "#1ECC8B",
              border: "1px solid rgba(30,204,139,0.5)",
              boxShadow: "0 0 20px rgba(30,204,139,0.2)",
            }}
          >
            <Check size={18} />
            Signature Recorded
          </motion.div>
        )
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100]"
            style={{
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          />

          {/* Modal */}
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[101] w-[540px]"
          >
            <div
              className="relative p-8 rounded-t-3xl"
              style={{
                background: "rgba(10,14,20,0.92)",
                backdropFilter: "blur(40px) saturate(200%)",
                WebkitBackdropFilter: "blur(40px) saturate(200%)",
                border: "1px solid rgba(88,166,255,0.2)",
                borderBottom: "none",
                boxShadow: "0 -8px 40px rgba(0,0,0,0.6), 0 0 80px rgba(88,166,255,0.08)",
              }}
            >
              {/* Drag handle */}
              <div
                className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.1)" }}
              />

              {/* Header */}
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-full"
                  style={{
                    background: "rgba(88,166,255,0.15)",
                    border: "1px solid rgba(88,166,255,0.4)",
                    boxShadow: "0 0 20px rgba(88,166,255,0.2)",
                  }}
                >
                  <ShieldCheck size={20} color="#58A6FF" />
                </div>
                <div>
                  <h2
                    className="text-[18px] font-bold"
                    style={{ color: "#E6EDF3", fontFamily: "Inter, sans-serif" }}
                  >
                    Authorize Reroute — Digital Signature
                  </h2>
                  <p
                    className="text-[12px] italic"
                    style={{ color: "#8B949E", fontFamily: "Inter, sans-serif" }}
                  >
                    21 CFR Part 11 compliant signature
                  </p>
                </div>
              </div>

              {/* Option recap card */}
              <div
                className="relative p-4 rounded-xl mb-6 overflow-hidden"
                style={{
                  background: "rgba(88,166,255,0.04)",
                  border: "1px solid rgba(88,166,255,0.15)",
                }}
              >
                {/* Shimmer top edge */}
                <div
                  className="absolute top-0 left-[10%] w-[80%] h-px"
                  style={{
                    background: "linear-gradient(90deg, transparent, rgba(88,166,255,0.5), transparent)",
                  }}
                />

                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className="text-[9px] uppercase tracking-wider"
                      style={{ color: "#484F58", fontFamily: "JetBrains Mono, monospace" }}
                    >
                      AUTHORIZING
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <TypeIcon size={16} style={{ color: "#8B949E" }} />
                      <span
                        className="text-[14px] font-semibold"
                        style={{ color: "#E6EDF3", fontFamily: "Inter, sans-serif" }}
                      >
                        {selectedOption.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span
                        className="text-[11px]"
                        style={{ color: "#8B949E", fontFamily: "JetBrains Mono, monospace" }}
                      >
                        {selectedOption.type === "air" ? "Air" : "Maritime"} · {selectedOption.duration} · {selectedOption.cost}
                      </span>
                    </div>
                  </div>
                  <div
                    className="px-3 py-1.5 rounded-lg"
                    style={{
                      background: "rgba(30,204,139,0.1)",
                      border: "1px solid rgba(30,204,139,0.3)",
                      boxShadow: "0 0 12px rgba(30,204,139,0.2)",
                    }}
                  >
                    <span
                      className="text-[10px] uppercase font-bold"
                      style={{ color: "#1ECC8B", fontFamily: "JetBrains Mono, monospace" }}
                    >
                      {selectedOption.complianceStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Password section */}
              <div className="mb-6">
                <label
                  className="block mb-2 text-[10px] uppercase tracking-wider"
                  style={{ color: "#8B949E", fontFamily: "JetBrains Mono, monospace" }}
                >
                  RE-ENTER CREDENTIALS TO SIGN
                </label>
                <div className="relative">
                  <motion.input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setHasError(false)
                    }}
                    animate={hasError ? { x: [-8, 8, -8, 8, 0] } : {}}
                    transition={{ duration: 0.4 }}
                    placeholder="••••••••••••"
                    className="w-full h-[52px] px-4 pr-12 rounded-xl text-[14px] outline-none transition-all duration-200"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      backdropFilter: "blur(8px)",
                      border: hasError ? "1px solid rgba(255,68,68,0.5)" : "1px solid rgba(255,255,255,0.08)",
                      color: "#E6EDF3",
                      fontFamily: "JetBrains Mono, monospace",
                      letterSpacing: "0.2em",
                      boxShadow: hasError ? "0 0 20px rgba(255,68,68,0.15)" : "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                    style={{ color: "#484F58" }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {hasError && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-1.5 mt-2"
                  >
                    <AlertCircle size={12} color="#FF4444" />
                    <span className="text-[11px]" style={{ color: "#FF4444", fontFamily: "Inter, sans-serif" }}>
                      Password required to authorize
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Sign button */}
              {showAllStates ? (
                <div className="flex flex-col gap-3">
                  {(["idle", "verifying", "writing", "error", "success"] as ModalState[]).map((state) => (
                    <div key={state}>{renderButton(state)}</div>
                  ))}
                </div>
              ) : (
                <AnimatePresence mode="wait">{renderButton(modalState)}</AnimatePresence>
              )}

              {/* Footer */}
              <div className="flex items-center justify-center gap-4 mt-6">
                <div className="flex items-center gap-1.5">
                  <Lock size={12} style={{ color: "#484F58" }} />
                  <span className="text-[10px]" style={{ color: "#484F58", fontFamily: "Inter, sans-serif" }}>
                    Secured with JWT
                  </span>
                </div>
                <span style={{ color: "#484F58" }}>·</span>
                <span className="text-[10px]" style={{ color: "#484F58", fontFamily: "Inter, sans-serif" }}>
                  Permanent audit trail
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
