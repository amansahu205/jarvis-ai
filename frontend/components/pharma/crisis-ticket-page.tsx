'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, Phone, Mail, Bell, Hospital, Package, FileText, ChevronRight,
  TrendingUp, Navigation, Clock, Radar, ExternalLink, Bug, Workflow,
} from 'lucide-react'
import { SignatureModal } from './signature-modal'
import { CascadeActionsPanel } from './cascade-actions-panel'
import {
  NoCompliantRouteState,
  IncompleteDraftsWarning,
  SessionExpiredOverlay,
  ComplianceRecheckWarning,
  DualApprovalBlocker,
  ElevenLabsCallFailed,
  FeedLostCrisisBanner,
} from './crisis-edge-states'
import { ApiError, approveCrisisTicket, getLatestCrisisTicket, type CrisisTicketResponse } from '@/lib/api'

const MapComponent = dynamic(() => import('./map-component'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-[#080B0F]" />,
})

interface RerouteOption {
  id: string
  title: string
  type: 'air' | 'maritime' | 'multimodal'
  duration: string
  cost: string
  complianceStatus: 'PASS' | 'FLAG' | 'CRISIS'
  note?: string
}

interface DraftItem {
  id: string
  title: string
  icon: any
  content: string
  status: 'DRAFT'
}

interface ComplianceCard {
  flag: string
  name: string
  type: 'ORIGIN' | 'TRANSIT' | 'TRANSIT JURISDICTION' | 'INTERNATIONAL WATERS' | 'DESTINATION'
  regulation: string
  clause: string
  badge: 'PASS' | 'FLAG'
  warning?: string
  citation: string
}

interface CrisisTicketPageProps {
  userRole?: 'logistics_planner' | 'responsible_person'
  initialTicket?: CrisisTicketResponse
}

function mapCrisisOptionToUi(option: CrisisTicketResponse['evaluated_routes'][number]): RerouteOption {
  const status = (option.compliance_status || 'PENDING').toUpperCase()
  const complianceStatus: RerouteOption['complianceStatus'] =
    status === 'PASS' ? 'PASS' : status === 'FLAG' ? 'FLAG' : 'CRISIS'
  const transitMode = (option.transit_mode || 'maritime').toLowerCase()
  const uiMode: RerouteOption['type'] =
    transitMode === 'air' ? 'air' : transitMode === 'multimodal' ? 'multimodal' : 'maritime'

  return {
    id: option.route_id,
    title: option.strategist_note || `Route ${option.route_id}`,
    type: uiMode,
    duration: `~${Number(option.estimated_hours || 0).toFixed(1)}h`,
    cost: `Risk ${(option.risk_score || 100).toFixed(1)}` ,
    complianceStatus,
    note: option.compliance_note || undefined,
  }
}

const rerouteOptions: RerouteOption[] = [
  {
    id: 'opt-1',
    title: 'Port Said Emergency Diversion',
    type: 'air',
    duration: '~14.5h',
    cost: '~$8,200 est.',
    complianceStatus: 'PASS',
  },
  {
    id: 'opt-2',
    title: 'Emergency Air from Suez City',
    type: 'air',
    duration: '~6h',
    cost: '~$24,000 est.',
    complianceStatus: 'FLAG',
    note: '⚠ UAE Transit Restriction',
  },
]

const diplomatDrafts: DraftItem[] = [
  {
    id: 'draft-1',
    title: 'Hospital Notification Email',
    icon: Hospital,
    content: 'To: Frankfurt University Hospital Scheduling\nRe: Shipment SHP-2026-0441 Delay...',
    status: 'DRAFT',
  },
  {
    id: 'draft-2',
    title: 'ERP Inventory Update',
    icon: Package,
    content: '{ "shipment_id": "SHP-2026-0441", "status": "REROUTED"...',
    status: 'DRAFT',
  },
  {
    id: 'draft-3',
    title: 'Insurance Pre-fill Document',
    icon: FileText,
    content: 'CLAIM PRE-FILL — Spoilage Risk: 78%\nShipment: SHP-2026-0441...',
    status: 'DRAFT',
  },
]

const complianceCards: ComplianceCard[] = [
  {
    flag: '🇮🇳',
    name: 'India — Origin Country',
    type: 'ORIGIN',
    regulation: 'CDSCO Schedule M · WHO-GDP Annex 9',
    clause: 'Temperature-sensitive pharmaceutical exports require Form 40 and WHO-certified cold chain documentation. CDSCO Schedule M mandates temperature monitoring records from point of manufacture.',
    badge: 'PASS',
    citation: 'View: CDSCO Schedule M (2023) ↗',
  },
  {
    flag: '🌊',
    name: 'Arabian Sea — International Waters',
    type: 'INTERNATIONAL WATERS',
    regulation: 'IMO MARPOL Annex II · WHO TRS 961',
    clause: 'Pharmaceutical cargo in international waters subject to flag state regulations. WHO Good Distribution Practice applies throughout transit. No port authority approvals required during open-water passage.',
    badge: 'PASS',
    citation: 'View: WHO TRS 961 Annex 9 ↗',
  },
  {
    flag: '🇪🇬',
    name: 'Egypt — Suez Canal Transit',
    type: 'TRANSIT JURISDICTION',
    regulation: 'Egyptian Drug Authority Resolution 442 · MOHP Cold Chain Directive 2023',
    clause: 'Pharmaceutical transit through Egyptian territorial waters requires EDA pre-notification minimum 72 hours prior to vessel entry. Emergency staging permitted at Port Said under Article 9. Cold chain logs must be WHO-certified.',
    badge: 'FLAG',
    warning: '⚠ 72-hour pre-notification · EDA Article 9 · Emergency staging: Port Said',
    citation: 'View: EDA Resolution 442-2023 ↗',
  },
  {
    flag: '🇺🇸',
    name: 'United States — Destination',
    type: 'DESTINATION',
    regulation: 'FDA 21 CFR Part 211 · USP <1079> Cold Chain',
    clause: 'Import of biological vaccines requires FDA Form 2877. Temperature excursion reports must be filed within 24 hours of detection. USP Chapter 1079 compliance mandatory for all cold-chain biological shipments.',
    badge: 'PASS',
    citation: 'View: FDA 21 CFR Part 211 ↗',
  },
]

type EdgeState =
  | 'normal'
  | 'no_route'
  | 'incomplete_drafts'
  | 'session_expired'
  | 'compliance_recheck'
  | 'dual_approval'
  | 'call_failed'
  | 'feed_lost'

export function CrisisTicketPage({ userRole = 'responsible_person', initialTicket }: CrisisTicketPageProps) {
  const [selectedOptionId, setSelectedOptionId] = useState('opt-1')
  const [secondsLeft, setSecondsLeft] = useState(9 * 3600 + 42 * 60)
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null)
  const [expandedCompliance, setExpandedCompliance] = useState<number | null>(null)
  const [showTranscript, setShowTranscript] = useState(false)
  const [showRejectionDropdown, setShowRejectionDropdown] = useState(false)
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false)
  const [signatureModalState, setSignatureModalState] = useState<'idle' | 'verifying' | 'writing' | 'error' | 'success'>('idle')
  const [showCascadePanel, setShowCascadePanel] = useState(false)
  const [isApproved, setIsApproved] = useState(false)
  const [approvedAt, setApprovedAt] = useState<string | undefined>()
  const [edgeState, setEdgeState] = useState<EdgeState>('normal')
  const [showDevSimulator, setShowDevSimulator] = useState(false)
  const [ticketData, setTicketData] = useState<CrisisTicketResponse | null>(null)
  const [ticketLoadError, setTicketLoadError] = useState<string | null>(null)
  const [liveRerouteOptions, setLiveRerouteOptions] = useState<RerouteOption[]>(rerouteOptions)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Live countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (initialTicket) {
      setTicketData(initialTicket)
      if (initialTicket.evaluated_routes && initialTicket.evaluated_routes.length > 0) {
        const mapped = initialTicket.evaluated_routes.map(mapCrisisOptionToUi)
        setLiveRerouteOptions(mapped)
        setSelectedOptionId((prev) => (mapped.some((option) => option.id === prev) ? prev : mapped[0].id))
      }
      return
    }

    let cancelled = false

    const loadTicket = async () => {
      try {
        const latestTicket = await getLatestCrisisTicket()
        if (cancelled) return

        setTicketData(latestTicket)
        if (latestTicket.evaluated_routes && latestTicket.evaluated_routes.length > 0) {
          const mapped = latestTicket.evaluated_routes.map(mapCrisisOptionToUi)
          setLiveRerouteOptions(mapped)
          setSelectedOptionId((prev) => (mapped.some((option) => option.id === prev) ? prev : mapped[0].id))
        }
      } catch (error) {
        if (cancelled) return
        setTicketLoadError(error instanceof ApiError ? error.message : 'Unable to load latest crisis ticket')
      }
    }

    void loadTicket()

    return () => {
      cancelled = true
    }
  }, [initialTicket])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const isUrgent = secondsLeft < 7200
  const isCriticalUrgent = secondsLeft < 3600

  const selectedOption = liveRerouteOptions.find((o) => o.id === selectedOptionId)
  const ticketStatus = ticketData?.status || 'PENDING_APPROVAL'
  const ticketStatusTone = ticketStatus === 'APPROVED' ? '#1ECC8B' : '#F0A500'

  const handleReject = (reason: string) => {
    console.log('[v0] Rejection:', reason)
    setShowRejectionDropdown(false)
  }

  const handleApprove = () => {
    setIsSignatureModalOpen(true)
  }

  const handleSignatureApprove = async () => {
    setSignatureModalState('verifying')
    await new Promise((r) => setTimeout(r, 1500))
    setSignatureModalState('writing')

    try {
      const fallbackTicketId = Number(String(ticketData?.ticket_id || 0))
      if (fallbackTicketId > 0) {
        const approval = await approveCrisisTicket(fallbackTicketId, 'Approved from command center signature flow')
        setTicketData((prev) =>
          prev
            ? { ...prev, status: approval.status }
            : prev,
        )
      }

      await new Promise((r) => setTimeout(r, 1200))
      setSignatureModalState('success')
      await new Promise((r) => setTimeout(r, 800))
      setIsSignatureModalOpen(false)
      setIsApproved(true)
      setApprovedAt(new Date().toISOString())
      setSignatureModalState('idle')
      setTimeout(() => setShowCascadePanel(true), 800)
    } catch (error) {
      setSignatureModalState('error')
      setTicketLoadError(error instanceof ApiError ? error.message : 'RP approval write failed')
    }
  }

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: '#080B0F' }}>
      <style jsx global>{`
        @keyframes crisis-border-pulse {
          0%, 100% {
            border-color: #FF4444;
            box-shadow: 0 2px 0 rgba(255, 68, 68, 0.4);
          }
          50% {
            border-color: rgba(255, 68, 68, 0.15);
            box-shadow: none;
          }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .crisis-border { animation: crisis-border-pulse 1.5s ease-in-out infinite; }
        .shake { animation: shake 0.3s ease-in-out; }
        .pulse-dot { animation: pulse-dot 1s ease-in-out infinite; }
        .scrollbar-thin {
          scrollbar-width: thin;
          scrollbar-color: rgba(88, 166, 255, 0.3) transparent;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 2px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(88, 166, 255, 0.3);
          border-radius: 10px;
        }
      `}</style>

      {/* CRISIS HEADER BAND */}
      <div
        className="sticky top-16 z-40 flex items-center justify-between px-6 crisis-border"
        style={{
          height: '88px',
          background: 'rgba(8,11,15,0.95)',
          backdropFilter: 'blur(24px)',
          borderBottom: '2px solid transparent',
        }}
      >
        {/* Left Section */}
        <motion.div
          className="flex flex-col gap-1"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3">
            <motion.div
              className="px-2.5 py-0.75 rounded text-white font-bold text-xs uppercase"
              style={{
                background: '#FF4444',
                boxShadow: '0 0 16px rgba(255,68,68,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
              animate={{ opacity: [1, 0.7, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              CRITICAL L1
            </motion.div>
            <span
              className="font-bold text-2xl"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                color: '#E6EDF3',
              }}
            >
              {ticketData?.shipment_id || 'SHP-2026-0441'}
            </span>
          </div>
          <div
            className="text-xs"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              color: '#8B949E',
            }}
          >
            Suez Canal · 30.5°N 32.3°E · Maritime
          </div>
        </motion.div>

        {/* Center Section - Live Countdown */}
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div
            className="text-xs uppercase tracking-widest"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              color: '#8B949E',
            }}
          >
            TIME TO SPOILAGE
          </div>
          <motion.div
            className={`mt-1 font-black tracking-tighter ${isCriticalUrgent ? 'shake' : ''}`}
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              color: '#FF4444',
              fontSize: isUrgent ? '48px' : '40px',
              textShadow: '0 0 10px rgba(255,68,68,0.8), 0 0 30px rgba(255,68,68,0.4)',
            }}
          >
            {formatTime(secondsLeft)}
          </motion.div>
          {isCriticalUrgent && (
            <div
              className="text-xs uppercase font-bold mt-1"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                color: '#FF4444',
              }}
            >
              CRITICAL
            </div>
          )}
        </motion.div>

        {/* Right Section - Alert Channels */}
        <motion.div
          className="flex gap-1"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(8px)',
            borderRadius: '12px',
            padding: '4px',
          }}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          {[
            { icon: Phone, label: 'Call', color: '#1ECC8B' },
            { icon: Mail, label: 'Email', color: '#1ECC8B' },
            { icon: Bell, label: 'Push', color: '#1ECC8B' },
          ].map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              className="flex items-center gap-1"
              style={{
                background: 'rgba(30,204,139,0.1)',
                border: '1px solid rgba(30,204,139,0.2)',
                borderRadius: '8px',
                padding: '4px 10px',
              }}
            >
              <Icon size={12} style={{ color }} />
              <span
                className="text-xs uppercase font-bold"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color,
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex" style={{ height: 'calc(100vh - 216px)' }}>
        {/* LEFT PANEL */}
        <motion.div
          className="scrollbar-thin overflow-y-auto"
          style={{
            width: '300px',
            background: 'rgba(6,9,13,0.9)',
            backdropFilter: 'blur(28px)',
            borderRight: '1px solid rgba(255,255,255,0.05)',
            boxShadow: 'inset -1px 0 0 rgba(88,166,255,0.05)',
            padding: '16px',
          }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {/* LIVE TELEMETRY */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2.5">
              <span
                className="text-xs uppercase tracking-wider"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#484F58',
                }}
              >
                LIVE TELEMETRY
              </span>
              <div className="flex items-center gap-1">
                <div className="pulse-dot w-1.5 h-1.5 rounded-full" style={{ background: '#FF4444' }} />
                <span
                  className="text-xs"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    color: '#FF4444',
                  }}
                >
                  LIVE
                </span>
              </div>
            </div>

            {/* Telemetry Table */}
            <div className="space-y-px">
              {/* Header Row */}
              <div className="grid grid-cols-4 gap-2 pb-1.5 text-xs uppercase" style={{ color: '#484F58', fontFamily: 'JetBrains Mono, monospace' }}>
                <span>TIME</span>
                <span>TEMP</span>
                <span>Δ</span>
                <span>STATUS</span>
              </div>

              {/* Data Rows */}
              {[
                { time: '02:00', temp: '5.2°C', delta: '+0.0', status: '✓ NORMAL', color: '#1ECC8B', isAlert: false },
                { time: '02:30', temp: '5.7°C', delta: '+0.5', status: '✓ NORMAL', color: '#1ECC8B', isAlert: false },
                { time: '03:00', temp: '6.2°C', delta: '+0.5', status: '✓ NORMAL', color: '#1ECC8B', isAlert: false },
                { time: '03:30', temp: '6.8°C', delta: '+0.6', status: '⚠ ALERT', color: '#FF4444', isAlert: true },
                { time: '04:00', temp: '7.4°C', delta: '+0.6', status: '⚠ ALERT', color: '#FF4444', isAlert: true, isLive: true },
              ].map((row, i) => (
                <motion.div
                  key={i}
                  className="grid grid-cols-4 gap-2 text-xs py-2 px-2 rounded"
                  style={{
                    background: row.isAlert ? 'rgba(255,68,68,0.08)' : 'transparent',
                    border: row.isAlert ? '1px solid transparent' : 'none',
                    borderLeft: row.isAlert ? '2px solid #FF4444' : 'none',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <span style={{ color: row.isLive ? row.color : '#8B949E' }}>
                    {row.isLive && <span className="pulse-dot inline-block w-1 h-1 rounded-full mr-1" style={{ background: row.color }} />}
                    {row.time}
                  </span>
                  <span style={{ color: row.isAlert ? row.color : '#8B949E' }}>{row.temp}</span>
                  <span style={{ color: row.isAlert ? row.color : '#8B949E' }}>
                    {row.isAlert && row.delta.startsWith('+') && <TrendingUp className="inline w-3 h-3 mr-0.5" />}
                    {row.delta}
                  </span>
                  <span style={{ color: row.color }}>{row.status}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)', margin: '16px 0' }} />

          {/* STRATEGIST RECOMMENDATIONS */}
          <div className="mb-6">
            <div>
              <span
                className="text-xs uppercase tracking-wider"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#484F58',
                }}
              >
                STRATEGIST RECOMMENDATIONS
              </span>
              <div
                className="text-xs mt-1"
                style={{
                  color: '#8B949E',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {liveRerouteOptions.length} pre-validated options
              </div>
            </div>

            <motion.div className="space-y-2 mt-3" layout>
              {liveRerouteOptions.map((option, idx) => {
                const isSelected = selectedOptionId === option.id
                return (
                  <motion.div
                    key={option.id}
                    onClick={() => setSelectedOptionId(option.id)}
                    className="p-3.5 rounded-lg cursor-pointer"
                    style={{
                      background: isSelected ? 'rgba(88,166,255,0.06)' : 'rgba(255,255,255,0.02)',
                      border: isSelected ? '1px solid rgba(88,166,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
                      borderLeft: isSelected ? '3px solid #58A6FF' : '3px solid transparent',
                      boxShadow: isSelected ? '0 0 0 1px rgba(88,166,255,0.08), 0 0 20px rgba(88,166,255,0.08)' : 'none',
                    }}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{
                          background: isSelected ? '#58A6FF' : 'transparent',
                          border: `1px solid ${isSelected ? '#58A6FF' : 'rgba(255,255,255,0.2)'}`,
                          boxShadow: isSelected ? '0 0 8px rgba(88,166,255,0.4)' : 'none',
                        }}
                      />
                      <span
                        className="text-xs font-bold"
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          color: isSelected ? '#58A6FF' : '#8B949E',
                        }}
                      >
                        Option {idx + 1}
                      </span>
                      <div
                        className="ml-auto text-xs px-2 py-0.5 rounded"
                        style={{
                          background: option.complianceStatus === 'PASS' ? 'rgba(30,204,139,0.12)' : 'rgba(240,165,0,0.12)',
                          color: option.complianceStatus === 'PASS' ? '#1ECC8B' : '#F0A500',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 'bold',
                        }}
                      >
                        {option.complianceStatus}
                      </div>
                    </div>
                    <div
                      className="text-sm font-semibold mt-2"
                      style={{ color: '#E6EDF3', fontFamily: 'Inter, sans-serif' }}
                    >
                      {option.title}
                    </div>
                    <div
                      className="text-xs mt-1"
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        color: '#8B949E',
                      }}
                    >
                      ✈ {option.type === 'air' ? 'Air' : 'Maritime'} · {option.duration} · {option.cost}
                    </div>
                    {option.note && (
                      <div
                        className="text-xs mt-1.5"
                        style={{
                          color: '#F0A500',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        {option.note}
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </motion.div>
            {ticketLoadError && (
              <div className="text-xs mt-2" style={{ color: '#F0A500', fontFamily: 'JetBrains Mono, monospace' }}>
                {ticketLoadError}
              </div>
            )}
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)', margin: '16px 0' }} />

          {/* DIPLOMAT DRAFTS */}
          <div>
            <div>
              <span
                className="text-xs uppercase tracking-wider"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#484F58',
                }}
              >
                DIPLOMAT DRAFTS
              </span>
              <div
                className="text-xs mt-1"
                style={{
                  color: '#8B949E',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                Queued · dispatches on approval
              </div>
            </div>

            <motion.div className="space-y-1.5 mt-3" layout>
              {diplomatDrafts.map((draft) => {
                const Icon = draft.icon
                const isExpanded = expandedDraft === draft.id
                return (
                  <motion.div key={draft.id} layout>
                    <motion.div
                      onClick={() => setExpandedDraft(isExpanded ? null : draft.id)}
                      className="px-3.5 py-3 rounded-lg cursor-pointer flex items-center gap-3"
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        backdropFilter: 'blur(8px)',
                      }}
                      whileHover={{ background: 'rgba(255,255,255,0.04)' }}
                    >
                      <Icon size={14} style={{ color: '#8B949E', flexShrink: 0 }} />
                      <span style={{ color: '#E6EDF3', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                        {draft.title}
                      </span>
                      <div className="ml-auto flex items-center gap-2">
                        <div
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            background: 'rgba(240,165,0,0.12)',
                            color: '#F0A500',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontWeight: 'bold',
                          }}
                        >
                          DRAFT
                        </div>
                        <motion.div animate={{ rotate: isExpanded ? 90 : 0 }}>
                          <ChevronRight size={14} style={{ color: '#484F58' }} />
                        </motion.div>
                      </div>
                    </motion.div>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div
                            className="p-3 mt-1 rounded-lg text-xs max-h-30 overflow-y-auto"
                            style={{
                              background: 'rgba(0,0,0,0.3)',
                              border: '1px solid rgba(255,255,255,0.06)',
                              color: '#8B949E',
                              fontFamily: 'JetBrains Mono, monospace',
                              lineHeight: '1.5',
                            }}
                          >
                            {draft.content}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </motion.div>

            <div
              className="text-xs mt-3 italic text-center"
              style={{
                color: '#484F58',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              Dispatches automatically post-approval
            </div>
          </div>
        </motion.div>

        {/* CENTER PANEL */}
        <motion.div
          className="flex-1 flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          {/* MAP (60%) */}
          <div className="flex-1 relative">
            <MapComponent center={[32.35, 30.0]} zoom={5} pitch={20} />
            {/* Vignette */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at center, transparent 40%, rgba(8,11,15,0.6) 100%)',
              }}
            />
          </div>

          {/* COMPLIANCE TIMELINE (40%) */}
          <div
            className="overflow-x-auto scrollbar-thin"
            style={{
              borderTop: '1px solid rgba(88,166,255,0.08)',
              background: 'rgba(6,9,13,0.75)',
              backdropFilter: 'blur(20px)',
              padding: '12px 16px',
              height: '40%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              className="text-xs uppercase tracking-wider mb-2 flex-shrink-0"
              style={{
                color: '#484F58',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              COMPLIANCE TIMELINE
            </div>
            <motion.div
              className="flex gap-2 flex-1"
              ref={scrollRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              {complianceCards.map((card, idx) => (
                <motion.div
                  key={idx}
                  className="flex-shrink-0 p-3 rounded-lg cursor-pointer"
                  style={{
                    minWidth: '220px',
                    background: card.name.includes('Egypt') ? 'rgba(236,72,153,0.05)' : 'rgba(255,255,255,0.02)',
                    border: card.name.includes('Egypt')
                      ? '1px solid rgba(236,72,153,0.3)'
                      : '1px solid rgba(255,255,255,0.06)',
                    borderTop: card.name.includes('Egypt') ? '3px solid #EC4899' : 'none',
                    boxShadow: card.name.includes('Egypt') ? '0 0 16px rgba(236,72,153,0.1)' : 'none',
                    backdropFilter: 'blur(8px)',
                  }}
                  whileHover={{ translateY: -2, background: 'rgba(255,255,255,0.04)' }}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.06 }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{card.flag}</span>
                    <div className="flex-1">
                      <div className="text-xs font-semibold" style={{ color: '#E6EDF3', fontFamily: 'Inter, sans-serif' }}>
                        {card.name}
                      </div>
                      <div
                        className="text-xs mt-1 px-1.5 py-0.5 rounded inline-block"
                        style={{
                          background: card.badge === 'PASS' ? 'rgba(30,204,139,0.12)' : 'rgba(240,165,0,0.12)',
                          color: card.badge === 'PASS' ? '#1ECC8B' : '#F0A500',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 'bold',
                        }}
                      >
                        {card.badge}
                      </div>
                      <div
                        className="text-xs mt-2"
                        style={{
                          color: '#8B949E',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        {card.regulation}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>

        {/* RIGHT PANEL */}
        <motion.div
          className="scrollbar-thin overflow-y-auto"
          style={{
            width: '380px',
            background: 'rgba(8,11,15,0.88)',
            backdropFilter: 'blur(28px) saturate(200%)',
            borderLeft: '1px solid rgba(88,166,255,0.1)',
            padding: 0,
          }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          {/* PANEL HEADER - Sticky */}
          <div
            className="sticky top-0 z-40"
            style={{
              background: 'rgba(8,11,15,0.9)',
              backdropFilter: 'blur(16px)',
              borderBottom: '1px solid rgba(88,166,255,0.08)',
              padding: '16px 20px',
            }}
          >
            <div
              className="text-xs uppercase tracking-wider"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                color: '#58A6FF',
              }}
            >
              CRISIS RESOLUTION TICKET
            </div>
            <div className="flex items-center justify-between mt-2">
              <span
                className="text-sm"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#E6EDF3',
                }}
              >
                {`#TKT-${String(ticketData?.ticket_id || 441).padStart(4, '0')}`}
              </span>
              <div
                className="text-xs px-2 py-1 rounded"
                style={{
                  background: ticketStatus === 'APPROVED' ? 'rgba(30,204,139,0.15)' : 'rgba(240,165,0,0.15)',
                  color: ticketStatusTone,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 'bold',
                }}
              >
                {ticketStatus}
              </div>
            </div>

            {/* Spoilage Risk Meter */}
            <div className="mt-3">
              <div
                className="text-xs uppercase"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#484F58',
                }}
              >
                SPOILAGE RISK
              </div>
              <div
                className="h-1.5 rounded mt-2"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                }}
              >
                <motion.div
                  className="h-full rounded"
                  style={{
                    background: 'linear-gradient(90deg, #F0A500, #FF4444)',
                    width: '78%',
                  }}
                  initial={{ width: '0%' }}
                  animate={{ width: '78%' }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
              <div
                className="text-xs text-right mt-1"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#F0A500',
                }}
              >
                78%
              </div>
            </div>
          </div>

          {/* VOICE CALL RECORD */}
          <div className="p-3">
            <div
              className="p-3.5 rounded-lg"
              style={{
                background: 'rgba(30,204,139,0.05)',
                border: '1px solid rgba(30,204,139,0.2)',
                borderLeft: '3px solid #1ECC8B',
              }}
            >
              <div className="flex items-center gap-3">
                <Phone size={14} style={{ color: '#1ECC8B', flexShrink: 0 }} />
                <span className="text-sm font-semibold" style={{ color: '#E6EDF3', fontFamily: 'Inter, sans-serif' }}>
                  Call delivered to Dr. Aris Papadopoulos
                </span>
              </div>
              <div
                className="text-xs mt-2"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#8B949E',
                }}
              >
                02:14 AM · Duration: 1m 24s · Briefing complete
              </div>
              <motion.div
                className="mt-2 inline-block px-2.5 py-1.5 rounded cursor-pointer text-xs"
                style={{
                  background: 'rgba(88,166,255,0.08)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(88,166,255,0.2)',
                  color: '#58A6FF',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
                onClick={() => setShowTranscript(!showTranscript)}
                whileHover={{ boxShadow: '0 0 12px rgba(88,166,255,0.2)' }}
              >
                Transcript →
              </motion.div>

              {/* Transcript Panel */}
              <AnimatePresence>
                {showTranscript && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-2 overflow-hidden"
                  >
                    <div
                      className="p-3 rounded-lg text-xs max-h-45 overflow-y-auto scrollbar-thin space-y-1.5"
                      style={{
                        background: 'rgba(0,0,0,0.4)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        color: '#8B949E',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      {[
                        { speaker: 'SYSTEM', color: '#58A6FF', msg: 'Dr. Aris, this is PharmaGuard AI. Shipment SHP-2026-0441 in the Suez Canal has a critical refrigeration failure. Temperature rising at 0.5°C per hour.' },
                        { speaker: 'DR. ARIS', color: '#1ECC8B', msg: 'Yes, opening the dashboard now.' },
                        { speaker: 'SYSTEM', color: '#58A6FF', msg: 'Thank you. Approval requires your digital signature at the dashboard. Verbal confirmation is not sufficient.' },
                        { speaker: 'DR. ARIS', color: '#1ECC8B', msg: 'Understood.' },
                      ].map((line, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                        >
                          <span style={{ color: line.color, fontWeight: 'bold' }}>{line.speaker}</span>
                          <div className="mt-0.5" style={{ color: '#E6EDF3', fontFamily: 'Inter, sans-serif' }}>
                            {line.msg}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)', margin: '12px 0' }} />

          {/* COMPLIANCE ANALYSIS */}
          <div className="px-5 pb-6">
            <div
              className="text-xs uppercase tracking-wider"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                color: '#484F58',
              }}
            >
              COMPLIANCE ANALYSIS
            </div>

            <motion.div className="space-y-2 mt-4" layout>
              {complianceCards.map((card, idx) => {
                const isActive = card.name.includes('Egypt')
                const isExpanded = expandedCompliance === idx
                return (
                  <motion.div
                    key={idx}
                    onClick={() => setExpandedCompliance(isExpanded ? null : idx)}
                    className="p-4 rounded-lg cursor-pointer"
                    style={{
                      background: isActive ? 'rgba(236,72,153,0.05)' : 'rgba(255,255,255,0.02)',
                      border: isActive ? '1px solid rgba(236,72,153,0.25)' : '1px solid rgba(255,255,255,0.06)',
                      borderLeft: isActive ? '3px solid #EC4899' : 'none',
                      boxShadow: isActive ? '0 0 16px rgba(236,72,153,0.08)' : 'none',
                    }}
                    whileHover={{ background: isActive ? 'rgba(236,72,153,0.08)' : 'rgba(255,255,255,0.04)', translateX: -2 }}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06 }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg mt-1">{card.flag}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm" style={{ color: '#E6EDF3', fontFamily: 'Inter, sans-serif' }}>
                            {card.name}
                          </span>
                          <div
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{
                              background: card.badge === 'PASS' ? 'rgba(30,204,139,0.12)' : 'rgba(240,165,0,0.12)',
                              color: card.badge === 'PASS' ? '#1ECC8B' : '#F0A500',
                              fontFamily: 'JetBrains Mono, monospace',
                              fontWeight: 'bold',
                            }}
                          >
                            {card.badge}
                          </div>
                        </div>
                        <div
                          className="text-xs mt-1"
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            color: '#484F58',
                            textTransform: 'uppercase',
                          }}
                        >
                          {card.type}
                        </div>
                        <div
                          className="text-xs mt-2"
                          style={{
                            color: '#8B949E',
                            fontFamily: 'JetBrains Mono, monospace',
                          }}
                        >
                          {card.regulation}
                        </div>
                        <motion.div
                          initial={{ height: 'auto', opacity: 1 }}
                          animate={{ height: isExpanded ? 'auto' : 'auto', opacity: 1 }}
                          className={`text-xs mt-2 ${isExpanded ? '' : 'line-clamp-2'}`}
                          style={{
                            color: '#E6EDF3',
                            fontFamily: 'Inter, sans-serif',
                            lineHeight: '1.5',
                          }}
                        >
                          {card.clause}
                        </motion.div>
                        {card.warning && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-2 flex items-start gap-2 p-2 rounded"
                            style={{
                              background: 'rgba(240,165,0,0.08)',
                              border: '1px solid rgba(240,165,0,0.2)',
                            }}
                          >
                            <AlertTriangle size={12} style={{ color: '#F0A500', marginTop: '2px', flexShrink: 0 }} />
                            <span
                              className="text-xs"
                              style={{
                                color: '#F0A500',
                                fontFamily: 'JetBrains Mono, monospace',
                              }}
                            >
                              {card.warning}
                            </span>
                          </motion.div>
                        )}
                        <div
                          className="text-xs mt-2 cursor-pointer hover:underline"
                          style={{
                            color: '#58A6FF',
                            fontFamily: 'JetBrains Mono, monospace',
                          }}
                        >
                          {card.citation}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>

            {/* Sidebar Footer */}
            <div
              className="text-xs text-center mt-6 italic"
              style={{
                color: '#484F58',
              }}
            >
              All compliance data advisory · Not legal advice
            </div>
            <div className="flex items-center gap-2 mt-3 justify-center">
              <span
                className="text-xs"
                style={{
                  color: '#484F58',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                RAG Confidence:
              </span>
              <div
                className="h-1.5 w-16 rounded"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                }}
              >
                <div
                  className="h-full rounded"
                  style={{
                    background: '#1ECC8B',
                    width: '87%',
                  }}
                />
              </div>
              <span
                className="text-xs"
                style={{
                  color: '#1ECC8B',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                87%
              </span>
            </div>
            <div
              className="text-xs text-center mt-2"
              style={{
                color: '#484F58',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              Pinecone Vector DB · BGE-M3 Embeddings
            </div>
          </div>
        </motion.div>
      </div>

      {/* BOTTOM ACTION BAR */}
      <motion.div
        className="sticky bottom-0 z-50 flex items-center justify-between px-6"
        style={{
          height: '64px',
          background: 'rgba(8,11,15,0.95)',
          backdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.5), 0 -1px 0 rgba(88,166,255,0.06)',
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        {/* Left Side - Summary Chips */}
        <div className="flex items-center gap-4">
          {/* Shipment Chip */}
          <div
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Package size={12} style={{ color: '#8B949E' }} />
            <span
              className="text-xs"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                color: '#E6EDF3',
              }}
            >
              {ticketData?.shipment_id || 'SHP-2026-0441'}
            </span>
          </div>

          {/* Option Chip */}
          <AnimatePresence>
            {selectedOption && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg"
                style={{
                  background: 'rgba(88,166,255,0.08)',
                  border: '1px solid rgba(88,166,255,0.2)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Navigation size={12} style={{ color: '#58A6FF' }} />
                <span
                  className="text-xs"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    color: '#58A6FF',
                  }}
                >
                  {selectedOption.title}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side - Buttons */}
        <div className="flex items-center gap-3">
          {/* View Actions Button */}
          <motion.button
            onClick={() => setShowCascadePanel(true)}
            className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2"
            style={{
              background: 'rgba(88,166,255,0.08)',
              border: '1px solid rgba(88,166,255,0.2)',
              backdropFilter: 'blur(8px)',
              color: '#58A6FF',
              fontFamily: 'Inter, sans-serif',
            }}
            whileHover={{ background: 'rgba(88,166,255,0.12)', boxShadow: '0 0 12px rgba(88,166,255,0.15)' }}
          >
            <Workflow size={12} />
            View Actions
          </motion.button>

          {/* Reject Button */}
          {userRole !== 'logistics_planner' && (
            <div className="relative">
              <motion.button
                onClick={() => setShowRejectionDropdown(!showRejectionDropdown)}
                className="px-4 py-2.5 rounded-lg text-xs font-semibold uppercase"
                style={{
                  background: 'rgba(255,68,68,0.06)',
                  border: '1px solid rgba(255,68,68,0.3)',
                  backdropFilter: 'blur(8px)',
                  color: '#FF4444',
                  fontFamily: 'Inter, sans-serif',
                  cursor: 'pointer',
                  minWidth: '120px',
                }}
                whileHover={{
                  background: 'rgba(255,68,68,0.1)',
                  boxShadow: '0 0 12px rgba(255,68,68,0.15)',
                }}
              >
                Reject ▾
              </motion.button>

              {/* Rejection Dropdown */}
              <AnimatePresence>
                {showRejectionDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute bottom-full right-0 mb-2 w-56 rounded-lg overflow-hidden"
                    style={{
                      background: 'rgba(13,17,23,0.95)',
                      backdropFilter: 'blur(16px)',
                      border: '1px solid rgba(255,68,68,0.2)',
                    }}
                  >
                    {[
                      'Regulatory concern not addressed',
                      'Insufficient cold-storage guarantee',
                      'Incorrect jurisdiction identified',
                      'Requires legal review',
                      'Other',
                    ].map((reason) => (
                      <motion.button
                        key={reason}
                        onClick={() => {
                          handleReject(reason)
                          setShowRejectionDropdown(false)
                        }}
                        className="w-full px-4 py-2.25 text-xs text-left"
                        style={{
                          color: '#E6EDF3',
                          fontFamily: 'Inter, sans-serif',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        whileHover={{ background: 'rgba(255,68,68,0.06)' }}
                      >
                        {reason}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* View Actions Button */}
          <motion.button
            onClick={() => setShowCascadePanel(true)}
            className="px-4 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2"
            style={{
              background: 'rgba(88,166,255,0.1)',
              border: '1px solid rgba(88,166,255,0.25)',
              color: '#58A6FF',
              fontFamily: 'Inter, sans-serif',
            }}
            whileHover={{ boxShadow: '0 0 16px rgba(88,166,255,0.2)' }}
          >
            <ExternalLink size={14} />
            View Actions
          </motion.button>

          {/* Approve Button or Approval Confirmation */}
          {userRole !== 'logistics_planner' && (
            <>
              {isApproved ? (
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg"
                  style={{
                    background: 'rgba(30,204,139,0.08)',
                    border: '1px solid rgba(30,204,139,0.2)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <div
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: '#1ECC8B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ color: '#000', fontSize: '10px', fontWeight: 'bold' }}>✓</span>
                  </div>
                  <div className="flex flex-col">
                    <span
                      className="text-xs font-medium"
                      style={{
                        color: '#1ECC8B',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      Approved — Dr. Aris Papadopoulos
                    </span>
                    {approvedAt && (
                      <span
                        className="text-[10px]"
                        style={{
                          color: '#8B949E',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        {new Date(approvedAt).toLocaleTimeString('en-US', { hour12: false })} UTC
                      </span>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  onClick={handleApprove}
                  disabled={!selectedOptionId}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold uppercase"
                  style={{
                    background: selectedOptionId ? '#1ECC8B' : 'rgba(30,204,139,0.3)',
                    color: selectedOptionId ? '#000' : '#8B949E',
                    fontFamily: 'Inter, sans-serif',
                    cursor: selectedOptionId ? 'pointer' : 'not-allowed',
                    fontWeight: 700,
                  }}
                  whileHover={selectedOptionId ? { boxShadow: '0 0 20px rgba(30,204,139,0.3)' } : {}}
                >
                  Approve & Sign
                </motion.button>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* Dev Simulator Dropdown (bottom-left) */}
      <div className="fixed bottom-24 left-6 z-50">
        <motion.button
          onClick={() => setShowDevSimulator(!showDevSimulator)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#8B949E',
            fontFamily: 'JetBrains Mono, monospace',
          }}
          whileHover={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <Bug size={14} />
          Dev States
        </motion.button>
        <AnimatePresence>
          {showDevSimulator && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-full left-0 mb-2 w-48 rounded-lg overflow-hidden"
              style={{
                background: 'rgba(13,17,23,0.95)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {[
                { id: 'normal', label: 'Normal' },
                { id: 'no_route', label: 'No Compliant Route' },
                { id: 'incomplete_drafts', label: 'Incomplete Drafts' },
                { id: 'session_expired', label: 'Session Expired' },
                { id: 'compliance_recheck', label: 'Compliance Recheck' },
                { id: 'dual_approval', label: 'Dual Approval' },
                { id: 'call_failed', label: 'Call Failed' },
                { id: 'feed_lost', label: 'Feed Lost' },
              ].map((state) => (
                <button
                  key={state.id}
                  onClick={() => {
                    setEdgeState(state.id as EdgeState)
                    setShowDevSimulator(false)
                  }}
                  className="w-full px-4 py-2 text-xs text-left hover:bg-white/5"
                  style={{
                    color: edgeState === state.id ? '#58A6FF' : '#E6EDF3',
                    fontFamily: 'Inter, sans-serif',
                    background: edgeState === state.id ? 'rgba(88,166,255,0.1)' : 'transparent',
                  }}
                >
                  {state.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

            {/* Edge State Overlays */}
      {edgeState === 'no_route' && (
        <NoCompliantRouteState onManualOverride={() => setEdgeState('normal')} />
      )}
      {edgeState === 'incomplete_drafts' && (
        <IncompleteDraftsWarning failedDrafts={['Hospital Email', 'ERP Update']} />
      )}
      {edgeState === 'session_expired' && (
        <SessionExpiredOverlay
          onReAuthenticate={() => setEdgeState('normal')}
          ticketId={`TKT-${String(ticketData?.ticket_id || 441).padStart(4, '0')}`}
        />
      )}
      {edgeState === 'compliance_recheck' && (
        <ComplianceRecheckWarning
          changedJurisdictions={['Egypt (Suez)', 'UAE Transit']}
          onDismiss={() => setEdgeState('normal')}
        />
      )}
      {edgeState === 'dual_approval' && (
        <DualApprovalBlocker
          approvedBy="Dr. Chen"
          approvedAt="02:14 AM"
          onViewAuditLog={() => setEdgeState('normal')}
          onReturnToDashboard={() => setEdgeState('normal')}
        />
      )}
      {edgeState === 'call_failed' && (
        <div className="fixed top-[120px] right-6 z-40">
          <ElevenLabsCallFailed onRetryCall={() => setEdgeState('normal')} />
        </div>
      )}
      {edgeState === 'feed_lost' && (
        <FeedLostCrisisBanner shipmentId={ticketData?.shipment_id || 'SHP-2026-0441'} lastSignalTime="47m ago" />
      )}

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        selectedOption={selectedOption ? {
          title: selectedOption.title,
          type: selectedOption.type === 'maritime' ? 'maritime' : 'air',
          duration: selectedOption.duration,
          cost: selectedOption.cost,
          complianceStatus: selectedOption.complianceStatus === 'PASS' ? 'PASS' : 'CRISIS',
        } : { title: '', type: 'air', duration: '', cost: '', complianceStatus: 'PASS' }}
        onApprove={handleSignatureApprove}
        onClose={() => {
          setIsSignatureModalOpen(false)
          setSignatureModalState('idle')
        }}
      />
      {/* Cascade Actions Panel */}
      <CascadeActionsPanel
        isOpen={showCascadePanel}
        onClose={() => setShowCascadePanel(false)}
        ticketId="TKT-2026-0441"
        shipmentId="SHP-2026-0441"
        isApproved={isApproved}
        approvedAt={approvedAt}
        approvedBy="Dr. Aris Papadopoulos"
      />
    </div>
  )
}








