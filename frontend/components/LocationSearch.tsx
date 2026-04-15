"use client"
import { useState, useEffect, useRef, useCallback } from "react"

export interface LocationResult {
  code: string
  label: string
  country: string
  region: string | null
  latitude: number | null
  longitude: number | null
}

interface LocationSearchProps {
  mode: "air" | "maritime"
  placeholder?: string
  defaultValue?: string
  onSelect: (loc: LocationResult) => void
  inputStyle?: React.CSSProperties
}

export function LocationSearch({
  mode,
  placeholder,
  defaultValue = "",
  onSelect,
  inputStyle,
}: LocationSearchProps) {
  const [query, setQuery] = useState(defaultValue)
  const [results, setResults] = useState<LocationResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Clear stale value when mode changes
  useEffect(() => {
    if (!selected) return
    setQuery("")
    setSelected(false)
    setResults([])
  }, [mode])

  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([])
        setOpen(false)
        return
      }
      setLoading(true)
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        const res = await fetch(
          `${apiUrl}/api/v1/locations/search?q=${encodeURIComponent(q)}&mode=${mode}`
        )
        if (!res.ok) throw new Error("Search failed")
        const data: LocationResult[] = await res.json()
        setResults(data)
        setOpen(data.length > 0)
      } catch {
        setResults([])
        setOpen(false)
      } finally {
        setLoading(false)
      }
    },
    [mode]
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setSelected(false)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => search(val), 280)
  }

  const handleSelect = (loc: LocationResult) => {
    setQuery(`${loc.code} — ${loc.label}`)
    setSelected(true)
    setOpen(false)
    setResults([])
    onSelect(loc)
  }

  const defaultInputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(88,166,255,0.2)",
    borderRadius: "12px",
    color: "#E6EDF3",
    fontFamily: "JetBrains Mono, monospace",
    fontSize: "13px",
    outline: "none",
    ...inputStyle,
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() =>
            query.length >= 2 && !selected && setOpen(results.length > 0)
          }
          placeholder={
            placeholder ??
            (mode === "maritime" ? "UN/LOCODE or port name" : "IATA code or city")
          }
          style={defaultInputStyle}
          autoComplete="off"
        />
        {loading && (
          <span
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 10,
              color: "#484F58",
              fontFamily: "monospace",
            }}
          >
            ···
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#0D1420",
            border: "1px solid rgba(88,166,255,0.25)",
            borderRadius: "10px",
            zIndex: 9999,
            maxHeight: "240px",
            overflowY: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}
        >
          {results.map((r, i) => (
            <div
              key={r.code}
              onClick={() => handleSelect(r)}
              style={{
                padding: "10px 14px",
                cursor: "pointer",
                borderBottom:
                  i < results.length - 1
                    ? "1px solid rgba(255,255,255,0.04)"
                    : "none",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(88,166,255,0.08)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  fontWeight: 600,
                  color: mode === "maritime" ? "#1ECC8B" : "#58A6FF",
                  minWidth: 44,
                  flexShrink: 0,
                }}
              >
                {r.code}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: "#E6EDF3",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.label}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#484F58",
                    fontFamily: "monospace",
                  }}
                >
                  {r.region ? `${r.region} · ` : ""}
                  {r.country}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
