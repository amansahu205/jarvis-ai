"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Download, X, BadgeCheck, ExternalLink } from "lucide-react"
import { EventBadge, type EventType } from "./event-badge"

interface AuditEvent {
  id: string
  timestamp: string
  eventType: EventType
  actor: string
  actorRole?: string
  shipment: string
  details: string
  actionLink?: string
  actionLabel?: string
  isHighlighted?: boolean
}

const mockAuditEvents: AuditEvent[] = [
  {
    id: "1",
    timestamp: "02:12:34",
    eventType: "ANOMALY_DETECTED",
    actor: "Sentinel Agent",
    shipment: "SHP-2026-0441",
    details: "CRITICAL_L1 · Temp 6.8°C · +0.5°C/hr",
  },
  {
    id: "2",
    timestamp: "02:12:47",
    eventType: "STRATEGIST_RUNNING",
    actor: "Strategist Agent",
    shipment: "SHP-2026-0441",
    details: "Evaluating 3 candidate reroutes...",
  },
  {
    id: "3",
    timestamp: "02:13:02",
    eventType: "DIPLOMAT_RUNNING",
    actor: "Diplomat Agent",
    shipment: "SHP-2026-0441",
    details: "Drafting 3 communication artifacts...",
  },
  {
    id: "4",
    timestamp: "02:14:00",
    eventType: "CALL_DELIVERED",
    actor: "ElevenLabs Voice Agent",
    shipment: "SHP-2026-0441",
    details: "Call to Dr. Aris · Duration 1m 24s",
    actionLink: "#",
    actionLabel: "Transcript",
  },
  {
    id: "5",
    timestamp: "02:14:15",
    eventType: "PENDING_APPROVAL",
    actor: "Compliance Cop",
    shipment: "SHP-2026-0441",
    details: "Crisis Ticket #TKT-2026-0441 · Awaiting RP",
  },
  {
    id: "6",
    timestamp: "02:18:42",
    eventType: "RP_APPROVED",
    actor: "Dr. Aris Papadopoulos",
    actorRole: "RP",
    shipment: "SHP-2026-0441",
    details: "Option 1 · Port Said Diversion · Regulations: EDA-442, WHO-TRS-961",
    actionLink: "#",
    actionLabel: "View",
    isHighlighted: true,
  },
  {
    id: "7",
    timestamp: "02:18:45",
    eventType: "CASCADE_COMPLETE",
    actor: "System",
    shipment: "SHP-2026-0441",
    details: "Hospital email sent · ERP updated · Insurance filed",
  },
  {
    id: "8",
    timestamp: "02:22:10",
    eventType: "AUDIT_EXPORT",
    actor: "Dr. Aris Papadopoulos",
    shipment: "SHP-2026-0441",
    details: "PDF audit export generated",
  },
]

const columns = ["TIMESTAMP", "EVENT TYPE", "ACTOR", "SHIPMENT", "DETAILS", "ACTIONS"]

export function AuditLogPage() {
  const [shipmentFilter, setShipmentFilter] = useState("SHP-2026-0441")
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("")
  const [dateFilter, setDateFilter] = useState("Apr 11, 2026")

  const filteredEvents = mockAuditEvents.filter((event) => {
    if (shipmentFilter && !event.shipment.toLowerCase().includes(shipmentFilter.toLowerCase())) {
      return false
    }
    if (eventTypeFilter && event.eventType !== eventTypeFilter) {
      return false
    }
    return true
  })

  const clearFilters = () => {
    setShipmentFilter("")
    setEventTypeFilter("")
    setDateFilter("")
  }

  return (
    <div
      className="min-h-screen pt-20 pb-8 px-8"
      style={{
        background: `radial-gradient(ellipse 800px 300px at 50% 0%, rgba(88,166,255,0.06), transparent), #080B0F`,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1
            className="text-[28px] font-extrabold"
            style={{ color: "#E6EDF3", fontFamily: "Inter, sans-serif" }}
          >
            AUDIT LOG
          </h1>
          <p
            className="text-[13px] mt-1"
            style={{ color: "#8B949E", fontFamily: "Inter, sans-serif" }}
          >
            Immutable event trail
          </p>
          <p
            className="text-[11px] mt-1"
            style={{ color: "#484F58", fontFamily: "JetBrains Mono, monospace" }}
          >
            21 CFR Part 11 · Append-only ledger
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200"
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(88,166,255,0.3)",
            color: "#58A6FF",
            fontFamily: "Inter, sans-serif",
          }}
        >
          <Download size={16} />
          Export Full Log
        </button>
      </div>

      {/* Filter bar */}
      <div
        className="flex items-center gap-4 p-3 px-5 rounded-2xl mb-4"
        style={{
          background: "rgba(255,255,255,0.02)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Shipment ID */}
        <input
          type="text"
          value={shipmentFilter}
          onChange={(e) => setShipmentFilter(e.target.value)}
          placeholder="Shipment ID"
          className="w-[200px] h-10 px-3 rounded-lg text-[12px] outline-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#E6EDF3",
            fontFamily: "JetBrains Mono, monospace",
          }}
        />

        {/* Event Type */}
        <select
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value)}
          className="w-[180px] h-10 px-3 rounded-lg text-[12px] outline-none appearance-none cursor-pointer"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: eventTypeFilter ? "#E6EDF3" : "#8B949E",
            fontFamily: "Inter, sans-serif",
          }}
        >
          <option value="">All Event Types</option>
          <option value="ANOMALY_DETECTED">ANOMALY_DETECTED</option>
          <option value="STRATEGIST_RUNNING">STRATEGIST_RUNNING</option>
          <option value="DIPLOMAT_RUNNING">DIPLOMAT_RUNNING</option>
          <option value="CALL_DELIVERED">CALL_DELIVERED</option>
          <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
          <option value="RP_APPROVED">RP_APPROVED</option>
          <option value="CASCADE_COMPLETE">CASCADE_COMPLETE</option>
          <option value="AUDIT_EXPORT">AUDIT_EXPORT</option>
        </select>

        {/* Date */}
        <input
          type="text"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          placeholder="Date"
          className="w-[160px] h-10 px-3 rounded-lg text-[12px] outline-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#E6EDF3",
            fontFamily: "Inter, sans-serif",
          }}
        />

        {/* Clear filters */}
        <button
          onClick={clearFilters}
          className="text-[13px] transition-colors duration-150"
          style={{ color: "#8B949E", fontFamily: "Inter, sans-serif" }}
        >
          Clear Filters
        </button>

        {/* Results count */}
        <div className="flex-1" />
        <span
          className="text-[12px]"
          style={{ color: "#8B949E", fontFamily: "JetBrains Mono, monospace" }}
        >
          {filteredEvents.length} events
        </span>
      </div>

      {/* Table */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: "rgba(8,11,15,0.7)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(88,166,255,0.1)",
          boxShadow:
            "0 0 0 1px rgba(88,166,255,0.05), 0 8px 40px rgba(0,0,0,0.6), 0 0 80px rgba(88,166,255,0.04)",
        }}
      >
        {/* Top shimmer */}
        <div
          className="absolute top-0 left-[15%] w-[70%] h-px"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(88,166,255,0.5), transparent)",
          }}
        />

        {/* Header row */}
        <div
          className="grid items-center px-5 h-11"
          style={{
            gridTemplateColumns: "100px 160px 180px 140px 1fr 100px",
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(8px)",
            borderBottom: "1px solid rgba(88,166,255,0.1)",
          }}
        >
          {columns.map((col) => (
            <span
              key={col}
              className="text-[10px] uppercase tracking-wider"
              style={{
                color: "#484F58",
                fontFamily: "JetBrains Mono, monospace",
                letterSpacing: "0.08em",
              }}
            >
              {col}
            </span>
          ))}
        </div>

        {/* Data rows */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.04 } },
          }}
        >
          {filteredEvents.map((event) => (
            <motion.div
              key={event.id}
              variants={{
                hidden: { x: -8, opacity: 0 },
                visible: { x: 0, opacity: 1 },
              }}
              transition={{ duration: 0.3 }}
              className="grid items-center px-5 h-14 group transition-all duration-150"
              style={{
                gridTemplateColumns: "100px 160px 180px 140px 1fr 100px",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                background: event.isHighlighted ? "rgba(30,204,139,0.04)" : "transparent",
                borderLeft: event.isHighlighted ? "3px solid #1ECC8B" : "3px solid transparent",
                boxShadow: event.isHighlighted ? "inset 3px 0 12px rgba(30,204,139,0.06)" : "none",
              }}
            >
              {/* Timestamp */}
              <span
                className="text-[12px]"
                style={{ color: "#8B949E", fontFamily: "JetBrains Mono, monospace" }}
              >
                {event.timestamp}
              </span>

              {/* Event Type */}
              <div>
                <EventBadge type={event.eventType} />
              </div>

              {/* Actor */}
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[12px]"
                  style={{
                    color: event.isHighlighted ? "#E6EDF3" : "#8B949E",
                    fontFamily: "Inter, sans-serif",
                    fontWeight: event.isHighlighted ? 600 : 400,
                  }}
                >
                  {event.actor}
                </span>
                {event.actorRole && (
                  <BadgeCheck size={12} style={{ color: "#1ECC8B" }} />
                )}
              </div>

              {/* Shipment */}
              <span
                className="text-[12px]"
                style={{ color: "#E6EDF3", fontFamily: "JetBrains Mono, monospace" }}
              >
                {event.shipment}
              </span>

              {/* Details */}
              <span
                className="text-[12px] truncate pr-4"
                style={{ color: "#8B949E", fontFamily: "Inter, sans-serif" }}
              >
                {event.details}
              </span>

              {/* Actions */}
              <div>
                {event.actionLink && (
                  <a
                    href={event.actionLink}
                    className="flex items-center gap-1 text-[11px] transition-colors duration-150"
                    style={{ color: "#58A6FF", fontFamily: "Inter, sans-serif" }}
                  >
                    {event.actionLabel}
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Footer */}
        <div
          className="flex items-center justify-center py-3 px-5"
          style={{
            background: "rgba(255,255,255,0.01)",
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <span
            className="text-[11px]"
            style={{ color: "#484F58", fontFamily: "JetBrains Mono, monospace" }}
          >
            All {filteredEvents.length} events for {shipmentFilter || "all shipments"} · Append-only · No records modified or deleted
          </span>
        </div>
      </div>
    </div>
  )
}
