'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import maplibregl from 'maplibre-gl'
import { AlertTriangle, X, MapPin } from 'lucide-react'
import 'maplibre-gl/dist/maplibre-gl.css'

interface RouteWaypoint {
  lng: number
  lat: number
}

interface Shipment {
  id: string
  status: 'critical' | 'warning' | 'normal' | 'feed_lost'
  originCity: string
  originCoords: [number, number]
  destCity: string
  destCoords: [number, number]
  currentPos: [number, number] | null
  routeWaypoints: [number, number][]
  completedWaypointIndex: number
  temperature: number
  humidity: string
  shock: string
  speed: string
  eta: string
  etaDelayed: boolean
  cargo: string
}

const shipments: Shipment[] = [
  {
    id: 'SHP-2026-0441',
    status: 'critical',
    originCity: 'Mumbai, India',
    originCoords: [72.8777, 19.076],
    destCity: 'New York, USA',
    destCoords: [-74.006, 40.7128],
    currentPos: [32.35, 30.0],
    routeWaypoints: [
      [72.8, 19.0],
      [58.5, 20.0],
      [43.5, 12.8],
      [32.35, 30.0],
      [32.35, 31.2],
      [15.0, 36.0],
      [-5.0, 36.5],
      [-40.0, 40.0],
      [-74.0, 40.7],
    ],
    completedWaypointIndex: 3,
    temperature: 7.4,
    humidity: '62%',
    shock: '0.3G',
    speed: '12.4 kn',
    eta: '14h 22m',
    etaDelayed: true,
    cargo: 'MMR Vaccines',
  },
  {
    id: 'SHP-2026-0438',
    status: 'warning',
    originCity: 'Frankfurt, Germany',
    originCoords: [8.68, 50.1],
    destCity: 'Singapore',
    destCoords: [103.8, 1.35],
    currentPos: [50.1, 8.68],
    routeWaypoints: [[8.68, 50.1], [25.0, 40.0], [32.0, 28.0], [45.0, 15.0], [63.0, 25.0], [80.0, 15.0], [103.8, 1.35]],
    completedWaypointIndex: 0,
    temperature: 4.2,
    humidity: '58%',
    shock: '0.1G',
    speed: 'Held',
    eta: '6h 14m',
    etaDelayed: true,
    cargo: 'Specialty Drugs',
  },
  {
    id: 'SHP-2026-0435',
    status: 'normal',
    originCity: 'London, UK',
    originCoords: [-0.1276, 51.5074],
    destCity: 'Johannesburg, SA',
    destCoords: [28.05, -26.2],
    currentPos: [8.0, 22.0],
    routeWaypoints: [[-0.1276, 51.5], [-5.0, 40.0], [-10.0, 30.0], [-8.0, 20.0], [8.0, 22.0], [10.0, 10.0], [15.0, -5.0], [28.05, -26.2]],
    completedWaypointIndex: 4,
    temperature: 4.8,
    humidity: '65%',
    shock: '0.2G',
    speed: '11.8 kn',
    eta: '18h 30m',
    etaDelayed: false,
    cargo: 'Oncology Biologics',
  },
  {
    id: 'SHP-2026-0431',
    status: 'feed_lost',
    originCity: 'Chicago, USA',
    originCoords: [-87.9, 41.97],
    destCity: 'Tokyo, Japan',
    destCoords: [139.69, 35.68],
    currentPos: [-87.9, 41.97],
    routeWaypoints: [[-87.9, 41.97], [-122.0, 37.0], [-150.0, 45.0], [170.0, 50.0], [150.0, 45.0], [139.69, 35.68]],
    completedWaypointIndex: 0,
    temperature: 0,
    humidity: 'N/A',
    shock: 'N/A',
    speed: 'Unknown',
    eta: 'Unknown',
    etaDelayed: true,
    cargo: 'mRNA Vaccines',
  },
]

interface InfoPopup {
  shipmentId: string
  position: [number, number]
}

export function LiveTrackerPage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null)
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null)

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: 'carto-background',
            type: 'raster',
            source: 'carto-dark',
          },
        ],
      },
      center: [20, 20],
      zoom: 2.5,
      pitch: 20,
      attributionControl: false,
    })

    // Add routes and markers for each shipment
    map.current.on('load', () => {
      if (!map.current) return

      shipments.forEach((shipment) => {
        // Add route source
        map.current!.addSource(`route-${shipment.id}`, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: shipment.routeWaypoints,
            },
            properties: {},
          },
        })

        // Add completed route layer
        map.current!.addLayer({
          id: `route-completed-${shipment.id}`,
          type: 'line',
          source: `route-${shipment.id}`,
          paint: {
            'line-color': '#1ECC8B',
            'line-width': 2.5,
            'line-opacity': 0.8,
          },
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
        })

        // Add remaining route layer
        map.current!.addLayer({
          id: `route-remaining-${shipment.id}`,
          type: 'line',
          source: `route-${shipment.id}`,
          paint: {
            'line-color': '#58A6FF',
            'line-width': 1.5,
            'line-opacity': 0.4,
            'line-dasharray': [3, 3],
          },
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
        })
      })

      // Add custom marker elements (will use HTML overlays)
    })

    return () => {
      if (map.current) {
        map.current.remove()
      }
    }
  }, [])

  const handleShipmentSelect = (shipmentId: string) => {
    setSelectedShipmentId(shipmentId)
    const shipment = shipments.find((s) => s.id === shipmentId)
    if (shipment && map.current && shipment.currentPos) {
      map.current.flyTo({
        center: shipment.currentPos,
        zoom: 6,
        duration: 1200,
      })
      setPopupPosition({ x: 0, y: 0 })
    }
  }

  const statusConfig = {
    critical: { label: 'CRITICAL', color: '#FF4444', bgColor: 'rgba(255,68,68,0.15)' },
    warning: { label: 'WARNING', color: '#F0A500', bgColor: 'rgba(240,165,0,0.15)' },
    normal: { label: 'NORMAL', color: '#1ECC8B', bgColor: 'rgba(30,204,139,0.15)' },
    feed_lost: { label: 'FEED LOST', color: '#8B949E', bgColor: 'rgba(139,148,158,0.15)' },
  }

  const statusCounts = {
    critical: shipments.filter((s) => s.status === 'critical').length,
    warning: shipments.filter((s) => s.status === 'warning').length,
    normal: shipments.filter((s) => s.status === 'normal').length,
    feed_lost: shipments.filter((s) => s.status === 'feed_lost').length,
  }

  const selectedShipment = shipments.find((s) => s.id === selectedShipmentId)

  return (
    <div className="w-full h-screen bg-void relative overflow-hidden">
      {/* Map */}
      <div ref={mapContainer} className="w-full h-full" style={{ zIndex: 0 }} />

      {/* Left Panel - Shipment List */}
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="absolute left-0 top-0 w-80 h-screen flex flex-col"
        style={{
          background: 'rgba(8,11,15,0.85)',
          backdropFilter: 'blur(28px)',
          borderRight: '1px solid rgba(88,166,255,0.1)',
          zIndex: 20,
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 px-4 py-3"
          style={{
            background: 'rgba(8,11,15,0.9)',
            borderBottom: '1px solid rgba(88,166,255,0.1)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest" style={{ color: '#58A6FF', fontFamily: 'JetBrains Mono' }}>
                Live Tracker
              </div>
              <div className="text-xs mt-1" style={{ color: '#8B949E' }}>
                4 shipments monitored
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs" style={{ color: '#1ECC8B', fontFamily: 'JetBrains Mono' }}>
                LIVE
              </span>
            </div>
          </div>
        </div>

        {/* Shipment List */}
        <div className="flex-1 overflow-y-auto">
          {shipments.map((shipment) => {
            const config = statusConfig[shipment.status]
            const isSelected = selectedShipmentId === shipment.id
            return (
              <motion.div
                key={shipment.id}
                onClick={() => handleShipmentSelect(shipment.id)}
                className="px-4 py-3 cursor-pointer transition-colors"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: isSelected ? 'rgba(88,166,255,0.06)' : 'transparent',
                  borderLeft: isSelected ? '3px solid #58A6FF' : '3px solid transparent',
                }}
                whileHover={{ background: 'rgba(88,166,255,0.04)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      background: config.bgColor,
                      color: config.color,
                      border: `1px solid ${config.color}33`,
                      fontFamily: 'JetBrains Mono',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      animation: shipment.status === 'critical' ? 'pulse 1.5s infinite' : 'none',
                    }}
                  >
                    {config.label}
                  </span>
                  <span className="text-xs" style={{ color: '#8B949E', fontFamily: 'JetBrains Mono' }}>
                    {shipment.id}
                  </span>
                </div>
                <div className="text-xs mb-2 truncate" style={{ color: '#8B949E' }}>
                  {shipment.originCity} → {shipment.destCity}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: config.color, fontFamily: 'JetBrains Mono' }}>
                    {shipment.temperature ? `${shipment.temperature}°C` : 'N/A'}
                  </span>
                  <span style={{ color: '#8B949E', fontFamily: 'JetBrains Mono' }}>
                    {shipment.eta}
                    {shipment.etaDelayed && ' ⚠'}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Top-Right Mini Status Panel */}
      <motion.div
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="absolute top-4 right-4 w-52"
        style={{
          background: 'rgba(13,17,23,0.88)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(88,166,255,0.15)',
          borderRadius: '12px',
          padding: '12px 16px',
          zIndex: 20,
        }}
      >
        <div className="text-xs uppercase tracking-widest mb-3" style={{ color: '#484F58', fontFamily: 'JetBrains Mono' }}>
          Fleet Status
        </div>
        {Object.entries(statusCounts).map(([status, count]) => {
          const config = statusConfig[status as keyof typeof statusConfig]
          return (
            <div key={status} className="flex items-center gap-2 mb-2 text-xs" style={{ fontFamily: 'JetBrains Mono' }}>
              <div className="w-2 h-2 rounded-full" style={{ background: config.color }} />
              <span style={{ color: '#E6EDF3' }}>
                {config.label} {count}
              </span>
            </div>
          )
        })}
      </motion.div>

      {/* Bottom Status Bar */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="absolute bottom-4 left-80 right-4 flex items-center justify-between px-4 py-3"
        style={{
          background: 'rgba(8,11,15,0.8)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(88,166,255,0.1)',
          borderRadius: '16px',
          zIndex: 20,
        }}
      >
        <div className="flex gap-4">
          {Object.entries(statusCounts).map(([status, count]) => {
            const config = statusConfig[status as keyof typeof statusConfig]
            return (
              <span
                key={status}
                className="text-xs px-3 py-1 rounded-full"
                style={{
                  background: config.bgColor,
                  color: config.color,
                  border: `1px solid ${config.color}40`,
                  fontFamily: 'JetBrains Mono',
                }}
              >
                {config.label} {count}
              </span>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: '#484F58', fontFamily: 'JetBrains Mono' }}>
            Last sync 3s ago
          </span>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </div>
      </motion.div>

      {/* Info Popup */}
      <AnimatePresence>
        {selectedShipment && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 300 }}
            className="absolute top-32 left-1/2 transform -translate-x-1/2 w-72"
            style={{
              background: 'rgba(13,17,23,0.95)',
              backdropFilter: 'blur(32px)',
              border: '1px solid rgba(88,166,255,0.2)',
              borderRadius: '14px',
              padding: '16px',
              boxShadow: '0 0 40px rgba(0,0,0,0.8), 0 0 80px rgba(88,166,255,0.06)',
              zIndex: 25,
            }}
          >
            {/* Top shimmer */}
            <div
              className="absolute top-0 left-1/4 w-1/2 h-px"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(88,166,255,0.7), transparent)',
                borderRadius: '14px 14px 0 0',
              }}
            />

            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    background: statusConfig[selectedShipment.status].bgColor,
                    color: statusConfig[selectedShipment.status].color,
                    border: `1px solid ${statusConfig[selectedShipment.status].color}33`,
                    fontFamily: 'JetBrains Mono',
                    fontSize: '9px',
                    fontWeight: 'bold',
                  }}
                >
                  {statusConfig[selectedShipment.status].label}
                </span>
                <span style={{ color: '#E6EDF3', fontFamily: 'JetBrains Mono', fontSize: '13px', fontWeight: 600 }}>
                  {selectedShipment.id}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedShipmentId(null)
                  setPopupPosition(null)
                }}
                className="p-1 hover:opacity-70 transition-opacity"
              >
                <X size={16} style={{ color: '#8B949E' }} />
              </button>
            </div>

            {/* Route */}
            <div className="text-xs mb-4" style={{ color: '#8B949E' }}>
              {selectedShipment.originCity} → {selectedShipment.destCity}
            </div>

            {/* Telemetry Grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: 'Temp', value: selectedShipment.temperature ? `${selectedShipment.temperature}°C` : 'N/A' },
                { label: 'Humidity', value: selectedShipment.humidity },
                { label: 'Shock', value: selectedShipment.shock },
                { label: 'Coords', value: `${selectedShipment.currentPos?.[1].toFixed(2)}°N ${selectedShipment.currentPos?.[0].toFixed(2)}°E` },
                { label: 'Speed', value: selectedShipment.speed },
                { label: 'ETA', value: selectedShipment.eta },
              ].map((tile, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded text-xs"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div style={{ color: '#484F58', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>
                    {tile.label}
                  </div>
                  <div
                    style={{
                      color: idx === 0 ? statusConfig[selectedShipment.status].color : '#8B949E',
                      fontFamily: 'JetBrains Mono',
                      fontSize: '11px',
                    }}
                  >
                    {tile.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Compliance Strip for CRITICAL */}
            {selectedShipment.status === 'critical' && (
              <div
                className="flex items-center gap-2 p-3 rounded mb-0"
                style={{
                  background: 'rgba(255,68,68,0.06)',
                  border: '1px solid rgba(255,68,68,0.2)',
                }}
              >
                <AlertTriangle size={12} style={{ color: '#FF4444' }} />
                <span style={{ color: '#FF4444', fontSize: '11px', fontFamily: 'Inter' }}>
                  Active crisis — view ticket →
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default LiveTrackerPage
