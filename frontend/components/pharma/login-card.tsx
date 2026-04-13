"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react"

const roles = ["Logistics Planner", "Responsible Person"]

interface LoginCardProps {
  onLogin?: (role: string) => void
}

export function LoginCard({ onLogin }: LoginCardProps) {
  const [selectedRole, setSelectedRole] = useState<string>("Logistics Planner")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((r) => setTimeout(r, 2000))
    setLoading(false)
    onLogin?.(selectedRole)
  }

  const fieldVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
  }

  return (
    <div
      className="relative w-[420px] rounded-[20px] p-10 select-none"
      style={{
        background: "rgba(13,17,23,0.65)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "1px solid rgba(88,166,255,0.2)",
        boxShadow:
          "0 0 0 1px rgba(88,166,255,0.1), 0 8px 32px rgba(0,0,0,0.6), 0 0 80px rgba(88,166,255,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      {/* Top shimmer */}
      <div
        className="absolute top-0 left-[20%] w-[60%] h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(88,166,255,0.8), transparent)",
        }}
      />

      {/* Logo area */}
      <div className="flex flex-col items-center gap-3">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.1, damping: 14 }}
          className="flex items-center justify-center w-12 h-12"
          style={{
            clipPath:
              "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
            background: "rgba(88,166,255,0.15)",
            border: "1px solid rgba(88,166,255,0.4)",
          }}
        >
          <ShieldCheck size={24} color="#58A6FF" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-[26px] font-bold text-center leading-tight"
          style={{ color: "#E6EDF3", fontFamily: "Inter, sans-serif" }}
        >
          PharmaGuard AI
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="text-[12px] text-center"
          style={{ color: "#8B949E", fontFamily: "Inter, sans-serif" }}
        >
          Cold-Chain Crisis Intelligence
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.1em]"
          style={{
            background: "rgba(88,166,255,0.08)",
            border: "1px solid rgba(88,166,255,0.25)",
            backdropFilter: "blur(8px)",
            color: "#58A6FF",
            fontFamily: "Inter, sans-serif",
          }}
        >
          JARVIS AI · UMD 2026
        </motion.div>
      </div>

      {/* Form */}
      <motion.form
        onSubmit={handleSignIn}
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.5 } } }}
        className="mt-7 flex flex-col gap-0"
      >
        {/* Role selector */}
        <motion.div variants={fieldVariants} transition={{ duration: 0.4 }}>
          <label
            className="block mb-2 text-[10px] uppercase tracking-[0.08em]"
            style={{ color: "#8B949E", fontFamily: "Inter, sans-serif" }}
          >
            SIGN IN AS
          </label>
          <div
            className="grid grid-cols-2 p-1 rounded-[12px]"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {roles.map((role) => {
              const active = selectedRole === role
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  className="relative px-4 py-[10px] rounded-[8px] text-[13px] font-medium transition-all duration-200"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    color: active ? "#58A6FF" : "#484F58",
                    background: active ? "rgba(88,166,255,0.2)" : "transparent",
                    border: active
                      ? "1px solid rgba(88,166,255,0.4)"
                      : "1px solid transparent",
                    boxShadow: active
                      ? "0 0 12px rgba(88,166,255,0.2), inset 0 1px 0 rgba(255,255,255,0.1)"
                      : "none",
                  }}
                >
                  {role}
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* Email */}
        <motion.div variants={fieldVariants} transition={{ duration: 0.4 }} className="mt-5">
          <label
            className="block mb-2 text-[10px] uppercase tracking-[0.08em]"
            style={{ color: "#8B949E", fontFamily: "Inter, sans-serif" }}
          >
            EMAIL ADDRESS
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@pharma.org"
            autoComplete="email"
            className="w-full h-12 px-4 rounded-[10px] text-[14px] outline-none transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#E6EDF3",
              fontFamily: "Inter, sans-serif",
              caretColor: "#58A6FF",
            }}
            onFocus={(e) => {
              e.target.style.border = "1px solid rgba(88,166,255,0.5)"
              e.target.style.boxShadow =
                "0 0 0 3px rgba(88,166,255,0.1), 0 0 20px rgba(88,166,255,0.08)"
              e.target.style.background = "rgba(88,166,255,0.05)"
            }}
            onBlur={(e) => {
              e.target.style.border = "1px solid rgba(255,255,255,0.08)"
              e.target.style.boxShadow = "none"
              e.target.style.background = "rgba(255,255,255,0.04)"
            }}
          />
        </motion.div>

        {/* Password */}
        <motion.div variants={fieldVariants} transition={{ duration: 0.4 }} className="mt-4">
          <label
            className="block mb-2 text-[10px] uppercase tracking-[0.08em]"
            style={{ color: "#8B949E", fontFamily: "Inter, sans-serif" }}
          >
            PASSWORD
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••���•"
              autoComplete="current-password"
              className="w-full h-12 px-4 pr-12 rounded-[10px] text-[14px] outline-none transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#E6EDF3",
                fontFamily: "Inter, sans-serif",
                caretColor: "#58A6FF",
              }}
              onFocus={(e) => {
                e.target.style.border = "1px solid rgba(88,166,255,0.5)"
                e.target.style.boxShadow =
                  "0 0 0 3px rgba(88,166,255,0.1), 0 0 20px rgba(88,166,255,0.08)"
                e.target.style.background = "rgba(88,166,255,0.05)"
              }}
              onBlur={(e) => {
                e.target.style.border = "1px solid rgba(255,255,255,0.08)"
                e.target.style.boxShadow = "none"
                e.target.style.background = "rgba(255,255,255,0.04)"
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors duration-150"
              style={{ color: "#484F58" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#58A6FF")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#484F58")}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </motion.div>

        {/* Sign In Button */}
        <motion.div variants={fieldVariants} transition={{ duration: 0.4 }} className="mt-6">
          <button
            type="submit"
            disabled={loading}
            className="relative w-full h-[52px] rounded-[12px] text-[15px] font-bold text-white flex items-center justify-center gap-2 transition-all duration-200"
            style={{
              fontFamily: "Inter, sans-serif",
              background:
                "linear-gradient(135deg, rgba(88,166,255,0.9), rgba(56,110,200,0.9))",
              border: "1px solid rgba(88,166,255,0.6)",
              boxShadow:
                "0 0 20px rgba(88,166,255,0.3), 0 4px 15px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (loading) return
              const el = e.currentTarget as HTMLButtonElement
              el.style.boxShadow =
                "0 0 35px rgba(88,166,255,0.5), 0 8px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)"
              el.style.transform = "translateY(-1px)"
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.boxShadow =
                "0 0 20px rgba(88,166,255,0.3), 0 4px 15px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)"
              el.style.transform = "translateY(0)"
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {loading ? (
                <motion.span
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 size={18} />
                  </motion.span>
                  Authenticating…
                </motion.span>
              ) : (
                <motion.span
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  Sign In
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </motion.div>

        {/* Footer */}
        <motion.div variants={fieldVariants} transition={{ duration: 0.4 }} className="mt-6">
          <div className="h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
          <div className="flex items-center justify-center gap-3 mt-4">
            {["System Active", "Compliance Online"].map((label) => (
              <div
                key={label}
                className="flex items-center gap-1.5 px-[14px] py-[6px] rounded-full text-[10px]"
                style={{
                  background: "rgba(30,204,139,0.08)",
                  border: "1px solid rgba(30,204,139,0.2)",
                  color: "#1ECC8B",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <span className="status-dot" />
                {label}
              </div>
            ))}
          </div>
          <p
            className="text-center mt-3 text-[10px]"
            style={{ color: "#484F58", fontFamily: "Inter, sans-serif" }}
          >
            All sessions recorded · 21 CFR Part 11
          </p>
        </motion.div>
      </motion.form>
    </div>
  )
}
