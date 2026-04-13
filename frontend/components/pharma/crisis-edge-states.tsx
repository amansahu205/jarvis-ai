'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertOctagon,
  XCircle,
  AlertTriangle,
  Lock,
  BadgeCheck,
  RefreshCw,
  PhoneOff,
  WifiOff,
  Info,
  X,
  CheckCircle2,
} from 'lucide-react'

/* ============ EXPORT 1: NoCompliantRouteState ============ */
interface NoCompliantRouteStateProps {
  onManualOverride: (action: string) => void
  blockedRoutes?: string[]
}

export function NoCompliantRouteState({
  onManualOverride,
  blockedRoutes = [
    'Emergency Air from Dubai — BLOCKED: UAE Import Restriction 2026-03',
    'Continue Original Route — BLOCKED: Cargo spoilage certain',
    'Diversion to Aden — BLOCKED: Yemen Port Authority suspension',
  ],
}: NoCompliantRouteStateProps) {
  const [justification, setJustification] = useState('')

  return (
    <div
      className="w-full rounded-lg p-5"
      style={{
        background: 'rgba(255,68,68,0.06)',
        border: '1px solid rgba(255,68,68,0.25)',
      }}
    >
      <div className="flex items-start gap-3 mb-2">
        <AlertOctagon size={20} style={{ color: '#FF4444' }} className="flex-shrink-0 mt-1" />
        <div className="flex-1">
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: '#FF4444',
              textTransform: 'uppercase',
            }}
          >
            No Compliant Reroute Available
          </div>
          <div
            style={{
              fontSize: '12px',
              color: '#8B949E',
              marginTop: '8px',
              lineHeight: 1.6,
            }}
          >
            The Strategist evaluated all candidate routes. Every option is blocked by active regulatory
            restrictions. Manual intervention is required.
          </div>
        </div>
      </div>

      {/* Blocked routes list */}
      <div style={{ marginTop: '12px' }}>
        {blockedRoutes.map((route, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2 mb-2 pb-2"
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <XCircle size={12} style={{ color: '#FF4444', marginTop: '3px', flexShrink: 0 }} />
            <div className="flex-1">
              <div style={{ fontSize: '11px', color: '#E6EDF3' }}>{route}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Manual override section */}
      <div style={{ marginTop: '16px' }}>
        <textarea
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Describe your manual intervention decision and justification..."
          style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,68,68,0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            width: '100%',
            height: '80px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '12px',
            color: '#E6EDF3',
            resize: 'none',
          }}
        />

        <button
          onClick={() => onManualOverride(justification)}
          disabled={!justification.trim()}
          style={{
            marginTop: '8px',
            width: '100%',
            padding: '8px 12px',
            background: justification.trim() ? 'rgba(255,68,68,0.1)' : 'rgba(255,68,68,0.05)',
            border: '1px solid rgba(255,68,68,0.3)',
            borderRadius: '8px',
            color: justification.trim() ? '#FF4444' : 'rgba(255,68,68,0.5)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: justification.trim() ? 'pointer' : 'not-allowed',
            opacity: justification.trim() ? 1 : 0.4,
            transition: 'all 0.2s',
          }}
        >
          Submit Manual Override
        </button>

        <div
          style={{
            fontSize: '10px',
            color: '#F0A500',
            fontFamily: 'JetBrains Mono, monospace',
            marginTop: '6px',
          }}
        >
          ⚠ Manual override will be logged to audit ledger with your justification
        </div>
      </div>
    </div>
  )
}

/* ============ EXPORT 2: IncompleteDraftsWarning ============ */
interface IncompleteDraftsWarningProps {
  failedDrafts?: string[]
}

export function IncompleteDraftsWarning({
  failedDrafts = ['Insurance Pre-fill Document'],
}: IncompleteDraftsWarningProps) {
  return (
    <div
      className="w-full rounded-lg p-3.5 flex gap-2 items-start"
      style={{
        background: 'rgba(240,165,0,0.08)',
        border: '1px solid rgba(240,165,0,0.25)',
      }}
    >
      <AlertTriangle size={14} style={{ color: '#F0A500', marginTop: '2px', flexShrink: 0 }} />
      <div className="flex-1">
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#F0A500', marginBottom: '2px' }}>
          Draft generation incomplete
        </div>
        <div style={{ fontSize: '10px', color: '#8B949E', marginBottom: '4px' }}>
          The following drafts could not be generated and require manual completion after approval:
        </div>
        <div style={{ fontSize: '10px', color: '#F0A500', fontFamily: 'JetBrains Mono, monospace' }}>
          {failedDrafts.map((draft) => (
            <div key={draft}>· {draft}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ============ EXPORT 3: SessionExpiredOverlay ============ */
interface SessionExpiredOverlayProps {
  onReAuthenticate: () => void
  ticketId: string
}

export function SessionExpiredOverlay({
  onReAuthenticate,
  ticketId,
}: SessionExpiredOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-300 flex items-center justify-center"
      style={{
        background: 'rgba(0,0,0,0.9)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-[420px] rounded-lg p-8"
        style={{
          background: 'rgba(8,11,15,0.95)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(88,166,255,0.2)',
        }}
      >
        <div className="flex justify-center mb-4">
          <div
            className="relative"
            style={{
              width: '64px',
              height: '64px',
              background: 'rgba(88,166,255,0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 24px rgba(88,166,255,0.2)',
            }}
          >
            <Lock size={32} style={{ color: '#58A6FF' }} />
          </div>
        </div>

        <div
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#E6EDF3',
            textAlign: 'center',
            marginTop: '16px',
          }}
        >
          Session Expired
        </div>

        <div
          style={{
            fontSize: '13px',
            color: '#8B949E',
            textAlign: 'center',
            lineHeight: 1.6,
            marginTop: '8px',
          }}
        >
          Your session expired while reviewing Crisis Ticket {ticketId}. Please sign in again to
          maintain your audit trail and complete the approval.
        </div>

        {/* Note */}
        <div
          className="flex gap-2 mt-4 p-3 rounded-lg"
          style={{
            background: 'rgba(240,165,0,0.06)',
            border: '1px solid rgba(240,165,0,0.2)',
          }}
        >
          <Info size={12} style={{ color: '#F0A500', marginTop: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '11px', color: '#8B949E' }}>
            Your review progress has been preserved. You will return to the same ticket after
            signing in.
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onReAuthenticate}
          className="w-full mt-6 py-3 rounded-lg font-semibold transition-all hover:shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #58A6FF 0%, #2E7DB3 100%)',
            color: '#080B0F',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          Re-authenticate to Continue
        </button>

        <div
          style={{
            fontSize: '10px',
            fontFamily: 'JetBrains Mono, monospace',
            color: '#484F58',
            textAlign: 'center',
            marginTop: '12px',
          }}
        >
          Ticket: {ticketId}
        </div>
      </motion.div>
    </div>
  )
}

/* ============ EXPORT 4: ComplianceRecheckWarning ============ */
interface ComplianceRecheckWarningProps {
  changedJurisdictions: string[]
  onDismiss: () => void
}

export function ComplianceRecheckWarning({
  changedJurisdictions,
  onDismiss,
}: ComplianceRecheckWarningProps) {
  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky z-40 w-full"
      style={{
        top: '88px',
        background: 'rgba(240,165,0,0.1)',
        borderBottom: '1px solid rgba(240,165,0,0.3)',
        padding: '10px 24px',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity }}>
            <RefreshCw size={14} style={{ color: '#F0A500' }} />
          </motion.div>
          <span style={{ fontSize: '12px', fontWeight: 500, color: '#F0A500' }}>
            Compliance status updated since route generation
          </span>
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'JetBrains Mono, monospace',
              color: '#8B949E',
              marginLeft: '16px',
            }}
          >
            Affected: {changedJurisdictions.join(', ')}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span
            style={{
              fontSize: '11px',
              color: '#58A6FF',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Review updated timeline →
          </span>
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X size={14} style={{ color: '#8B949E' }} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

/* ============ EXPORT 5: DualApprovalBlocker ============ */
interface DualApprovalBlockerProps {
  approvedBy: string
  approvedAt: string
  onViewAuditLog: () => void
  onReturnToDashboard: () => void
}

export function DualApprovalBlocker({
  approvedBy,
  approvedAt,
  onViewAuditLog,
  onReturnToDashboard,
}: DualApprovalBlockerProps) {
  return (
    <div
      className="fixed inset-0 z-300 flex items-center justify-center"
      style={{
        background: 'rgba(0,0,0,0.9)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-[420px] rounded-lg p-8"
        style={{
          background: 'rgba(8,11,15,0.95)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(30,204,139,0.2)',
        }}
      >
        <div className="flex justify-center mb-4">
          <div
            className="relative"
            style={{
              width: '64px',
              height: '64px',
              background: 'rgba(30,204,139,0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 24px rgba(30,204,139,0.2)',
            }}
          >
            <BadgeCheck size={32} style={{ color: '#1ECC8B' }} />
          </div>
        </div>

        <div
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#E6EDF3',
            textAlign: 'center',
            marginTop: '16px',
          }}
        >
          Already Approved
        </div>

        <div
          style={{
            fontSize: '13px',
            color: '#8B949E',
            textAlign: 'center',
            marginTop: '8px',
          }}
        >
          This ticket was approved on another device.
        </div>

        {/* Approval info card */}
        <div
          className="mt-4 p-3 rounded-lg"
          style={{
            background: 'rgba(30,204,139,0.06)',
            border: '1px solid rgba(30,204,139,0.15)',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontFamily: 'JetBrains Mono, monospace',
              color: '#E6EDF3',
              marginBottom: '4px',
            }}
          >
            Signed by: {approvedBy}
          </div>
          <div
            style={{
              fontSize: '12px',
              fontFamily: 'JetBrains Mono, monospace',
              color: '#8B949E',
            }}
          >
            At: {approvedAt}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onViewAuditLog}
            className="flex-1 py-3 rounded-lg font-semibold border"
            style={{
              background: 'rgba(88,166,255,0.08)',
              border: '1px solid rgba(88,166,255,0.2)',
              color: '#58A6FF',
              fontSize: '14px',
            }}
          >
            View Audit Log
          </button>
          <button
            onClick={onReturnToDashboard}
            className="flex-1 py-3 rounded-lg font-semibold"
            style={{
              background: 'linear-gradient(135deg, #58A6FF 0%, #2E7DB3 100%)',
              color: '#080B0F',
              fontSize: '14px',
            }}
          >
            Return to Dashboard
          </button>
        </div>
      </motion.div>
    </div>
  )
}

/* ============ EXPORT 6: ElevenLabsCallFailed ============ */
interface ElevenLabsCallFailedProps {
  onRetryCall?: () => void
}

export function ElevenLabsCallFailed({ onRetryCall }: ElevenLabsCallFailedProps) {
  return (
    <div
      className="w-full rounded-lg p-3 mb-4"
      style={{
        background: 'rgba(240,165,0,0.08)',
        border: '1px solid rgba(240,165,0,0.25)',
        borderLeft: '3px solid #F0A500',
      }}
    >
      <div className="flex items-start gap-2 mb-2">
        <PhoneOff size={14} style={{ color: '#F0A500', marginTop: '2px', flexShrink: 0 }} />
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#E6EDF3' }}>
          ElevenLabs call failed
        </div>
      </div>

      <div style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#8B949E' }}>
        Fallback channels active: push notification + email delivered
      </div>

      <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#484F58' }}>
          ERR-2026-0441-CALL
        </div>
        <button
          onClick={onRetryCall}
          className="px-2 py-1 rounded text-xs transition-all"
          style={{
            background: 'rgba(240,165,0,0.1)',
            border: '1px solid rgba(240,165,0,0.3)',
            color: '#F0A500',
            cursor: 'pointer',
          }}
        >
          Retry Call
        </button>
      </div>

      <div
        style={{
          fontSize: '9px',
          color: '#484F58',
          fontStyle: 'italic',
          marginTop: '6px',
        }}
      >
        PENDING_APPROVAL state maintained regardless of call status
      </div>
    </div>
  )
}

/* ============ EXPORT 7: FeedLostCrisisBanner ============ */
interface FeedLostCrisisBannerProps {
  shipmentId: string
  lastSignalTime?: string
}

export function FeedLostCrisisBanner({
  shipmentId,
  lastSignalTime = '47m ago',
}: FeedLostCrisisBannerProps) {
  return (
    <div
      className="w-full rounded-lg p-4"
      style={{
        background: 'rgba(72,79,88,0.15)',
        border: '1px solid rgba(72,79,88,0.4)',
      }}
    >
      <div className="flex items-start gap-3">
        <WifiOff size={20} style={{ color: '#484F58', marginTop: '2px', flexShrink: 0 }} />
        <div className="flex-1">
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#E6EDF3' }}>
            Telemetry feed lost
          </div>
          <div style={{ fontSize: '12px', color: '#8B949E', marginTop: '4px', lineHeight: 1.6 }}>
            Real-time temperature and telemetry data for shipment{' '}
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#E6EDF3' }}>
              {shipmentId}
            </span>{' '}
            is currently offline. Last signal received: {lastSignalTime}
          </div>

          {/* Emergency telemetry from last signal */}
          <div
            className="mt-3 p-3 rounded"
            style={{
              background: 'rgba(255,68,68,0.04)',
              border: '1px solid rgba(255,68,68,0.15)',
            }}
          >
            <div
              style={{
                fontSize: '9px',
                fontFamily: 'JetBrains Mono, monospace',
                color: '#FF4444',
                textTransform: 'uppercase',
                marginBottom: '6px',
              }}
            >
              Last reported status
            </div>
            <div
              style={{
                fontSize: '11px',
                fontFamily: 'JetBrains Mono, monospace',
                color: '#8B949E',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: '8px 16px',
              }}
            >
              <span>Temp:</span>
              <span style={{ color: '#FF4444' }}>7.4°C (+0.6°C/hr)</span>
              <span>Humidity:</span>
              <span>42%</span>
              <span>Location:</span>
              <span>Suez Canal — GPS: 31.345°N, 32.347°E</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            <button
              className="px-3 py-1 rounded text-xs transition-all"
              style={{
                background: 'rgba(88,166,255,0.1)',
                border: '1px solid rgba(88,166,255,0.2)',
                color: '#58A6FF',
              }}
            >
              Reconnect Satellite
            </button>
            <button
              className="px-3 py-1 rounded text-xs transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#8B949E',
              }}
            >
              Resume Polling
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
