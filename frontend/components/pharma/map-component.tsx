'use client'

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

interface MapComponentProps {
  center?: [number, number]
  zoom?: number
  pitch?: number
  waypoints?: [number, number][]  // [lat, lon] from API — flipped to [lon, lat] for MapLibre
}

// Default BOM→JFK route shown before API data arrives
const DEFAULT_COORDS: [number, number][] = [
  [72.8, 19.1], [57.0, 16.0], [43.0, 12.5],
  [32.5, 29.9], [31.2, 31.4], [-5.0, 36.0], [-74.0, 40.7],
]

export default function MapComponent({
  center = [20, 25],
  zoom = 2.5,
  pitch = 25,
  waypoints = [],
}: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])

  // Convert [lat, lon] → [lon, lat] for MapLibre/GeoJSON
  const toCoords = (wps: [number, number][]): [number, number][] =>
    wps.map(([lat, lon]) => [lon, lat])

  const activeCoords = waypoints.length >= 2 ? toCoords(waypoints) : DEFAULT_COORDS

  // Initialise map once
  useEffect(() => {
    if (!mapContainer.current) return
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
      map.current.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: activeCoords } },
      })
      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#1ECC8B', 'line-width': 3, 'line-opacity': 0.8 },
      })
      _placeMarkers(activeCoords)
    })

    return () => { map.current?.remove() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update route when waypoints change
  useEffect(() => {
    if (!map.current) return
    const coords = activeCoords
    const src = map.current.getSource('route') as maplibregl.GeoJSONSource | undefined
    if (src) {
      src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } })
      _placeMarkers(coords)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints])

  function _placeMarkers(coords: [number, number][]) {
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    if (coords.length < 2) return
    markersRef.current.push(
      new maplibregl.Marker({ color: '#1ECC8B' }).setLngLat(coords[0]).addTo(map.current!),
      new maplibregl.Marker({ color: '#58A6FF' }).setLngLat(coords[coords.length - 1]).addTo(map.current!),
    )
  }

  return <div ref={mapContainer} className="w-full h-full" />
}
