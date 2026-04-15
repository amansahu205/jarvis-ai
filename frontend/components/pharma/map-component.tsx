'use client'

import { useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import maplibregl from 'maplibre-gl'
import { Deck } from '@deck.gl/core'
import { GeoJsonLayer, PathLayer, ArcLayer } from '@deck.gl/layers'
import { PathStyleExtension } from '@deck.gl/extensions'
import { createRoot, type Root } from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'

interface MapComponentProps {
  center?: [number, number]
  zoom?: number
  pitch?: number
  waypoints?: [number, number][] // [lat, lon] from API — flipped to [lon, lat] for map usage
  routeGeometry?: GeoJSON.Geometry | null
  transitMode?: 'air' | 'maritime'
  isCrisis?: boolean
}

interface MarkerEntry {
  marker: maplibregl.Marker
  root: Root
}

// Default BOM→JFK route shown before live API data arrives.
const DEFAULT_COORDS: [number, number][] = [
  [72.8, 19.1], [57.0, 16.0], [43.0, 12.5],
  [32.5, 29.9], [31.2, 31.4], [-5.0, 36.0], [-74.0, 40.7],
]

function AnimatedMarker({
  color,
  pulseSeconds,
}: {
  color: string
  pulseSeconds: number
}) {
  return (
    <motion.div
      initial={{ y: -26, opacity: 0, scale: 0.82 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 480, damping: 28 }}
      style={{ position: 'relative', width: 18, height: 18 }}
    >
      <div
        className="marker-ripple"
        style={{
          animationDuration: `${pulseSeconds}s`,
          background: `${color}44`,
          borderColor: `${color}BB`,
        }}
      />
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: 999,
          background: color,
          boxShadow: `0 0 16px ${color}, 0 0 28px ${color}88`,
          border: '2px solid rgba(230,237,243,0.9)',
          position: 'absolute',
          left: 3,
          top: 3,
        }}
      />
    </motion.div>
  )
}

export default function MapComponent({
  center = [20, 25],
  zoom = 2.5,
  pitch = 25,
  waypoints = [],
  routeGeometry = null,
  transitMode = 'air',
  isCrisis = false,
}: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const deckCanvasRef = useRef<HTMLCanvasElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const deck = useRef<Deck | null>(null)
  const markersRef = useRef<MarkerEntry[]>([])
  const dashTickRef = useRef<number | null>(null)

  // Convert [lat, lon] -> [lon, lat] for map/geojson rendering.
  const toCoords = (wps: [number, number][]): [number, number][] =>
    wps.map(([lat, lon]) => [lon, lat])

  const activeCoords = useMemo(
    () => (waypoints.length >= 2 ? toCoords(waypoints) : DEFAULT_COORDS),
    [waypoints],
  )

  const fallbackGeometry = useMemo<GeoJSON.Geometry>(() => ({
    type: 'LineString',
    coordinates: activeCoords,
  }), [activeCoords])

  const effectiveGeometry = routeGeometry ?? fallbackGeometry

  const routeFeatureCollection = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { mode: transitMode },
      geometry: effectiveGeometry,
    }],
  }), [effectiveGeometry, transitMode])

  // Initialise map and Deck once.
  useEffect(() => {
    if (!mapContainer.current || !deckCanvasRef.current) return
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [center[0], center[1]],
      zoom,
      pitch,
      bearing: 0,
      attributionControl: false,
    })
    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    map.current.on('load', () => {
      if (!map.current) return

      deck.current = new Deck({
        canvas: deckCanvasRef.current!,
        controller: false,
        initialViewState: {
          longitude: map.current.getCenter().lng,
          latitude: map.current.getCenter().lat,
          zoom: map.current.getZoom(),
          pitch: map.current.getPitch(),
          bearing: map.current.getBearing(),
        },
        layers: [],
      })

      map.current.addSource('route-flow', {
        type: 'geojson',
        data: routeFeatureCollection,
      })
      map.current.addLayer({
        id: 'route-flow-line',
        type: 'line',
        source: 'route-flow',
        paint: {
          'line-color': isCrisis ? '#FF4444' : (transitMode === 'maritime' ? '#1ECC8B' : '#58A6FF'),
          'line-width': transitMode === 'maritime' ? 4 : 2,
          'line-opacity': 0.95,
          'line-dasharray': transitMode === 'maritime' ? [0] : [0, 2, 2],
        },
      })

      _syncDeckLayers(routeFeatureCollection)
      _placeMarkers(activeCoords)

      // Only animate dashing for air routes; maritime routes are solid
      if (transitMode === 'air') {
        dashTickRef.current = window.setInterval(() => {
          if (!map.current?.getLayer('route-flow-line')) return
          const shift = ((Date.now() / 160) % 8) + 1
          map.current.setPaintProperty('route-flow-line', 'line-dasharray', [shift, 2, 2])
        }, 120)
      }

      map.current.on('move', () => {
        if (!map.current || !deck.current) return
        deck.current.setProps({
          viewState: {
            longitude: map.current.getCenter().lng,
            latitude: map.current.getCenter().lat,
            zoom: map.current.getZoom(),
            pitch: map.current.getPitch(),
            bearing: map.current.getBearing(),
          },
        })
      })
    })

    return () => {
      if (dashTickRef.current) window.clearInterval(dashTickRef.current)
      markersRef.current.forEach(({ marker, root }) => {
        marker.remove()
        root.unmount()
      })
      markersRef.current = []
      deck.current?.finalize()
      map.current?.remove()
    }
  }, [])

  // Update route/markers when geometry or crisis state changes.
  useEffect(() => {
    if (!map.current) return
    const src = map.current.getSource('route-flow') as maplibregl.GeoJSONSource | undefined
    if (src) {
      src.setData(routeFeatureCollection)
      if (map.current.getLayer('route-flow-line')) {
        map.current.setPaintProperty('route-flow-line', 'line-color', isCrisis ? '#FF4444' : (transitMode === 'maritime' ? '#1ECC8B' : '#58A6FF'))
        map.current.setPaintProperty('route-flow-line', 'line-width', transitMode === 'maritime' ? 4 : 2)
        map.current.setPaintProperty('route-flow-line', 'line-dasharray', transitMode === 'maritime' ? [0] : [0, 2, 2])
      }
      _syncDeckLayers(routeFeatureCollection)
      _placeMarkers(activeCoords)
    }
  }, [routeFeatureCollection, activeCoords, isCrisis, transitMode])

  function _syncDeckLayers(data: GeoJSON.FeatureCollection) {
    if (!deck.current) return

    // Use PathLayer for maritime routes with glow effect, GeoJsonLayer for air routes
    if (transitMode === 'maritime') {
      const mainColor = isCrisis ? [255, 68, 68, 240] : [30, 204, 139, 240]
      const glowColor = isCrisis ? [255, 68, 68, 60] : [30, 204, 139, 60]
      const bluGlowColor = isCrisis ? [255, 68, 68, 40] : [30, 204, 139, 40]

      deck.current.setProps({
        layers: [
          // Outermost glow layer (thick, blurred effect)
          new PathLayer({
            id: 'maritime-glow-blur',
            data,
            pickable: false,
            widthScale: 20,
            widthMinPixels: 8,
            getPath: (f: any) => {
              const coords = f.geometry.coordinates
              return coords.map((c: [number, number]) => [c[0], c[1]])
            },
            getColor: bluGlowColor,
            getWidth: 16,
            rounded: true,
            lineJointRounded: true,
            capRounded: true,
          }),
          // Middle glow layer
          new PathLayer({
            id: 'maritime-glow',
            data,
            pickable: false,
            widthScale: 20,
            widthMinPixels: 6,
            getPath: (f: any) => {
              const coords = f.geometry.coordinates
              return coords.map((c: [number, number]) => [c[0], c[1]])
            },
            getColor: glowColor,
            getWidth: 12,
            rounded: true,
            lineJointRounded: true,
            capRounded: true,
          }),
          // Bright main line (solid, thick for maritime)
          new PathLayer({
            id: 'maritime-main',
            data,
            pickable: false,
            widthScale: 20,
            widthMinPixels: 4,
            getPath: (f: any) => {
              const coords = f.geometry.coordinates
              return coords.map((c: [number, number]) => [c[0], c[1]])
            },
            getColor: mainColor,
            getWidth: 6,
            rounded: true,
            lineJointRounded: true,
            capRounded: true,
          }),
        ],
      })
    } else {
      // Air mode: keep the existing GeoJsonLayer styling
      const mainColor = isCrisis ? [255, 68, 68, 230] : [88, 166, 255, 225]
      const glowColor = isCrisis ? [255, 68, 68, 90] : [88, 166, 255, 90]

      deck.current.setProps({
        layers: [
          new GeoJsonLayer({
            id: 'route-glow',
            data,
            stroked: true,
            filled: false,
            lineWidthUnits: 'pixels',
            getLineColor: glowColor,
            getLineWidth: 6,
            pickable: false,
          }),
          new GeoJsonLayer({
            id: 'route-dashed',
            data,
            stroked: true,
            filled: false,
            lineWidthUnits: 'pixels',
            getLineColor: mainColor,
            getLineWidth: 3,
            getLineDashArray: [7, 5],
            dashJustified: true,
            extensions: [new PathStyleExtension({ dash: true })],
            pickable: false,
          }),
        ],
      })
    }
  }

  function _placeMarkers(coords: [number, number][]) {
    markersRef.current.forEach(({ marker, root }) => {
      marker.remove()
      root.unmount()
    })
    markersRef.current = []
    if (coords.length < 2) return

    const pulseSeconds = isCrisis ? 0.75 : 1.5
    const originColor = isCrisis ? '#FF4444' : '#58A6FF'
    const destinationColor = isCrisis ? '#FF4444' : '#BC8CFF'

    const createMarker = (lngLat: [number, number], color: string) => {
      if (!map.current) return
      const element = document.createElement('div')
      const root = createRoot(element)
      root.render(<AnimatedMarker color={color} pulseSeconds={pulseSeconds} />)
      const marker = new maplibregl.Marker({ element, anchor: 'center' }).setLngLat(lngLat).addTo(map.current)
      markersRef.current.push({ marker, root })
    }

    createMarker(coords[0], originColor)
    createMarker(coords[coords.length - 1], destinationColor)
  }

  return (
    <div className="relative w-full h-full">
      <style jsx>{`
        .marker-ripple {
          position: absolute;
          width: 20px;
          height: 20px;
          left: -1px;
          top: -1px;
          border-radius: 999px;
          border: 1px solid;
          animation-name: marker-ripple;
          animation-timing-function: ease-out;
          animation-iteration-count: infinite;
        }

        @keyframes marker-ripple {
          0% {
            transform: scale(0.6);
            opacity: 0.85;
          }
          100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }
      `}</style>

      <div ref={mapContainer} className="w-full h-full" />
      <canvas ref={deckCanvasRef} id="regumap-deck-canvas" className="absolute inset-0 pointer-events-none" />

      <div
        className="absolute top-4 right-4 px-3 py-2 rounded-xl text-xs font-mono"
        style={{
          color: '#E6EDF3',
          background: 'rgba(8,11,15,0.65)',
          border: `1px solid ${isCrisis ? 'rgba(255,68,68,0.35)' : 'rgba(88,166,255,0.28)'}`,
          backdropFilter: 'blur(16px)',
          boxShadow: isCrisis ? '0 0 14px rgba(255,68,68,0.25)' : '0 0 14px rgba(88,166,255,0.2)',
        }}
      >
        {isCrisis ? 'CRISIS MODE' : 'NORMAL MODE'} · {transitMode.toUpperCase()}
      </div>
    </div>
  )
}
