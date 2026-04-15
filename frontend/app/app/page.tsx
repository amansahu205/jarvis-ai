'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LoginCard } from '@/components/pharma/login-card'
import { TopNav } from '@/components/pharma/top-nav'
import { Dashboard } from '@/components/pharma/dashboard'
import { ReguMapDashboard } from '@/components/pharma/regumap-dashboard'
import { CrisisTicketPage } from '@/components/pharma/crisis-ticket-page'
import { AuditLogPage } from '@/components/pharma/audit-log-page'
import { ActiveShipmentsPage } from '@/components/pharma/active-shipments-page'
import { LiveTrackerPage } from '@/components/pharma/live-tracker-page'
import { MobileBlocker } from '@/components/pharma/mobile-blocker'
import { FrameAnimator } from '@/components/frame-animator'
import {
  getActiveShipments,
  getLatestCrisisTicket,
  getLatestTelemetry,
  type ActiveShipmentItem,
  type CrisisTicketResponse,
  type TelemetryLatestResponse,
} from '@/lib/api'

type View = 'audit' | 'shipments' | 'tracker' | 'regumap' | 'crisis' | 'dashboard'

type ViewCache = Partial<{
  dashboard: ActiveShipmentItem[]
  regumap: TelemetryLatestResponse
  crisis: CrisisTicketResponse
  tracker: ActiveShipmentItem[]
  shipments: ActiveShipmentItem[]
  audit: { primedAt: number }
}>

export default function AppPage() {
  const [userRole, setUserRole] = useState<'logistics_planner' | 'responsible_person' | null>(null)
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [viewCache, setViewCache] = useState<ViewCache>({})
  const [mounted, setMounted] = useState(false)

  const cacheRef = useRef(viewCache)
  const inFlightRef = useRef<Partial<Record<View, Promise<void>>>>({})

  useEffect(() => {
    cacheRef.current = viewCache
  }, [viewCache])

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogin = (role: string) => {
    setUserRole(role as 'logistics_planner' | 'responsible_person')
  }

  const preloadView = async (view: View) => {
    try {
      if (cacheRef.current[view] !== undefined) return
      if (inFlightRef.current[view]) {
        await inFlightRef.current[view]
        return
      }

      const task = (async () => {
        try {
          switch (view) {
            case "dashboard": {
              const rows = await getActiveShipments()
              setViewCache((prev) => ({ ...prev, dashboard: rows }))
              break
            }
            case "regumap": {
              const telemetry = await getLatestTelemetry()
              setViewCache((prev) => ({ ...prev, regumap: telemetry }))
              break
            }
            case "crisis": {
              const ticket = await getLatestCrisisTicket()
              setViewCache((prev) => ({ ...prev, crisis: ticket }))
              break
            }
            case "tracker": {
              const rows = await getActiveShipments()
              setViewCache((prev) => ({ ...prev, tracker: rows }))
              break
            }
            case "shipments": {
              const rows = await getActiveShipments()
              setViewCache((prev) => ({ ...prev, shipments: rows }))
              break
            }
            case "audit": {
              setViewCache((prev) => ({ ...prev, audit: { primedAt: Date.now() } }))
              break
            }
          }
        } catch (error) {
          console.warn(`Preload failed for ${view}:`, error)
          if (view === 'dashboard' || view === 'tracker' || view === 'shipments') {
            setViewCache((prev) => ({ ...prev, [view]: [] as ActiveShipmentItem[] }))
          }
        }
      })().finally(() => {
        delete inFlightRef.current[view]
      })

      inFlightRef.current[view] = task
      await task
    } catch (error) {
      console.warn(`Preload helper failed for ${view}:`, error)
    }
  }

  const handleViewChange = (view: View) => {
    void preloadView(view)
    setCurrentView(view)
  }

  useEffect(() => {
    void preloadView('dashboard')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!mounted) {
    return <div className="min-h-screen" style={{ background: '#080B0F' }} suppressHydrationWarning />
  }

  // Show login if not authenticated
  if (!userRole) {
    return (
      <div
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{ background: '#080B0F' }}
        suppressHydrationWarning
      >
        {/* CTA frame animation background */}
        <div className="absolute inset-0 z-0" suppressHydrationWarning>
          <FrameAnimator frameFolder="cta" frameCount={80} fps={10} autoplay loop className="absolute inset-0" />
          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-black/60" />
        </div>

        {/* Subtle dot grid */}
        <div className="absolute inset-0 dot-grid opacity-10 pointer-events-none z-10" />

        {/* Glow effects */}
        <div
          className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full pointer-events-none z-10"
          style={{ background: 'radial-gradient(circle, rgba(88,166,255,0.08) 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-1/4 right-1/3 w-96 h-96 rounded-full pointer-events-none z-10"
          style={{ background: 'radial-gradient(circle, rgba(30,204,139,0.05) 0%, transparent 70%)' }}
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative z-20"
        >
          <LoginCard onLogin={handleLogin} />
        </motion.div>
      </div>
    )
  }

  return (
    <>
      <MobileBlocker />
      <div className="min-h-screen" style={{ background: '#080B0F' }}>
        <TopNav activeView={currentView} onViewChange={handleViewChange} hasCrisis={true} />

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {currentView === 'dashboard' && (
              <Dashboard userRole={userRole} initialActiveShipments={viewCache.dashboard} />
            )}
            {currentView === 'regumap' && <ReguMapDashboard initialTelemetry={viewCache.regumap} />}
            {currentView === 'crisis' && <CrisisTicketPage userRole={userRole} initialTicket={viewCache.crisis} />}
            {currentView === 'tracker' && <LiveTrackerPage initialShipments={viewCache.tracker} />}
            {currentView === 'shipments' && <ActiveShipmentsPage initialShipments={viewCache.shipments} />}
            {currentView === 'audit' && <AuditLogPage />}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}


