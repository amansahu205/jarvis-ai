const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Token storage ─────────────────────────────────────────────────────────────
export const getToken = (): string | null =>
  typeof window !== 'undefined' ? localStorage.getItem('jarvis_token') : null

export const setToken = (t: string) => localStorage.setItem('jarvis_token', t)
export const clearToken = () => localStorage.removeItem('jarvis_token')

// ── Core fetch ────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function req<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new ApiError(res.status, json.detail ?? 'Request failed')
  return json.data as T
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface TokenResponse {
  access_token: string
  token_type: string
  role: string
  name: string
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const data = await req<TokenResponse>('POST', '/api/v1/auth/login', { email, password })
  setToken(data.access_token)
  return data
}

export async function getMe(): Promise<{ id: number; email: string; name: string; role: string }> {
  return req('GET', '/api/v1/auth/me')
}

// ── ReguMap ───────────────────────────────────────────────────────────────────
export interface RouteResponse {
  route_id: string
  waypoints: [number, number][]
  transit_time_hours: number
  mode: string
  origin_coords: [number, number]
  destination_coords: [number, number]
}


export interface RiskBreakdown {
  thermal: number
  geopolitical: number
  operational: number
}

export interface CandidateRoute {
  route_id: string
  transit_mode: 'air' | 'maritime' | 'multimodal'
  leg_count: number
  estimated_hours: number
  origin_id: string
  destination_id: string
  path_nodes: string[]
  waypoints: [number, number][]
  risk_score: number | null
  risk_breakdown: RiskBreakdown | null
  compliance_summary: string
  strategist_note: string
}

export interface StrategistOutput {
  recommended_route_id: string
  risk_score: number
  compliance_summary: string
  thought_log: string[]
  evaluated_routes: CandidateRoute[]
}

export interface CrisisRerouteOption {
  option_rank: number
  route_id: string
  transit_mode: string
  estimated_hours: number
  risk_score: number
  path_nodes: string[]
  waypoints: [number, number][]
  strategist_note: string | null
  compliance_status: string | null
  compliance_note: string | null
  compliance_summary: string | null
}

export interface CrisisTicketResponse {
  ticket_id: number
  reading_id: string
  shipment_id: string
  status: string
  recommended_route_id: string | null
  risk_score: number | null
  thought_log: string[]
  evaluated_routes: CrisisRerouteOption[]
}


export interface ApproveTicketResponse {
  ticket_id: number
  status: string
  approved_by: string
}

export interface Jurisdiction {
  id: string
  name: string
  flag: string
  type: string
  coordinates: [number, number]
  regulatory_class: string
}

export interface JurisdictionCompliance extends Jurisdiction {
  badge: 'PASS' | 'FLAG' | 'BLOCK'
  regulation: string
  clause: string
  citation: string
  citation_url: string
  warning: string | null
  rag_confidence: number
  rag_fallback: boolean
}

export interface ComplianceResponse {
  jurisdictions: JurisdictionCompliance[]
  overall_status: 'PASS' | 'FLAG' | 'BLOCK'
}

export interface RouteGeometryRequest {
  origin: string
  destination: string
  transit_mode: string
  waypoints: [number, number][]
}

export interface RouteGeometryResponse {
  source: string
  geometry: GeoJSON.Geometry
}

export interface TelemetryLatestResponse {
  reading_id: string
  shipment_id: string
  temp_c: number
  temp_excursion: boolean
  alert_flag: boolean
  status: string
  recorded_at: string
}

export const analyzeRoute = (origin: string, destination: string, transitMode: string, cargoType: string) =>
  req<RouteResponse>('POST', '/api/v1/regumap/analyze-route', {
    origin, destination, transit_mode: transitMode, cargo_type: cargoType,
  })

export const planStrategistRoute = (originId: string, destId: string, cargoType: string) =>
  req<StrategistOutput>('POST', '/api/v1/strategist/plan', {
    origin_id: originId, dest_id: destId, cargo_type: cargoType,
  })

export const getLatestCrisisTicket = () =>
  req<CrisisTicketResponse>('GET', '/api/v1/strategist/tickets/latest')

export const approveCrisisTicket = (ticketId: number, note?: string) =>
  req<ApproveTicketResponse>('POST', `/api/v1/strategist/tickets/${ticketId}/approve`, {
    note,
  })

export const spatialCheck = (origin: string, destination: string, transitMode: string, waypoints: [number, number][]) =>
  req<{ jurisdictions: Jurisdiction[] }>('POST', '/api/v1/regumap/spatial-check', {
    origin, destination, transit_mode: transitMode, waypoints,
  })

export const complianceCheck = (jurisdictions: Jurisdiction[]) =>
  req<ComplianceResponse>('POST', '/api/v1/regumap/compliance-check', { jurisdictions })

export const fetchRouteGeometry = (payload: RouteGeometryRequest) =>
  req<RouteGeometryResponse>('POST', '/api/v1/regumap/route-geometry', payload)

export const getLatestTelemetry = () =>
  req<TelemetryLatestResponse>('GET', '/api/v1/telemetry/latest')


export interface ParsedShipment {
  shipment_code: string
  sensor_id: string
  medication_name: string
  lot_number: string
  temp_min_c: number
  temp_max_c: number
  humidity_min_pct: number
  humidity_max_pct: number
  origin_locode: string
  destination_locode: string
}

export interface ShipmentRecord extends ParsedShipment {
  id: number
  created_by_user_id: number
  status: string
  transit_mode: 'air' | 'maritime' | 'ground' | 'multimodal'
  estimated_hours: number
  waypoints: [number, number][]
  created_at: string
  updated_at: string
}

export interface ShipmentSummaryItem {
  shipment_id: string
  route: string
  status: 'critical' | 'warning' | 'normal' | 'feed_lost' | 'active'
  temp: string
  eta: string
  coords: { lat: number; lng: number } | null
  humidity: string | null
  waypoints: [number, number][]
  cargo: string
  transit_mode: 'air' | 'maritime' | 'ground' | 'multimodal'
}

export interface ActiveShipmentItem {
  id: string
  shipmentId: string
  origin: string
  destination: string
  status: 'critical' | 'warning' | 'normal' | 'feed_lost'
  currentTemp: string
  eta: string
  transitMode: 'air' | 'maritime' | 'ground' | 'multimodal'
  cargo: string
  humidity: string | null
  routeWaypoints: [number, number][]
  currentPos: [number, number] | null
  trend: string | null
  countdownTime: string | null
  lastReading: string | null
  warningNote: string | null
  crisisMessage: string | null
}

async function upload<T>(path: string, file: File): Promise<T> {
  const token = getToken()
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: token ? { Authorization: 'Bearer ' + token } : {},
    body: formData,
  })
  const json = await res.json()
  if (!res.ok) throw new ApiError(res.status, json.detail ?? 'Request failed')
  return json.data as T
}

export const parsePurchaseOrder = (file: File) => upload<ParsedShipment>('/api/v1/shipments/parse-po', file)
export const createShipment = (payload: ParsedShipment) => req<ShipmentRecord>('POST', '/api/v1/shipments/create', payload)
export const getLatestShipmentSummary = () => req<ShipmentSummaryItem[]>('GET', '/api/v1/telemetry/latest-summary')
export const getActiveShipments = () => req<ActiveShipmentItem[]>('GET', '/api/v1/locations/active-shipments')
