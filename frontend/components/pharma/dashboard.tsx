"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { MapContainer } from "./map-container"
import { SearchPanel } from "./search-panel"
import { RiskBadge } from "./risk-badge"
import { ComplianceSidebar } from "./compliance-sidebar"
import { SignatureModal } from "./signature-modal"

// Dynamically import map to avoid SSR issues
const MapContainerDynamic = dynamic(
  () => import("./map-container").then((mod) => ({ default: mod.MapContainer })),
  { ssr: false }
)

interface SelectedOption {
  title: string
  type: "maritime" | "air"
  duration: string
  cost: string
  complianceStatus: "PASS" | "CRISIS" | "WARNING"
}

interface DashboardProps {
  userRole?: 'logistics_planner' | 'responsible_person'
}

export function Dashboard({ userRole = 'logistics_planner' }: DashboardProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | undefined>()
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false)
  const [selectedOption, setSelectedOption] = useState<SelectedOption>({
    title: "Port Said Emergency Diversion",
    type: "maritime",
    duration: "6h 30m",
    cost: "$12,400",
    complianceStatus: "PASS",
  })
  const [focusCoords, setFocusCoords] = useState<{ lng: number; lat: number; zoom?: number } | undefined>()

  const handleShipmentSelect = (shipmentId: string) => {
    // Focus map on selected shipment
    const coords: Record<string, { lng: number; lat: number; zoom: number }> = {
      "SHP-2026-0441": { lng: 32.35, lat: 30.0, zoom: 6 },
      "SHP-2026-0438": { lng: 50.1109, lat: 8.6821, zoom: 6 },
      "SHP-2026-0435": { lng: -0.1276, lat: 51.5074, zoom: 6 },
    }
    setFocusCoords(coords[shipmentId])
  }

  const handleOptionSelect = (option: { id: string; title: string; type: "maritime" | "air"; duration: string; cost: string; complianceStatus: "PASS" | "CRISIS" | "WARNING" }) => {
    setSelectedOptionId(option.id)
    setSelectedOption({
      title: option.title,
      type: option.type,
      duration: option.duration,
      cost: option.cost,
      complianceStatus: option.complianceStatus,
    })
  }

  const handleApprove = () => {
    setIsSignatureModalOpen(true)
  }

  const handleSignatureApprove = () => {
    // Handle successful signature
    setIsSignatureModalOpen(false)
    setSelectedOptionId(undefined)
  }

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: "#080B0F" }}>
      {/* Map background */}
      <MapContainerDynamic focusCoords={focusCoords} />

      {/* Search panel */}
      <SearchPanel onShipmentSelect={handleShipmentSelect} />

      {/* Compliance sidebar */}
      <ComplianceSidebar
        selectedOptionId={selectedOptionId}
        onOptionSelect={handleOptionSelect}
        onApprove={handleApprove}
        userRole={userRole}
      />

      {/* Risk badge */}
      <RiskBadge
        shipmentId="SHP-2026-0441"
        temp="7.4°C"
        trend="+0.6°C/hr"
        timeToSpoilage="9h 42m"
        level="CRITICAL_L1"
      />

      {/* Signature modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        selectedOption={selectedOption}
        onApprove={handleSignatureApprove}
        onClose={() => setIsSignatureModalOpen(false)}
      />
    </div>
  )
}
