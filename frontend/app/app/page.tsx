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

type View = 'audit' | 'shipments' | 'tracker' | 'regumap' | 'crisis' | 'dashboard'

export default function AppPage() {
  const [userRole, setUserRole] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<View>('dashboard')

  const handleLogin = (role: string) => {
    setUserRole(role)
  }

  // Show login if not authenticated
  if (!userRole) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#080B0F' }}
      >
        {/* Subtle dot grid background */}
        <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />

        {/* Glow effects */}
        <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(88,166,255,0.06) 0%, transparent 70%)' }}
        />
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(30,204,139,0.04) 0%, transparent 70%)' }}
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative z-10"
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
