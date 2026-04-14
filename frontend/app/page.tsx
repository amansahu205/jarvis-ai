"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { LoginCard } from "@/components/pharma/login-card"
import { TopNav } from "@/components/pharma/top-nav"
import { AuditLogPage } from "@/components/pharma/audit-log-page"
import { ActiveShipmentsPage } from "@/components/pharma/active-shipments-page"
import { LiveTrackerPage } from "@/components/pharma/live-tracker-page"
import { Dashboard } from "@/components/pharma/dashboard"
import { ReguMapDashboard } from "@/components/pharma/regumap-dashboard"
import { CrisisTicketPage } from "@/components/pharma/crisis-ticket-page"
import { MobileBlocker } from "@/components/pharma/mobile-blocker"

const ThreeBackground = dynamic(
  () => import("@/components/pharma/three-background").then((m) => m.ThreeBackground),
  { ssr: false }
)

type View = "login" | "dashboard" | "audit" | "shipments" | "tracker" | "regumap" | "crisis"
type UserRole = 'logistics_planner' | 'responsible_person'

export default function Page() {
  const [currentView, setCurrentView] = useState<View>("login")
  const [isMobile, setIsMobile] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userRole, setUserRole] = useState<UserRole>('logistics_planner')
  const [hasMounted, setHasMounted] = useState(false)

  // Mark as mounted after hydration to avoid SSR mismatch
  useEffect(() => {
    setHasMounted(true)
  }, [])

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Handle login success (simulated)
  const handleLogin = (role?: string) => {
    setIsLoggedIn(true)
    if (role === 'responsible_person' || role === 'Responsible Person') {
      setUserRole('responsible_person')
    } else {
      setUserRole('logistics_planner')
    }
    setCurrentView("regumap")
  }

  // Mobile blocker takes priority (only after hydration to avoid mismatch)
  if (hasMounted && isMobile) {
    return <MobileBlocker />
  }

  // Show loading/blank on server/hydration phase to match both renders
  if (!hasMounted) {
    return <div style={{ width: '100vw', height: '100vh', background: '#080B0F' }} />
  }

  // Login view
  if (currentView === "login" || !isLoggedIn) {
    return (
      <main
        className="relative w-full h-screen overflow-hidden flex items-center justify-center"
        style={{ background: "#080B0F" }}
      >
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 1,
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(48,54,61,0.15) 0px, rgba(48,54,61,0.15) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, rgba(48,54,61,0.15) 0px, rgba(48,54,61,0.15) 1px, transparent 1px, transparent 40px)",
          }}
        />

        {/* Three.js canvas behind everything */}
        <ThreeBackground />

        {/* Login card */}
        <div style={{ position: "relative", zIndex: 10 }}>
          <LoginCard onLogin={handleLogin} />
        </div>
      </main>
    )
  }

  // Main app views (after login)
  return (
    <div className="relative w-full min-h-screen" style={{ background: "#080B0F" }}>
      {/* Top navigation */}
      <TopNav
        activeView={currentView as "dashboard" | "audit" | "shipments" | "tracker" | "regumap" | "crisis"}
        onViewChange={(view) => setCurrentView(view)}
        hasCrisis={true}
      />

      {/* Content */}
      {currentView === "crisis" && <CrisisTicketPage userRole={userRole} />}
      {currentView === "dashboard" && <Dashboard userRole={userRole} />}
      {currentView === "regumap" && <ReguMapDashboard />}
      {currentView === "audit" && <AuditLogPage />}
      {currentView === "shipments" && <ActiveShipmentsPage />}
      {currentView === "tracker" && <LiveTrackerPage />}
    </div>
  )
}
