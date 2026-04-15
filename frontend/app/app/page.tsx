'use client'

import { useState } from 'react'
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

type View = 'audit' | 'shipments' | 'tracker' | 'regumap' | 'crisis' | 'dashboard'

export default function AppPage() {
  const [userRole, setUserRole] = useState<'logistics_planner' | 'responsible_person' | null>(null)
  const [currentView, setCurrentView] = useState<View>('dashboard')

  const handleLogin = (role: string) => {
    setUserRole(role as 'logistics_planner' | 'responsible_person')
  }

  // Show login if not authenticated
  if (!userRole) {
    return (
      <div
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{ background: '#080B0F' }}
      >
        {/* CTA frame animation background */}
        <div className="absolute inset-0 z-0">
          <FrameAnimator frameFolder="cta" frameCount={80} fps={10} autoplay loop className="absolute inset-0" />
          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-black/60" />
        </div>

        {/* Subtle dot grid */}
        <div className="absolute inset-0 dot-grid opacity-10 pointer-events-none z-10" />

        {/* Glow effects */}
        <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full pointer-events-none z-10"
          style={{ background: 'radial-gradient(circle, rgba(88,166,255,0.08) 0%, transparent 70%)' }}
        />
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 rounded-full pointer-events-none z-10"
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
        <TopNav
          activeView={currentView}
          onViewChange={setCurrentView}
          hasCrisis={true}
        />

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {currentView === 'dashboard' && <Dashboard userRole={userRole} />}
            {currentView === 'regumap' && <ReguMapDashboard />}
            {currentView === 'crisis' && <CrisisTicketPage userRole={userRole} />}
            {currentView === 'tracker' && <LiveTrackerPage />}
            {currentView === 'shipments' && <ActiveShipmentsPage />}
            {currentView === 'audit' && <AuditLogPage />}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}
