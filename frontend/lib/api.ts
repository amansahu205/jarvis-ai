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

export const analyzeRoute = (origin: string, destination: string, transitMode: string, cargoType: string) =>
  req<RouteResponse>('POST', '/api/v1/regumap/analyze-route', {
    origin, destination, transit_mode: transitMode, cargo_type: cargoType,
  })

export const spatialCheck = (origin: string, destination: string, transitMode: string, waypoints: [number, number][]) =>
  req<{ jurisdictions: Jurisdiction[] }>('POST', '/api/v1/regumap/spatial-check', {
    origin, destination, transit_mode: transitMode, waypoints,
  })

export const complianceCheck = (jurisdictions: Jurisdiction[]) =>
  req<ComplianceResponse>('POST', '/api/v1/regumap/compliance-check', { jurisdictions })
