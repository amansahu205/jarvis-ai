"use client"

import { motion } from "framer-motion"
import { ShieldCheck, Map, FileText, Bell, Settings, User, Radar, AlertTriangle } from "lucide-react"

interface TopNavProps {
  activeView?: "audit" | "shipments" | "tracker" | "regumap" | "crisis" | "dashboard"
  onViewChange?: (view: "audit" | "shipments" | "tracker" | "regumap" | "crisis" | "dashboard") => void
  hasCrisis?: boolean
}

const navItems = [
  { id: "dashboard" as const, label: "Dashboard", icon: ShieldCheck, isCrisis: false },
  { id: "regumap" as const, label: "ReguMap", icon: Map, isCrisis: false },
  { id: "crisis" as const, label: "Crisis", icon: AlertTriangle, isCrisis: true },
  { id: "tracker" as const, label: "Live Tracker", icon: Radar, isCrisis: false },
  { id: "shipments" as const, label: "Shipments", icon: ShieldCheck, isCrisis: false },
  { id: "audit" as const, label: "Audit Log", icon: FileText, isCrisis: false },
]

export function TopNav({ activeView = "regumap", onViewChange, hasCrisis = true }: TopNavProps) {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3"
      style={{
        background: "rgba(8,11,15,0.7)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        borderBottom: "1px solid rgba(88,166,255,0.1)",
      }}
    >
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-9 h-9"
          style={{
            clipPath: "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
            background: "rgba(88,166,255,0.15)",
            border: "1px solid rgba(88,166,255,0.4)",
          }}
        >
          <ShieldCheck size={18} color="#58A6FF" />
        </div>
        <div>
          <h1
            className="text-[15px] font-bold leading-tight"
            style={{ color: "#E6EDF3", fontFamily: "Inter, sans-serif" }}
          >
            PharmaGuard AI
          </h1>
          <p
            className="text-[10px]"
            style={{ color: "#8B949E", fontFamily: "JetBrains Mono, monospace" }}
          >
            Cold-Chain Intelligence
          </p>
        </div>
      </div>

      {/* Center: Navigation */}
      <nav className="flex items-center gap-1">
        {navItems.map((item) => {
          const isActive = activeView === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onViewChange?.(item.id)}
              className="relative flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "13px",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "#58A6FF" : "#8B949E",
                background: isActive ? "rgba(88,166,255,0.1)" : "transparent",
                border: isActive ? "1px solid rgba(88,166,255,0.25)" : "1px solid transparent",
              }}
            >
              <Icon size={16} />
              {item.label}
              {item.isCrisis && hasCrisis && (
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#FF4444',
                    boxShadow: '0 0 6px rgba(255,68,68,0.7)',
                    animation: 'statusPulse 1.5s infinite',
                  }}
                />
              )}
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -bottom-px left-3 right-3 h-[2px]"
                  style={{ background: "#58A6FF", borderRadius: "2px" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          )
        })}
      </nav>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* System status */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{
            background: "rgba(30,204,139,0.08)",
            border: "1px solid rgba(30,204,139,0.2)",
          }}
        >
          <span className="status-dot" />
          <span
            className="text-[11px]"
            style={{ color: "#1ECC8B", fontFamily: "JetBrains Mono, monospace" }}
          >
            SENTINEL ACTIVE
          </span>
        </div>

        {/* Notifications */}
        <button
          className="relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors duration-150"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#8B949E",
          }}
        >
          <Bell size={18} />
          <span
            className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold"
            style={{
              background: "#FF4444",
              color: "#fff",
              boxShadow: "0 0 8px rgba(255,68,68,0.5)",
            }}
          >
            3
          </span>
        </button>

        {/* Settings */}
        <button
          className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors duration-150"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#8B949E",
          }}
        >
          <Settings size={18} />
        </button>

        {/* User */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-150"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: "rgba(88,166,255,0.2)", border: "1px solid rgba(88,166,255,0.4)" }}
          >
            <User size={14} color="#58A6FF" />
          </div>
          <div>
            <p className="text-[12px] font-medium" style={{ color: "#E6EDF3", fontFamily: "Inter, sans-serif" }}>
              Dr. Aris
            </p>
            <p className="text-[9px]" style={{ color: "#58A6FF", fontFamily: "JetBrains Mono, monospace" }}>
              RP
            </p>
          </div>
        </div>
      </div>
    </motion.header>
  )
}
