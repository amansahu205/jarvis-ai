"use client"

import { useEffect, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import { Deck } from "@deck.gl/core"
import { ArcLayer, ScatterplotLayer } from "@deck.gl/layers"
import "maplibre-gl/dist/maplibre-gl.css"

interface MapContainerProps {
  onMapReady?: (map: maplibregl.Map) => void
  focusCoords?: { lng: number; lat: number; zoom?: number }
}

// Route data for Suez Canal shipment
const ROUTE_COORDS = [
  { lng: 72.8777, lat: 19.076 }, // Mumbai
  { lng: 58.5, lat: 20.0 }, // Arabian Sea
  { lng: 43.5, lat: 12.8 }, // Red Sea
  { lng: 32.35, lat: 30.0 }, // Suez Canal (current position)
  { lng: 32.35, lat: 31.2 }, // Port Said
  { lng: 15.0, lat: 36.0 }, // Mediterranean
  { lng: -5.0, lat: 36.5 }, // Gibraltar
  { lng: -40.0, lat: 40.0 }, // Atlantic
  { lng: -74.006, lat: 40.7128 }, // New York
]

const CURRENT_POSITION = { lng: 32.35, lat: 30.0 }

export function MapContainer({ onMapReady, focusCoords }: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const deckRef = useRef<Deck | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          "carto-dark": {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            attribution: "&copy; CARTO",
          },
        },
        layers: [
          {
            id: "carto-dark-layer",
            type: "raster",
            source: "carto-dark",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [32.35, 30.0],
      zoom: 4,
      pitch: 20,
      bearing: 10,
    })

    map.on("load", () => {
      // Build arc data for Deck.gl (glowing route arc)
      const arcData = []
      for (let i = 0; i < ROUTE_COORDS.length - 1; i++) {
        arcData.push({
          sourcePosition: [ROUTE_COORDS[i].lng, ROUTE_COORDS[i].lat],
          targetPosition: [ROUTE_COORDS[i + 1].lng, ROUTE_COORDS[i + 1].lat],
          color: i < 3 ? [30, 204, 139, 200] : [88, 166, 255, 150], // Green for completed, blue for remaining
        })
      }

      // Build waypoint data for ScatterplotLayer
      const waypointData = ROUTE_COORDS.map((coord, index) => {
        const isStart = index === 0
        const isEnd = index === ROUTE_COORDS.length - 1
        const isCurrent = coord.lng === CURRENT_POSITION.lng && coord.lat === CURRENT_POSITION.lat

        return {
          position: [coord.lng, coord.lat],
          size: isCurrent ? 16 : isStart || isEnd ? 12 : 8,
          color: isCurrent ? [255, 68, 68, 255] : isStart ? [30, 204, 139, 255] : isEnd ? [88, 166, 255, 255] : [139, 148, 158, 150],
        }
      })

      // Initialize Deck.gl
      const deck = new Deck({
        canvas: "deck-canvas",
        width: "100%",
        height: "100%",
        initialViewState: {
          longitude: 32.35,
          latitude: 30.0,
          zoom: 4,
          pitch: 20,
          bearing: 10,
        },
        controller: false, // Use MapLibre for interaction
        layers: [
          new ArcLayer({
            id: "route-arc",
            data: arcData,
            getSourcePosition: (d: any) => d.sourcePosition,
            getTargetPosition: (d: any) => d.targetPosition,
            getSourceColor: (d: any) => d.color,
            getTargetColor: (d: any) => d.color,
            getWidth: 3,
            getHeight: 0,
            getTilt: 0,
            widthUnits: "pixels",
            opacity: 0.8,
          }),
          new ScatterplotLayer({
            id: "waypoints",
            data: waypointData,
            getPosition: (d: any) => d.position,
            getRadius: (d: any) => d.size / 2,
            getColor: (d: any) => d.color,
            radiusUnits: "pixels",
            opacity: 0.9,
            stroked: true,
            getLineColor: [255, 255, 255, 100],
            getLineWidth: 2,
            lineWidthUnits: "pixels",
          }),
        ],
      })

      // Sync Deck.gl with MapLibre camera
      map.on("move", () => {
        const cam = map.getFreeCameraOptions()
        deck.setProps({
          viewState: {
            longitude: map.getCenter().lng,
            latitude: map.getCenter().lat,
            zoom: map.getZoom(),
            pitch: map.getPitch(),
            bearing: map.getBearing(),
          },
        })
      })

      deckRef.current = deck
      setIsLoaded(true)
      onMapReady?.(map)
    })

    mapRef.current = map

    return () => {
      if (deckRef.current) {
        deckRef.current.finalize()
      }
      map.remove()
      mapRef.current = null
    }
  }, [onMapReady])

  // Handle focus changes
  useEffect(() => {
    if (!mapRef.current || !focusCoords || !isLoaded) return

    mapRef.current.flyTo({
      center: [focusCoords.lng, focusCoords.lat],
      zoom: focusCoords.zoom ?? 6,
      duration: 1500,
      essential: true,
    })
  }, [focusCoords, isLoaded])

  return (
    <div className="absolute inset-0 w-full h-full">
      <canvas id="deck-canvas" className="absolute inset-0" />
      <div ref={mapContainerRef} className="w-full h-full" />
      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(8,11,15,0.6) 100%)",
        }}
      />
    </div>
  )
}
