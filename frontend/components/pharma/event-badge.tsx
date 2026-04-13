"use client"

type EventType =
  | "ANOMALY_DETECTED"
  | "STRATEGIST_RUNNING"
  | "DIPLOMAT_RUNNING"
  | "CALL_DELIVERED"
  | "PENDING_APPROVAL"
  | "RP_APPROVED"
  | "RP_REJECTED"
  | "CASCADE_COMPLETE"
  | "AUDIT_EXPORT"

interface EventBadgeProps {
  type: EventType
}

const eventConfig: Record<EventType, { bg: string; border: string; color: string; glow?: string }> = {
  ANOMALY_DETECTED: {
    bg: "rgba(255,68,68,0.1)",
    border: "rgba(255,68,68,0.3)",
    color: "#FF4444",
    glow: "0 0 8px rgba(255,68,68,0.1)",
  },
  STRATEGIST_RUNNING: {
    bg: "rgba(88,166,255,0.1)",
    border: "rgba(88,166,255,0.3)",
    color: "#58A6FF",
    glow: "0 0 8px rgba(88,166,255,0.1)",
  },
  DIPLOMAT_RUNNING: {
    bg: "rgba(88,166,255,0.1)",
    border: "rgba(88,166,255,0.3)",
    color: "#58A6FF",
    glow: "0 0 8px rgba(88,166,255,0.1)",
  },
  CALL_DELIVERED: {
    bg: "rgba(88,166,255,0.08)",
    border: "rgba(88,166,255,0.25)",
    color: "#7EB8FF",
    glow: "0 0 8px rgba(88,166,255,0.08)",
  },
  PENDING_APPROVAL: {
    bg: "rgba(240,165,0,0.1)",
    border: "rgba(240,165,0,0.3)",
    color: "#F0A500",
    glow: "0 0 8px rgba(240,165,0,0.1)",
  },
  RP_APPROVED: {
    bg: "rgba(30,204,139,0.1)",
    border: "rgba(30,204,139,0.3)",
    color: "#1ECC8B",
    glow: "0 0 12px rgba(30,204,139,0.2)",
  },
  RP_REJECTED: {
    bg: "rgba(255,68,68,0.1)",
    border: "rgba(255,68,68,0.3)",
    color: "#FF4444",
    glow: "0 0 8px rgba(255,68,68,0.1)",
  },
  CASCADE_COMPLETE: {
    bg: "rgba(30,204,139,0.1)",
    border: "rgba(30,204,139,0.3)",
    color: "#1ECC8B",
    glow: "0 0 8px rgba(30,204,139,0.1)",
  },
  AUDIT_EXPORT: {
    bg: "rgba(139,148,158,0.1)",
    border: "rgba(139,148,158,0.3)",
    color: "#8B949E",
  },
}

export function EventBadge({ type }: EventBadgeProps) {
  const config = eventConfig[type]

  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-md"
      style={{
        background: config.bg,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: `1px solid ${config.border}`,
        boxShadow: config.glow,
      }}
    >
      <span
        className="text-[10px] uppercase tracking-wider font-medium"
        style={{
          color: config.color,
          fontFamily: "JetBrains Mono, monospace",
          letterSpacing: "0.06em",
        }}
      >
        {type.replace(/_/g, " ")}
      </span>
    </span>
  )
}

export type { EventType }
