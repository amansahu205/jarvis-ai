"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  FileUp,
  Package,
  Plane,
  Ship,
  Truck,
  Clock,
  MapPin,
  Thermometer,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Hexagon,
  RotateCcw,
  Plus,
  Search,
  Calendar,
  User,
  Building2,
  FileText,
  Scale,
  Snowflake,
  Route,
  CreditCard,
  ClipboardList,
  MessageSquare,
} from "lucide-react"
import { FuelPriceWidget } from "./fuel-price-widget"
import { VerificationCard } from "./verification-card"
import { createShipment, getActiveShipments, parsePurchaseOrder } from "@/lib/api"
import { LocationSearch } from "@/components/LocationSearch"

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedShipment {
  shipmentId: string
  origin: string
  destination: string
  cargoType: string
  medicationName: string
  quantity: number
  batchNumber: string
  lotNumber: string
  weight_kg: number
  tempMinC: number
  tempMaxC: number
  estimatedDeparture: string
  consignee: string
  notes: string
}

interface ActiveShipment {
  id: string
  shipmentId: string
  origin: string
  destination: string
  status: "CRITICAL" | "WARNING" | "NORMAL" | "DELIVERED"
  currentTemp: string
  eta: string
  transitMode: "air" | "maritime" | "ground" | "multimodal"
  cargo: string
}

interface DashboardProps {
  userRole?: "logistics_planner" | "responsible_person"
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_STATS = {
  activeShipments: 12,
  criticalAlerts: 2,
  pendingApprovals: 5,
  onTimeRate: 94.2,
  totalValue: 2840000,
}

const INITIAL_ACTIVE_SHIPMENTS: ActiveShipment[] = [
  {
    id: "1",
    shipmentId: "SHP-2026-0441",
    origin: "JFK",
    destination: "LHR",
    status: "CRITICAL",
    currentTemp: "7.4°C",
    eta: "9h 42m",
    transitMode: "air",
    cargo: "Moderna COVID-19 Vaccine",
  },
  {
    id: "2",
    shipmentId: "SHP-2026-0438",
    origin: "LAX",
    destination: "NRT",
    status: "WARNING",
    currentTemp: "5.1°C",
    eta: "14h 20m",
    transitMode: "air",
    cargo: "Pfizer mRNA Therapeutic",
  },
  {
    id: "3",
    shipmentId: "SHP-2026-0435",
    origin: "Rotterdam",
    destination: "Singapore",
    status: "NORMAL",
    currentTemp: "4.2°C",
    eta: "6d 12h",
    transitMode: "maritime",
    cargo: "Insulin Bulk Shipment",
  },
  {
    id: "4",
    shipmentId: "SHP-2026-0432",
    origin: "Frankfurt",
    destination: "Dubai",
    status: "NORMAL",
    currentTemp: "3.8°C",
    eta: "2d 4h",
    transitMode: "ground",
    cargo: "Biologics - Humira",
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function Dashboard({ userRole = "logistics_planner" }: DashboardProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [leftPanelTab, setLeftPanelTab] = useState<"import" | "manual">("import")
  const [dashboardState, setDashboardState] = useState<"idle" | "parsing" | "verifying" | "active">("idle")
  const [parsedShipment, setParsedShipment] = useState<any | null>(null)
  const [activeShipments, setActiveShipments] = useState<ActiveShipment[]>(INITIAL_ACTIVE_SHIPMENTS)
  const [routeAnalyzerData, setRouteAnalyzerData] = useState({
    origin: "",
    destination: "",
    transitMode: "air" as "air" | "maritime" | "ground",
    weight_kg: "",
  })

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "UTC",
    })
  }

  useEffect(() => {
    let cancelled = false
    getActiveShipments()
      .then((shipments) => {
        if (cancelled) return
        const mapped = shipments.map((shipment) => ({
          id: shipment.id,
          shipmentId: shipment.shipmentId,
          origin: shipment.origin,
          destination: shipment.destination,
          status: shipment.status.toUpperCase() as ActiveShipment["status"],
          currentTemp: shipment.currentTemp,
          eta: shipment.eta,
          transitMode: shipment.transitMode,
          cargo: shipment.cargo,
        }))
        setActiveShipments(mapped.length ? mapped : INITIAL_ACTIVE_SHIPMENTS)
      })
      .catch(() => setActiveShipments(INITIAL_ACTIVE_SHIPMENTS))
    return () => {
      cancelled = true
    }
  }, [])

  const handlePoParse = async (file: File) => {
    setDashboardState("parsing")
    const parsed = await parsePurchaseOrder(file)
    setParsedShipment(parsed)
    setDashboardState("verifying")
  }

  const handleShipmentConfirmed = async () => {
    if (!parsedShipment) return
    setDashboardState("active")
    const created = await createShipment(parsedShipment)
    setActiveShipments((current) => [
      {
        id: String(created.id),
        shipmentId: created.shipment_code,
        origin: created.origin_locode,
        destination: created.destination_locode,
        status: "NORMAL",
        currentTemp: `${created.temp_min_c.toFixed(1)}°C`,
        eta: `${Math.max(1, Math.round(created.estimated_hours))}h`,
        transitMode: created.transit_mode as ActiveShipment["transitMode"],
        cargo: created.medication_name,
      },
      ...current,
    ])
    setDashboardState("active")
  }

  const handleVerificationReset = () => {
    setParsedShipment(null)
    setDashboardState("idle")
  }

  const getStatusColor = (status: ActiveShipment["status"]) => {
    switch (status) {
      case "CRITICAL":
        return "#FF4444"
      case "WARNING":
        return "#F0A500"
      case "NORMAL":
        return "#1ECC8B"
      case "DELIVERED":
        return "#58A6FF"
      default:
        return "#8B949E"
    }
  }

  const getTransitIcon = (mode: ActiveShipment["transitMode"]) => {
    switch (mode) {
      case "air":
        return <Plane size={14} />
      case "maritime":
        return <Ship size={14} />
      case "ground":
        return <Truck size={14} />
    }
  }

  return (
    <div
      className="relative w-full h-screen overflow-hidden flex flex-col"
      style={{ background: "#080B0F" }}
    >
      {/* ═══════════════════════════════════════════════════════════════════════
          WELCOME BAR
      ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="flex-shrink-0 px-6 py-4 flex items-center justify-between"
        style={{
          background: "rgba(8,11,15,0.95)",
          borderBottom: "1px solid rgba(88,166,255,0.1)",
        }}
      >
        {/* Left: Greeting + Clock */}
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#E6EDF3" }}>
              Welcome back, Operator
            </h1>
            <p className="text-sm font-mono" style={{ color: "#8B949E" }}>
              {formatTime(currentTime)} UTC
            </p>
          </div>
        </div>

        {/* Right: Stat Chips */}
        <div className="flex items-center gap-3">
          <StatChip
            icon={<Package size={14} />}
            label="Active"
            value={MOCK_STATS.activeShipments.toString()}
            color="#58A6FF"
          />
          <StatChip
            icon={<AlertTriangle size={14} />}
            label="Critical"
            value={MOCK_STATS.criticalAlerts.toString()}
            color="#FF4444"
            pulse
          />
          <StatChip
            icon={<Clock size={14} />}
            label="Pending"
            value={MOCK_STATS.pendingApprovals.toString()}
            color="#F0A500"
          />
          <StatChip
            icon={<CheckCircle2 size={14} />}
            label="On-Time"
            value={`${MOCK_STATS.onTimeRate}%`}
            color="#1ECC8B"
          />
          <StatChip
            icon={<DollarSign size={14} />}
            label="In Transit"
            value={`$${(MOCK_STATS.totalValue / 1000000).toFixed(1)}M`}
            color="#58A6FF"
          />
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN CONTENT (Left 52% + Right 48%)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─────────────────────────────────────────────────────────────────────
            LEFT PANEL (52%) - PO Import / Manual Entry
        ───────────────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-[52%] h-full p-4 overflow-y-auto"
          style={{
            borderRight: "1px solid rgba(88,166,255,0.1)",
          }}
        >
          <div
            className="h-full rounded-2xl overflow-hidden"
            style={{
              background: "rgba(8,11,15,0.85)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(88,166,255,0.15)",
              boxShadow: "0 0 40px rgba(88,166,255,0.05)",
            }}
          >
            {/* Tab Headers */}
            <div
              className="flex border-b"
              style={{ borderColor: "rgba(88,166,255,0.1)" }}
            >
              <button
                onClick={() => setLeftPanelTab("import")}
                className="flex-1 px-6 py-4 flex items-center justify-center gap-2 transition-all"
                style={{
                  background:
                    leftPanelTab === "import"
                      ? "rgba(88,166,255,0.1)"
                      : "transparent",
                  borderBottom:
                    leftPanelTab === "import"
                      ? "2px solid #58A6FF"
                      : "2px solid transparent",
                  color: leftPanelTab === "import" ? "#E6EDF3" : "#8B949E",
                }}
              >
                <FileUp size={18} />
                <span className="font-semibold">Import PO</span>
              </button>
              <button
                onClick={() => setLeftPanelTab("manual")}
                className="flex-1 px-6 py-4 flex items-center justify-center gap-2 transition-all"
                style={{
                  background:
                    leftPanelTab === "manual"
                      ? "rgba(88,166,255,0.1)"
                      : "transparent",
                  borderBottom:
                    leftPanelTab === "manual"
                      ? "2px solid #58A6FF"
                      : "2px solid transparent",
                  color: leftPanelTab === "manual" ? "#E6EDF3" : "#8B949E",
                }}
              >
                <Plus size={18} />
                <span className="font-semibold">Manual Entry</span>
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              <AnimatePresence mode="wait">
                {leftPanelTab === "import" ? (
                  <motion.div
                    key="import"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ImportPOTab onParse={handlePoParse} phase={dashboardState} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="manual"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ManualEntryForm />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* ─────────────────────────────────────────────────────────────────────
            RIGHT PANEL (48%) - Active Shipments + Route Analyzer
        ───────────────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="w-[48%] h-full p-4 flex flex-col gap-4 overflow-hidden"
        >
          {/* Active Shipments (60% of right panel) */}
          <div
            className="flex-[6] rounded-2xl overflow-hidden flex flex-col"
            style={{
              background: "rgba(8,11,15,0.85)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(88,166,255,0.15)",
              boxShadow: "0 0 40px rgba(88,166,255,0.05)",
            }}
          >
            <div
              className="px-5 py-4 flex items-center justify-between border-b"
              style={{ borderColor: "rgba(88,166,255,0.1)" }}
            >
              <div className="flex items-center gap-2">
                <Package size={18} style={{ color: "#58A6FF" }} />
                <h2 className="text-base font-bold" style={{ color: "#E6EDF3" }}>
                  Active Shipments
                </h2>
                <span
                  className="ml-2 px-2 py-0.5 rounded-full text-xs font-mono"
                  style={{
                    background: "rgba(88,166,255,0.15)",
                    color: "#58A6FF",
                  }}
                >
                  {activeShipments.length}
                </span>
              </div>
              <button
                className="text-xs font-medium flex items-center gap-1 hover:opacity-80 transition-opacity"
                style={{ color: "#58A6FF" }}
              >
                View All <ChevronRight size={14} />
              </button>
            </div>

            <div
              className="flex-1 overflow-y-auto p-4 space-y-3"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(88,166,255,0.3) transparent",
              }}
            >
              {activeShipments.map((shipment, idx) => (
                <motion.div
                  key={shipment.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ scale: 1.01, x: 4 }}
                  className="p-4 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderLeft: `3px solid ${getStatusColor(shipment.status)}`,
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-mono font-bold"
                        style={{ color: "#E6EDF3" }}
                      >
                        {shipment.shipmentId}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase"
                        style={{
                          background: `${getStatusColor(shipment.status)}20`,
                          color: getStatusColor(shipment.status),
                          border: `1px solid ${getStatusColor(shipment.status)}40`,
                        }}
                      >
                        {shipment.status}
                      </span>
                    </div>
                    <div
                      className="flex items-center gap-1"
                      style={{ color: "#8B949E" }}
                    >
                      {getTransitIcon(shipment.transitMode)}
                    </div>
                  </div>

                  <p
                    className="text-xs mb-2 truncate"
                    style={{ color: "#8B949E" }}
                  >
                    {shipment.cargo}
                  </p>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-mono" style={{ color: "#E6EDF3" }}>
                        {shipment.origin} → {shipment.destination}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className="flex items-center gap-1"
                        style={{ color: getStatusColor(shipment.status) }}
                      >
                        <Thermometer size={12} />
                        {shipment.currentTemp}
                      </span>
                      <span
                        className="flex items-center gap-1 font-mono"
                        style={{ color: "#8B949E" }}
                      >
                        <Clock size={12} />
                        {shipment.eta}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Quick Route Analyzer (40% of right panel) */}
          <div
            className="flex-[4] rounded-2xl overflow-hidden flex flex-col"
            style={{
              background: "rgba(8,11,15,0.85)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(88,166,255,0.15)",
              boxShadow: "0 0 40px rgba(88,166,255,0.05)",
            }}
          >
            <div
              className="px-5 py-4 flex items-center gap-2 border-b"
              style={{ borderColor: "rgba(88,166,255,0.1)" }}
            >
              <Route size={18} style={{ color: "#58A6FF" }} />
              <h2 className="text-base font-bold" style={{ color: "#E6EDF3" }}>
                Quick Route Analyzer
              </h2>
            </div>

            <div className="flex-1 p-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label
                    className="block text-[10px] uppercase tracking-wider mb-1.5 font-mono"
                    style={{ color: "#8B949E" }}
                  >
                    Origin
                  </label>
                  <LocationSearch
                    mode={routeAnalyzerData.transitMode === "maritime" ? "maritime" : "air"}
                    onSelect={(loc) =>
                      setRouteAnalyzerData((prev) => ({ ...prev, origin: loc.code }))
                    }
                    inputStyle={{ padding: "8px 12px", fontSize: "13px", borderRadius: "8px" }}
                  />
                </div>
                <div>
                  <label
                    className="block text-[10px] uppercase tracking-wider mb-1.5 font-mono"
                    style={{ color: "#8B949E" }}
                  >
                    Destination
                  </label>
                  <LocationSearch
                    mode={routeAnalyzerData.transitMode === "maritime" ? "maritime" : "air"}
                    onSelect={(loc) =>
                      setRouteAnalyzerData((prev) => ({ ...prev, destination: loc.code }))
                    }
                    inputStyle={{ padding: "8px 12px", fontSize: "13px", borderRadius: "8px" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label
                    className="block text-[10px] uppercase tracking-wider mb-1.5 font-mono"
                    style={{ color: "#8B949E" }}
                  >
                    Transit Mode
                  </label>
                  <div className="flex gap-2">
                    {(["air", "maritime", "ground"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() =>
                          setRouteAnalyzerData((prev) => ({
                            ...prev,
                            transitMode: mode,
                          }))
                        }
                        className="flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all"
                        style={{
                          background:
                            routeAnalyzerData.transitMode === mode
                              ? "rgba(88,166,255,0.15)"
                              : "rgba(255,255,255,0.04)",
                          border:
                            routeAnalyzerData.transitMode === mode
                              ? "1px solid rgba(88,166,255,0.4)"
                              : "1px solid rgba(255,255,255,0.05)",
                          color:
                            routeAnalyzerData.transitMode === mode
                              ? "#58A6FF"
                              : "#8B949E",
                        }}
                      >
                        {mode === "air" && <Plane size={14} />}
                        {mode === "maritime" && <Ship size={14} />}
                        {mode === "ground" && <Truck size={14} />}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label
                    className="block text-[10px] uppercase tracking-wider mb-1.5 font-mono"
                    style={{ color: "#8B949E" }}
                  >
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    value={routeAnalyzerData.weight_kg}
                    onChange={(e) =>
                      setRouteAnalyzerData((prev) => ({
                        ...prev,
                        weight_kg: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(88,166,255,0.2)",
                      color: "#E6EDF3",
                    }}
                  />
                </div>
              </div>

              {/* Fuel Price Widget */}
              <FuelPriceWidget
                transitMode={
                  routeAnalyzerData.transitMode === "ground"
                    ? "air"
                    : routeAnalyzerData.transitMode
                }
                routeDistance_km={
                  routeAnalyzerData.origin && routeAnalyzerData.destination
                    ? 5500
                    : undefined
                }
                cargo_kg={
                  routeAnalyzerData.weight_kg
                    ? parseFloat(routeAnalyzerData.weight_kg)
                    : undefined
                }
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          BOTTOM STATUS BAR
      ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="flex-shrink-0 px-6 py-2 flex items-center justify-between"
        style={{
          background: "rgba(8,11,15,0.95)",
          borderTop: "1px solid rgba(88,166,255,0.1)",
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: "#1ECC8B",
                animation: "statusPulse 2s ease-in-out infinite",
              }}
            />
            <span className="text-xs font-mono" style={{ color: "#8B949E" }}>
              All systems operational
            </span>
          </div>
          <span className="text-xs font-mono" style={{ color: "#484F58" }}>
            |
          </span>
          <span className="text-xs font-mono" style={{ color: "#8B949E" }}>
            API Latency: 42ms
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono" style={{ color: "#484F58" }}>
            v2.4.1-beta
          </span>
          <span className="text-xs font-mono" style={{ color: "#484F58" }}>
            |
          </span>
          <span className="text-xs font-mono" style={{ color: "#8B949E" }}>
            Powered by JARVIS AI
          </span>
        </div>
      </motion.div>

      {parsedShipment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl">
            <VerificationCard
              shipment={parsedShipment}
              status={dashboardState === "active" ? "active" : "verifying"}
              onConfirm={handleShipmentConfirmed}
              onReset={handleVerificationReset}
            />
          </div>
        </div>
      ) : null}

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
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CHIP COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function StatChip({
  icon,
  label,
  value,
  color,
  pulse,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
  pulse?: boolean
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{
        background: `${color}10`,
        border: `1px solid ${color}30`,
      }}
    >
      <span style={{ color }}>{icon}</span>
      <div className="flex flex-col">
        <span
          className="text-[10px] uppercase tracking-wider font-mono"
          style={{ color: "#8B949E" }}
        >
          {label}
        </span>
        <span
          className="text-sm font-bold font-mono"
          style={{
            color,
            animation: pulse ? "statusPulse 2s ease-in-out infinite" : "none",
          }}
        >
          {value}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT PO TAB
// ─────────────────────────────────────────────────────────────────────────────

function ImportPOTab({ onParse, phase }: { onParse: (file: File) => Promise<void>; phase: "idle" | "parsing" | "verifying" | "active" }) {
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (dropZoneRef.current) {
      dropZoneRef.current.style.borderColor = "#58A6FF"
      dropZoneRef.current.style.background = "rgba(88,166,255,0.08)"
    }
  }

  const handleDragLeave = () => {
    if (dropZoneRef.current) {
      dropZoneRef.current.style.borderColor = "rgba(88,166,255,0.3)"
      dropZoneRef.current.style.background = "transparent"
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (dropZoneRef.current) {
      dropZoneRef.current.style.borderColor = "rgba(88,166,255,0.3)"
      dropZoneRef.current.style.background = "transparent"
    }
    if (e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold mb-2" style={{ color: "#E6EDF3" }}>
          Import Purchase Order
        </h3>
        <p className="text-sm" style={{ color: "#8B949E" }}>
          Upload a PO document and let JARVIS extract shipment details
        </p>
      </div>

      {/* Drop Zone */}
      <div
        ref={dropZoneRef}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative flex flex-col items-center justify-center p-12 rounded-xl cursor-pointer transition-all duration-200"
        style={{
          border: "2px dashed rgba(88,166,255,0.3)",
          background: file ? "rgba(30,204,139,0.05)" : "transparent",
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <FileUp size={48} style={{ color: "#58A6FF", marginBottom: "16px" }} />
        </motion.div>
        <p className="text-base font-semibold mb-1" style={{ color: "#E6EDF3" }}>
          {file ? file.name : "Drop PDF or click to upload"}
        </p>
        <p className="text-sm" style={{ color: "#8B949E" }}>
          Supports PDF, CSV, XLSX - Max 10MB
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.csv,.xlsx"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            setFile(e.target.files[0])
          }
        }}
        className="hidden"
      />

      {/* Parse Button */}
      <motion.button
        onClick={() => file && onParse(file)}
        disabled={!file}
        whileHover={{ boxShadow: file ? "0 0 30px rgba(88,166,255,0.4)" : "none" }}
        className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        style={{
          background: !file
            ? "rgba(88,166,255,0.2)"
            : "linear-gradient(135deg, #58A6FF, #3870C8)",
          color: "#fff",
          border: "1px solid rgba(88,166,255,0.5)",
        }}
      >
        <Hexagon size={18} />
        {phase === "parsing" ? "Parsing..." : "Parse with JARVIS"}
        <ArrowRight size={16} />
      </motion.button>

      {/* Recent Imports */}
      <div>
        <h4
          className="text-xs uppercase tracking-wider font-mono mb-3"
          style={{ color: "#8B949E" }}
        >
          Recent Imports
        </h4>
        <div className="space-y-2">
          {[
            { name: "PO-2026-0441.pdf", time: "2 hours ago", status: "success" },
            { name: "PO-2026-0438.csv", time: "Yesterday", status: "success" },
            { name: "PO-2026-0435.xlsx", time: "3 days ago", status: "warning" },
          ].map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-lg"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div className="flex items-center gap-2">
                <FileText size={14} style={{ color: "#58A6FF" }} />
                <span className="text-sm" style={{ color: "#E6EDF3" }}>
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: "#8B949E" }}>
                  {item.time}
                </span>
                {item.status === "success" ? (
                  <CheckCircle2 size={14} style={{ color: "#1ECC8B" }} />
                ) : (
                  <AlertTriangle size={14} style={{ color: "#F0A500" }} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL ENTRY FORM
// ─────────────────────────────────────────────────────────────────────────────

function ManualEntryForm() {
  const [formData, setFormData] = useState({
    shipmentId: "",
    shipperName: "",
    shipperContact: "",
    consigneeName: "",
    consigneeContact: "",
    cargoType: "vaccine",
    medicationName: "",
    batchNumber: "",
    lotNumber: "",
    quantity: "",
    weight_kg: "",
    tempMinC: "",
    tempMaxC: "",
    origin: "",
    destination: "",
    transitMode: "air",
    estimatedDeparture: "",
    estimatedArrival: "",
    declaredValue: "",
    currency: "USD",
    incoterms: "DAP",
    gdpCompliance: false,
    gdpCertNumber: "",
    customsDocs: false,
    specialInstructions: "",
  })

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const sections = [
    {
      title: "Shipment Identification",
      icon: <ClipboardList size={16} />,
      fields: [
        { key: "shipmentId", label: "Shipment ID", type: "text", placeholder: "Auto-generated if blank" },
      ],
    },
    {
      title: "Parties",
      icon: <User size={16} />,
      fields: [
        { key: "shipperName", label: "Shipper Name", type: "text", placeholder: "Company name" },
        { key: "shipperContact", label: "Shipper Contact", type: "text", placeholder: "Email or phone" },
        { key: "consigneeName", label: "Consignee Name", type: "text", placeholder: "Recipient company" },
        { key: "consigneeContact", label: "Consignee Contact", type: "text", placeholder: "Email or phone" },
      ],
    },
    {
      title: "Cargo Details",
      icon: <Package size={16} />,
      fields: [
        { key: "cargoType", label: "Cargo Type", type: "select", options: ["vaccine", "biologic", "drug", "device"] },
        { key: "medicationName", label: "Medication Name", type: "text", placeholder: "Product name" },
        { key: "batchNumber", label: "Batch Number", type: "text", placeholder: "BATCH-XXXX" },
        { key: "lotNumber", label: "Lot Number", type: "text", placeholder: "LOT-XXXX" },
        { key: "quantity", label: "Quantity (units)", type: "number", placeholder: "0" },
        { key: "weight_kg", label: "Weight (kg)", type: "number", placeholder: "0.00" },
      ],
    },
    {
      title: "Cold Chain Requirements",
      icon: <Snowflake size={16} />,
      fields: [
        { key: "tempMinC", label: "Min Temp (°C)", type: "number", placeholder: "2" },
        { key: "tempMaxC", label: "Max Temp (°C)", type: "number", placeholder: "8" },
      ],
    },
    {
      title: "Routing",
      icon: <Route size={16} />,
      fields: [
        { key: "origin", label: "Origin", type: "location", placeholder: "IATA code or port name" },
        { key: "destination", label: "Destination", type: "location", placeholder: "IATA code or port name" },
        { key: "transitMode", label: "Transit Mode", type: "select", options: ["air", "maritime", "ground"] },
        { key: "estimatedDeparture", label: "Est. Departure", type: "datetime-local" },
        { key: "estimatedArrival", label: "Est. Arrival", type: "datetime-local" },
      ],
    },
    {
      title: "Financial",
      icon: <CreditCard size={16} />,
      fields: [
        { key: "declaredValue", label: "Declared Value", type: "number", placeholder: "0.00" },
        { key: "currency", label: "Currency", type: "select", options: ["USD", "EUR", "GBP", "JPY"] },
        { key: "incoterms", label: "Incoterms", type: "select", options: ["DAP", "DDP", "CIF", "FOB", "EXW"] },
      ],
    },
    {
      title: "Documents & Compliance",
      icon: <FileText size={16} />,
      fields: [
        { key: "gdpCompliance", label: "GDP Compliant", type: "checkbox" },
        { key: "gdpCertNumber", label: "GDP Cert Number", type: "text", placeholder: "If applicable" },
        { key: "customsDocs", label: "Customs Docs Ready", type: "checkbox" },
      ],
    },
    {
      title: "Special Instructions",
      icon: <MessageSquare size={16} />,
      fields: [
        { key: "specialInstructions", label: "Notes", type: "textarea", placeholder: "Any special handling requirements..." },
      ],
    },
  ]

  return (
    <div
      className="space-y-6 max-h-[calc(100vh-320px)] overflow-y-auto pr-2"
      style={{
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(88,166,255,0.3) transparent",
      }}
    >
      {sections.map((section, sIdx) => (
        <div key={sIdx}>
          <div
            className="flex items-center gap-2 mb-3 pb-2 border-b"
            style={{ borderColor: "rgba(88,166,255,0.1)" }}
          >
            <span style={{ color: "#58A6FF" }}>{section.icon}</span>
            <h4
              className="text-xs uppercase tracking-wider font-bold"
              style={{ color: "#E6EDF3" }}
            >
              {section.title}
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {section.fields.map((field) => (
              <div
                key={field.key}
                className={
                  field.type === "textarea" || field.type === "checkbox"
                    ? "col-span-2"
                    : ""
                }
              >
                <label
                  className="block text-[10px] uppercase tracking-wider mb-1.5 font-mono"
                  style={{ color: "#8B949E" }}
                >
                  {field.label}
                </label>

                {field.type === "select" ? (
                  <select
                    value={formData[field.key as keyof typeof formData] as string}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(88,166,255,0.2)",
                      color: "#E6EDF3",
                    }}
                  >
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    value={formData[field.key as keyof typeof formData] as string}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none resize-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(88,166,255,0.2)",
                      color: "#E6EDF3",
                    }}
                  />
                ) : field.type === "checkbox" ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData[field.key as keyof typeof formData] as boolean}
                      onChange={(e) => handleChange(field.key, e.target.checked)}
                      className="w-4 h-4 rounded"
                      style={{
                        accentColor: "#58A6FF",
                      }}
                    />
                    <span className="text-sm" style={{ color: "#E6EDF3" }}>
                      Yes
                    </span>
                  </label>
                ) : field.type === "location" ? (
                  <LocationSearch
                    mode={formData.transitMode === "maritime" ? "maritime" : "air"}
                    placeholder={field.placeholder}
                    onSelect={(loc) => handleChange(field.key, loc.code)}
                    inputStyle={{ padding: "8px 12px", fontSize: "13px", borderRadius: "8px" }}
                  />
                ) : (
                  <input
                    type={field.type}
                    value={formData[field.key as keyof typeof formData] as string}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(88,166,255,0.2)",
                      color: "#E6EDF3",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Submit Button */}
      <motion.button
        whileHover={{ boxShadow: "0 0 30px rgba(30,204,139,0.4)" }}
        className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
        style={{
          background: "linear-gradient(135deg, rgba(30, 204, 139, 0.85), rgba(20, 120, 75, 0.85))",
          border: "1px solid rgba(30, 204, 139, 0.5)",
          boxShadow: "0 0 20px rgba(30, 204, 139, 0.25)",
          color: "#fff",
        }}
      >
        <CheckCircle2 size={18} />
        Create Shipment
      </motion.button>
    </div>
  )
}

export default Dashboard
