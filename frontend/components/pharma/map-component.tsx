'use client'

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

interface MapComponentProps {
  center?: [number, number]
  zoom?: number
  pitch?: number
}

export default function MapComponent({ 
  center = [20, 25], 
  zoom = 2.5, 
  pitch = 25 
}: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  
  // Extract center coordinates for stable dependency array
  const centerLng = center[0]
  const centerLat = center[1]

  useEffect(() => {
    if (!mapContainer.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [centerLng, centerLat],
      zoom: zoom,
      pitch: pitch,
      bearing: 0,
      attributionControl: false,
    })

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    // Add route line for Suez Canal
    map.current.on('load', () => {
      if (!map.current) return

      // Add the route source
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [72.8, 19.1],   // Mumbai
              [57.0, 16.0],   // Arabian Sea
              [43.0, 12.5],   // Gulf of Aden
              [32.5, 29.9],   // Suez Canal (current position)
              [31.2, 31.4],   // Port Said
              [-5.0, 36.0],   // Gibraltar
              [-74.0, 40.7],  // New York
            ]
          }
        }
      })

      // Completed route (green)
      map.current.addLayer({
        id: 'route-completed',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#1ECC8B',
          'line-width': 3,
          'line-opacity': 0.8
        }
      })

      // Current position marker
      const currentPos = [32.5, 29.9]
      new maplibregl.Marker({ 
        color: '#FF4444',
        scale: 1.2
      })
        .setLngLat(currentPos as [number, number])
        .addTo(map.current!)

      // Origin marker (Mumbai)
      new maplibregl.Marker({ color: '#1ECC8B' })
        .setLngLat([72.8, 19.1])
        .addTo(map.current!)

      // Destination marker (New York)
      new maplibregl.Marker({ color: '#58A6FF' })
        .setLngLat([-74.0, 40.7])
        .addTo(map.current!)
    })

    return () => {
      map.current?.remove()
    }
  }, [centerLng, centerLat, zoom, pitch])

  return <div ref={mapContainer} className="w-full h-full" />
}
