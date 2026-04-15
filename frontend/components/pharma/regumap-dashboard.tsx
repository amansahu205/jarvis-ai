'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useRef } from 'react'
import { LocationSearch, type LocationResult } from '@/components/LocationSearch'
import {
  analyzeRoute,
  spatialCheck,
  complianceCheck,
  fetchRouteGeometry,
  getLatestTelemetry,
  ApiError,
} from '@/lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin,
  ArrowDownUp,
  Zap,
  Map as MapIcon,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
  XCircle,
  ExternalLink,
} from 'lucide-react'

// Dynamic map import to prevent SSR issues
const MapComponent = dynamic(() => import('./map-component'), {
  ssr: false,
  loading: () => <div className="w-full h-screen bg-[#080B0F]" />,
})

interface ComplianceCard {
  id: string
  jurisdiction: string
  label: 'ORIGIN' | 'TRANSIT' | 'DESTINATION' | 'INTERNATIONAL WATERS'
  emoji: string
  regulation: string
  clause: string
  citation: string
  badge: 'PASS' | 'FLAG' | 'BLOCK'
  flagDetail?: string
  expanded?: boolean
}

const complianceCards: ComplianceCard[] = [
  {
    id: 'india',
    jurisdiction: 'India — Origin Country',
    label: 'ORIGIN',
    emoji: '🇮🇳',
    regulation: 'CDSCO Schedule M · WHO-GDP Annex 9',
    clause:
      'Temperature-sensitive pharmaceutical products must maintain cold chain documentation from point of manufacture. Export clearance requires Form 40 and temperature monitoring certificates.',
    citation: 'View: CDSCO Schedule M (2023) ↗',
    badge: 'PASS',
  },
  {
    id: 'arabian-sea',
    jurisdiction: 'Arabian Sea — International Waters',
    label: 'INTERNATIONAL WATERS',
    emoji: '🌊',
    regulation: 'IMO MARPOL Annex II · WHO Cold Chain Baseline',
    clause:
      'Pharmaceutical cargo in international waters falls under flag state regulations and WHO Good Distribution Practice. No specific port authority approvals required during transit. WHO TRS 961 temperature monitoring applies.',
    citation: 'View: WHO TRS 961 Annex 9 ↗',
    badge: 'PASS',
  },
  {
    id: 'egypt',
    jurisdiction: 'Egypt — Suez Canal Transit',
    label: 'TRANSIT JURISDICTION',
    emoji: '🇪🇬',
    regulation: 'Egyptian Drug Authority Resolution 442 · MOHP Cold Chain Directive',
    clause:
      'Pharmaceutical transit through Egyptian territorial waters requires pre-notification to Egyptian Drug Authority (EDA) minimum 72 hours prior to vessel entry. Cold chain documentation must include WHO-certified temperature logs. Emergency staging permitted at Port Said Maersk facility under EDA Resolution 442-2023 Article 9.',
    citation: 'View: EDA Resolution 442-2023 ↗',
    badge: 'FLAG',
    flagDetail: '⚠ 72-hour pre-notification required · EDA Article 9',
  },
  {
    id: 'usa',
    jurisdiction: 'United States — Destination',
    label: 'DESTINATION COUNTRY',
    emoji: '🇺🇸',
    regulation: 'FDA 21 CFR Part 211 · USP <1079> Cold Chain',
    clause:
      'Import of biological products and vaccines requires FDA Form 2877 (Notice of Importation). Temperature excursion reports must be filed within 24 hours of detection. USP Chapter 1079 compliance required for all biological cold-chain shipments.',
    citation: 'View: FDA 21 CFR Part 211 ↗',
    badge: 'PASS',
  },
]

export function ReguMapDashboard() {
  const [origin, setOrigin] = useState({ code: 'BOM', label: 'BOM — Chhatrapati Shivaji, Mumbai' })
  const [destination, setDestination] = useState({ code: 'JFK', label: 'JFK — John F. Kennedy, New York' })
  const [transitMode, setTransitMode] = useState<'air' | 'maritime'>('maritime')
  const [cargoType, setCargoType] = useState('vaccine')
  const [analysisState, setAnalysisState] = useState<'idle' | 'loading' | 'complete'>('idle')
  const [activeJurisdiction, setActiveJurisdiction] = useState<string | null>(null)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [cards, setCards] = useState<ComplianceCard[]>(complianceCards)
  const [routeStats, setRouteStats] = useState(['~22.4h transit', '4 jurisdictions', 'MARITIME'])
  const [riskCounts, setRiskCounts] = useState({ pass: 3, flag: 1, block: 0 })
  const [routeLabel, setRouteLabel] = useState('BOM → JFK · Maritime · ~22.4h · Suez Canal route')
  const [apiWaypoints, setApiWaypoints] = useState<[number, number][]>([])
  const [routeGeometry, setRouteGeometry] = useState<GeoJSON.Geometry | null>(null)
  const [isCrisis, setIsCrisis] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const refreshTelemetry = async () => {
      try {
        const latest = await getLatestTelemetry()
        if (cancelled) return
        const crisis = latest.temp_excursion || latest.alert_flag || latest.status === 'ALERT'
        setIsCrisis(crisis)
      } catch {
        if (!cancelled) setIsCrisis(false)
      }
    }

    void refreshTelemetry()
    const interval = setInterval(() => {
      void refreshTelemetry()
    }, 15000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const handleSwap = () => {
    const temp = origin
    setOrigin(destination)
    setDestination(temp)
  }

  const handleAnalyze = async () => {
    setAnalysisState('loading')
    setAnalyzeError(null)
    try {
      const originCode = origin.code
      const destCode = destination.code

      const route = await analyzeRoute(originCode, destCode, transitMode, cargoType)
      setApiWaypoints(route.waypoints)

      const geometry = await fetchRouteGeometry({
        origin: originCode,
        destination: destCode,
        transit_mode: transitMode,
        waypoints: route.waypoints,
      })
      setRouteGeometry(geometry.geometry)

      const spatial = await spatialCheck(originCode, destCode, transitMode, route.waypoints)
      const compliance = await complianceCheck(spatial.jurisdictions)

      const newCards: ComplianceCard[] = compliance.jurisdictions.map((jx) => ({
        id: jx.id,
        jurisdiction: `${jx.name}`,
        label: jx.type as ComplianceCard['label'],
        emoji: jx.flag,
        regulation: jx.regulation,
        clause: jx.clause,
        citation: jx.citation_url ? `View: ${jx.citation} ↗` : jx.citation,
        badge: jx.badge,
        flagDetail: jx.warning ?? undefined,
      }))
      setCards(newCards)
      if (newCards[0]) setActiveJurisdiction(newCards[0].id)

      const pass = compliance.jurisdictions.filter((j) => j.badge === 'PASS').length
      const flag = compliance.jurisdictions.filter((j) => j.badge === 'FLAG').length
      const block = compliance.jurisdictions.filter((j) => j.badge === 'BLOCK').length
      setRiskCounts({ pass, flag, block })
      setRouteStats([
        `~${route.transit_time_hours}h transit`,
        `${compliance.jurisdictions.length} jurisdictions`,
        route.mode.toUpperCase(),
      ])
      setRouteLabel(`${originCode} → ${destCode} · ${route.mode} · ~${route.transit_time_hours}h`)

      setAnalysisState('complete')
    } catch (err) {
      setAnalyzeError(err instanceof ApiError ? err.message : 'Analysis failed. Is the backend running?')
      setRouteGeometry(null)
      setAnalysisState('idle')
    }
  }

  const toggleCardExpand = (id: string) => {
    setExpandedCard(expandedCard === id ? null : id)
  }

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: '#080B0F' }}>
      {/* Map */}
      <div className="w-full h-screen">
        <MapComponent
          waypoints={apiWaypoints}
          routeGeometry={routeGeometry}
          transitMode={transitMode}
          isCrisis={isCrisis}
        />
      </div>

      {/* Route Planner Panel (Top Left) */}
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 100, delay: 0.2 }}
        className="absolute top-16 left-4 w-80 z-30"
        style={{
          background: 'rgba(8,11,15,0.85)',
          backdropFilter: 'blur(28px)',
          border: '1px solid rgba(88,166,255,0.2)',
          borderRadius: '16px',
          boxShadow:
            '0 0 0 1px rgba(88,166,255,0.05), 0 8px 40px rgba(0,0,0,0.7), 0 0 60px rgba(88,166,255,0.06)',
          padding: '20px',
        }}
      >
        {/* Top shimmer */}
        <div
          className="absolute top-0 left-1/4 h-px"
          style={{
            width: '50%',
            background: 'linear-gradient(90deg, transparent, rgba(88,166,255,0.7), transparent)',
            borderRadius: '16px 16px 0 0',
          }}
        />

        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-6 h-6"
            style={{
              background: '#58A6FF',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            }}
          />
          <div>
            <div className="text-sm font-semibold text-[#E6EDF3]">ReguMap AI</div>
            <div className="text-xs text-[#8B949E]">Geospatial compliance engine</div>
          </div>
          <span
            className="ml-auto text-xs px-2 py-1 rounded"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(88,166,255,0.2)',
              color: '#58A6FF',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            v1.1
          </span>
        </div>

        {/* Origin Input */}
        <div className="mb-4">
          <label className="text-xs font-mono text-[#484F58] uppercase tracking-wider block mb-2">
            Origin
          </label>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ background: transitMode === 'maritime' ? '#1ECC8B' : '#58A6FF' }}
            />
            <div className="flex-1">
              <LocationSearch
                mode={transitMode === 'maritime' ? 'maritime' : 'air'}
                defaultValue={origin.label}
                onSelect={(loc: LocationResult) =>
                  setOrigin({ code: loc.code, label: `${loc.code} — ${loc.label}` })
                }
                inputStyle={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                }}
              />
            </div>
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center mb-4">
          <button
            onClick={handleSwap}
            className="p-2 rounded-full transition-all hover:rotate-180 hover:text-[#58A6FF]"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#8B949E',
            }}
          >
            <ArrowDownUp size={16} />
          </button>
        </div>

        {/* Destination Input */}
        <div className="mb-4">
          <label className="text-xs font-mono text-[#484F58] uppercase tracking-wider block mb-2">
            Destination
          </label>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: '#1ECC8B' }} />
            <div className="flex-1">
              <LocationSearch
                mode={transitMode === 'maritime' ? 'maritime' : 'air'}
                defaultValue={destination.label}
                onSelect={(loc: LocationResult) =>
                  setDestination({ code: loc.code, label: `${loc.code} — ${loc.label}` })
                }
                inputStyle={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                }}
              />
            </div>
          </div>
        </div>

        {/* Transit Mode */}
        <div className="mb-4">
          <label className="text-xs font-mono text-[#484F58] uppercase tracking-wider block mb-2">
            Transit Mode
          </label>
          <div
            className="grid grid-cols-2 gap-2 p-1 rounded-xl"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {[
              { id: 'air', label: '✈ Air Freight', color: '#58A6FF', activeBg: 'rgba(88,166,255,0.2)' },
              { id: 'maritime', label: '⛵ Maritime', color: '#1ECC8B', activeBg: 'rgba(30,204,139,0.2)' },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setTransitMode(mode.id as 'air' | 'maritime')}
                className="py-2 px-3 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: transitMode === mode.id ? mode.activeBg : 'transparent',
                  border: transitMode === mode.id ? `1px solid ${mode.color}` : 'none',
                  color: transitMode === mode.id ? mode.color : '#484F58',
                  boxShadow: transitMode === mode.id ? `0 0 12px ${mode.color}40` : 'none',
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cargo Type */}
        <div className="mb-4">
          <label className="text-xs font-mono text-[#484F58] uppercase tracking-wider block mb-2">
            Cargo Type
          </label>
          <div className="flex gap-2">
            {['vaccine', 'biologic', 'drug'].map((type) => (
              <button
                key={type}
                onClick={() => setCargoType(type)}
                className="px-3 py-1.5 rounded text-xs font-semibold capitalize transition-all"
                style={{
                  background: cargoType === type ? 'rgba(88,166,255,0.15)' : 'rgba(255,255,255,0.03)',
                  border: cargoType === type ? '1px solid #58A6FF' : '1px solid rgba(255,255,255,0.05)',
                  color: cargoType === type ? '#58A6FF' : '#484F58',
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Analyze Button */}
        <motion.button
          onClick={handleAnalyze}
          whileHover={{ translateY: -2 }}
          className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all"
          style={{
            background:
              transitMode === 'maritime'
                ? 'linear-gradient(135deg, rgba(30,204,139,0.85), rgba(20,120,75,0.85))'
                : 'linear-gradient(135deg, rgba(88,166,255,0.85), rgba(50,100,200,0.85))',
            border: `1px solid rgba(${transitMode === 'maritime' ? '30,204,139' : '88,166,255'},0.5)`,
            boxShadow: `0 0 20px rgba(${transitMode === 'maritime' ? '30,204,139' : '88,166,255'},0.25), inset 0 1px 0 rgba(255,255,255,0.1)`,
            opacity: analysisState === 'loading' ? 0.7 : 1,
          }}
          disabled={analysisState === 'loading'}
        >
          {analysisState === 'loading' && <Zap size={16} className="animate-spin" />}
          <span className="text-sm font-mono">
            {analysisState === 'loading'
              ? 'Generating route...'
              : analysisState === 'complete'
                ? 'Route analyzed ✓'
                : 'Analyze Compliance Route'}
          </span>
        </motion.button>

        {/* Error */}
        {analyzeError && (
          <div className="mt-3 px-3 py-2 rounded-lg text-xs font-mono"
            style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.25)', color: '#FF6B6B' }}>
            {analyzeError}
          </div>
        )}

        {/* Route Stats */}
        {analysisState === 'complete' && (
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex gap-2 mt-4"
          >
            {routeStats.map((stat, i) => (
              <motion.span
                key={stat}
                initial={{ x: -8, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.06 }}
                className="text-xs px-2.5 py-1.5 rounded font-mono"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: '#8B949E',
                }}
              >
                {stat}
              </motion.span>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Compliance Timeline Sidebar (Right) */}
      {analysisState !== 'idle' && (
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 100, delay: 0.3 }}
          className="absolute right-0 top-12 w-96 h-[calc(100vh-48px)] z-20 overflow-y-auto"
          style={{
            background: 'rgba(8,11,15,0.88)',
            backdropFilter: 'blur(28px)',
            borderLeft: '1px solid rgba(88,166,255,0.12)',
            boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
          }}
        >
          {/* Sidebar Header */}
          <div
            className="sticky top-0 p-5 border-b"
            style={{
              borderColor: 'rgba(88,166,255,0.1)',
              background: 'rgba(8,11,15,0.9)',
              backdropFilter: 'blur(28px)',
            }}
          >
            <div className="font-mono text-xs text-[#8B949E] uppercase tracking-wider mb-2">
              Compliance Timeline
            </div>
            <div
              className="p-3 rounded-lg text-xs font-mono mb-3"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#8B949E',
              }}
            >
              {routeLabel}
            </div>
            <div
              className="text-xs px-3 py-1 rounded-lg font-mono text-[#58A6FF]"
              style={{
                background: 'rgba(88,166,255,0.08)',
                border: '1px solid rgba(88,166,255,0.2)',
                width: 'fit-content',
              }}
            >
              {cards.length} jurisdictions
            </div>
          </div>

          {/* Compliance Cards */}
          <div className="p-3">
            {cards.map((card, idx) => (
              <motion.div
                key={card.id}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.06 }}
                onClick={() => setActiveJurisdiction(card.id)}
                className="p-4 rounded-lg mb-3 cursor-pointer transition-all"
                style={{
                  background: activeJurisdiction === card.id ? 'rgba(236,72,153,0.05)' : 'rgba(255,255,255,0.02)',
                  border:
                    activeJurisdiction === card.id
                      ? '1px solid rgba(236,72,153,0.25)'
                      : '1px solid rgba(255,255,255,0.06)',
                  borderLeft: activeJurisdiction === card.id ? '3px solid #EC4899' : 'none',
                  boxShadow:
                    activeJurisdiction === card.id
                      ? '0 0 0 1px rgba(236,72,153,0.1), 0 4px 20px rgba(236,72,153,0.1)'
                      : 'none',
                }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{card.emoji}</span>
                    <div>
                      <div className="font-semibold text-sm text-[#E6EDF3]">{card.jurisdiction}</div>
                      <div className="text-xs font-mono text-[#484F58] uppercase">{card.label}</div>
                    </div>
                  </div>
                  {activeJurisdiction === card.id && (
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#EC4899' }} />
                  )}
                </div>

                {/* Badge */}
                <div
                  className="inline-block text-xs px-2 py-1 rounded font-mono mb-2"
                  style={{
                    background:
                      card.badge === 'PASS'
                        ? 'rgba(30,204,139,0.12)'
                        : card.badge === 'FLAG'
                          ? 'rgba(240,165,0,0.12)'
                          : 'rgba(255,68,68,0.12)',
                    color:
                      card.badge === 'PASS' ? '#1ECC8B' : card.badge === 'FLAG' ? '#F0A500' : '#FF4444',
                    border:
                      card.badge === 'PASS'
                        ? '1px solid rgba(30,204,139,0.3)'
                        : card.badge === 'FLAG'
                          ? '1px solid rgba(240,165,0,0.3)'
                          : '1px solid rgba(255,68,68,0.3)',
                  }}
                >
                  {card.badge}
                </div>

                {/* Regulation */}
                <div className="font-mono text-xs text-[#8B949E] mb-2">{card.regulation}</div>

                {/* Clause */}
                <motion.div
                  initial={{ height: 'auto' }}
                  animate={{
                    height: expandedCard === card.id ? 'auto' : '2.4em',
                  }}
                  className="overflow-hidden mb-2"
                >
                  <p className="text-xs leading-relaxed text-[#E6EDF3] line-clamp-2">{card.clause}</p>
                </motion.div>

                {/* Expand Toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleCardExpand(card.id)
                  }}
                  className="text-xs font-mono text-[#58A6FF] hover:text-[#1ECC8B] transition-colors mb-2"
                >
                  {expandedCard === card.id ? '▴ Collapse' : '▾ Show full text'}
                </button>

                {/* Flag Detail */}
                {card.flagDetail && (
                  <div
                    className="p-2 rounded text-xs font-mono mb-2"
                    style={{
                      background: 'rgba(240,165,0,0.08)',
                      border: '1px solid rgba(240,165,0,0.2)',
                      color: '#F0A500',
                    }}
                  >
                    {card.flagDetail}
                  </div>
                )}

                {/* Citation */}
                <a
                  href="#"
                  className="text-xs font-mono text-[#58A6FF] hover:underline hover:glow transition-all flex items-center gap-1"
                >
                  {card.citation}
                  <ExternalLink size={10} />
                </a>
              </motion.div>
            ))}
          </div>

          {/* Sidebar Footer */}
          <div
            className="sticky bottom-0 p-4 border-t text-center"
            style={{
              borderColor: 'rgba(255,255,255,0.05)',
              background: 'rgba(8,11,15,0.7)',
              backdropFilter: 'blur(28px)',
            }}
          >
            <div className="text-xs text-[#484F58] italic mb-3">
              All compliance data is advisory · Not legal advice
            </div>
            <div className="flex items-center justify-center gap-3 mb-3">
              <span className="text-xs text-[#484F58]">RAG Confidence:</span>
              <div className="w-16 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    background: '#1ECC8B',
                    width: '87%',
                  }}
                />
              </div>
              <span className="text-xs font-mono text-[#1ECC8B]">87%</span>
            </div>
            <div className="text-xs text-[#484F58] font-mono">
              Pinecone Vector DB · BGE-M3 Embeddings
            </div>
          </div>
        </motion.div>
      )}

      {/* Risk Summary Bar (Bottom) */}
      {analysisState === 'complete' && (
        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="absolute bottom-4 left-80 right-96 z-20 px-5 py-2.5 rounded-xl flex items-center gap-6"
          style={{
            background: 'rgba(8,11,15,0.85)',
            backdropFilter: 'blur(28px)',
            border: '1px solid rgba(88,166,255,0.12)',
          }}
        >
          <span className="text-xs font-mono text-[#484F58] uppercase tracking-wider">
            Route Risk Assessment
          </span>
          <div className="flex gap-4">
            {[
              { label: `${riskCounts.pass} PASS`, color: '#1ECC8B', bg: 'rgba(30,204,139,0.1)' },
              { label: `${riskCounts.flag} FLAG`, color: riskCounts.flag > 0 ? '#F0A500' : '#484F58', bg: riskCounts.flag > 0 ? 'rgba(240,165,0,0.1)' : 'rgba(72,79,88,0.1)' },
              { label: `${riskCounts.block} BLOCK`, color: riskCounts.block > 0 ? '#FF4444' : '#484F58', bg: riskCounts.block > 0 ? 'rgba(255,68,68,0.1)' : 'rgba(72,79,88,0.1)' },
            ].map((item) => (
              <span
                key={item.label}
                className="text-xs font-mono px-3 py-1 rounded"
                style={{
                  background: item.bg,
                  color: item.color,
                }}
              >
                {item.label}
              </span>
            ))}
          </div>
          <span className="ml-auto text-xs text-[#1ECC8B]">Ready for RP approval</span>
        </motion.div>
      )}
    </div>
  )
}
