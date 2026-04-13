'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Workflow,
  BadgeCheck,
  Clock,
  PhoneIncoming,
  CheckCircle2,
  FileText,
  Download,
  ShieldCheck,
} from 'lucide-react'

interface CascadeActionsPanelProps {
  isOpen: boolean
  onClose: () => void
  ticketId: string
  shipmentId: string
  isApproved: boolean
  approvedAt?: string
  approvedBy?: string
}

export function CascadeActionsPanel({
  isOpen,
  onClose,
  ticketId,
  shipmentId,
  isApproved,
  approvedAt = '2026-04-11T02:26:44Z',
  approvedBy = 'Dr. Aris Papadopoulos',
}: CascadeActionsPanelProps) {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-190 bg-black/50 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: 520, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 520, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
            className="fixed right-0 top-0 bottom-0 w-[520px] z-200 overflow-hidden"
            style={{
              background: 'rgba(8,11,15,0.97)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
            }}
          >
            {/* Top shimmer */}
            <div
              className="absolute left-0 top-0 w-px h-full"
              style={{
                background: 'linear-gradient(180deg, transparent, rgba(88,166,255,0.4), transparent)',
              }}
            />

            {/* Border */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                border: '1px solid rgba(88,166,255,0.2)',
                boxShadow: '-20px 0 60px rgba(0,0,0,0.7), -1px 0 0 rgba(88,166,255,0.08)',
              }}
            />

            {/* Header */}
            <div
              className="sticky top-0 h-16 flex items-center justify-between px-6 z-10"
              style={{
                background: 'rgba(8,11,15,0.9)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(88,166,255,0.1)',
              }}
            >
              <div className="flex items-center gap-2">
                <Workflow size={18} style={{ color: '#58A6FF' }} />
                <span
                  style={{
                    fontSize: '13px',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: '#58A6FF',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginLeft: '8px',
                  }}
                >
                  CASCADE ACTIONS
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: '#484F58',
                    marginLeft: '12px',
                  }}
                >
                  {ticketId}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Status chip */}
                <div
                  className="flex items-center gap-1 px-3 py-1 rounded"
                  style={{
                    background: isApproved ? 'rgba(30,204,139,0.12)' : 'rgba(240,165,0,0.12)',
                    color: isApproved ? '#1ECC8B' : '#F0A500',
                  }}
                >
                  {isApproved ? (
                    <BadgeCheck size={12} />
                  ) : (
                    <Clock size={12} />
                  )}
                  <span style={{ fontSize: '10px', fontWeight: 600, marginLeft: '4px' }}>
                    {isApproved ? 'APPROVED' : 'PENDING'}
                  </span>
                </div>

                {/* Close button */}
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <X size={18} style={{ color: '#8B949E' }} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div
              className="overflow-y-auto"
              style={{
                height: 'calc(100vh - 64px)',
                padding: '0 24px 24px',
                scrollbarWidth: 'thin',
              }}
            >
              {/* SECTION 1: Voice Call */}
              <div style={{ marginTop: '20px' }}>
                <div
                  style={{
                    fontSize: '9px',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: '#484F58',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: '8px',
                  }}
                >
                  ElevenLabs Voice Alert
                </div>

                {/* Call card */}
                <div
                  className="rounded-lg p-4 mb-5"
                  style={{
                    background: 'rgba(30,204,139,0.05)',
                    border: '1px solid rgba(30,204,139,0.2)',
                    borderLeft: '3px solid #1ECC8B',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <PhoneIncoming size={16} style={{ color: '#1ECC8B' }} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#E6EDF3' }}>
                        Call delivered
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono, monospace',
                        color: '#8B949E',
                      }}
                    >
                      02:14 AM
                    </span>
                  </div>

                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#E6EDF3', marginBottom: '4px' }}>
                      Dr. Aris Papadopoulos
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono, monospace',
                        color: '#8B949E',
                        marginBottom: '2px',
                      }}
                    >
                      Duration: 1m 24s
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono, monospace',
                        color: '#484F58',
                      }}
                    >
                      +1 (202) 555-0147
                    </div>
                  </div>

                  {/* Transcript */}
                  <div
                    className="rounded-lg p-3.5 mt-3"
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      maxHeight: '220px',
                      overflowY: 'auto',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '9px',
                        fontFamily: 'JetBrains Mono, monospace',
                        color: '#484F58',
                        textTransform: 'uppercase',
                        marginBottom: '10px',
                      }}
                    >
                      Call Transcript
                    </div>

                    {[
                      {
                        speaker: 'SYSTEM',
                        text: 'Dr. Aris, this is PharmaGuard AI. Shipment SHP-2026-0441 in the Suez Canal has a critical refrigeration failure. Internal temperature is rising at 0.5°C per hour. Time to spoilage: approximately 9 hours. The Strategist has identified an emergency diversion to Port Said. Can you confirm you are available to review?',
                        color: '#58A6FF',
                        textColor: '#8B949E',
                      },
                      {
                        speaker: 'DR. ARIS',
                        text: 'Yes, opening the dashboard now.',
                        color: '#1ECC8B',
                        textColor: '#E6EDF3',
                      },
                      {
                        speaker: 'SYSTEM',
                        text: 'Thank you. Your approval dashboard is ready at pharmaguard.ai/crisis/TKT-2026-0441. Approval requires your digital signature — verbal confirmation is not sufficient.',
                        color: '#58A6FF',
                        textColor: '#8B949E',
                      },
                      {
                        speaker: 'DR. ARIS',
                        text: 'Understood.',
                        color: '#1ECC8B',
                        textColor: '#E6EDF3',
                      },
                    ].map((msg, idx) => (
                      <div key={idx} style={{ marginBottom: '10px', fontSize: '12px' }}>
                        <div
                          style={{
                            fontSize: '9px',
                            fontFamily: 'JetBrains Mono, monospace',
                            textTransform: 'uppercase',
                            color: msg.color,
                            marginBottom: '2px',
                          }}
                        >
                          {msg.speaker}
                        </div>
                        <div style={{ color: msg.textColor, lineHeight: 1.6 }}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      fontSize: '9px',
                      color: '#484F58',
                      fontStyle: 'italic',
                      textAlign: 'center',
                      marginTop: '8px',
                    }}
                  >
                    Stored in audit ledger · Immutable record
                  </div>
                </div>

                <div
                  className="my-5"
                  style={{
                    height: '1px',
                    background: 'rgba(255,255,255,0.04)',
                  }}
                />
              </div>

              {/* SECTION 2: Hospital Email */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div
                    style={{
                      fontSize: '9px',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#484F58',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    Hospital Notification Email
                  </div>
                  <div
                    className="flex items-center gap-1 px-2 py-0.5 rounded"
                    style={{
                      background: isApproved ? 'rgba(30,204,139,0.12)' : 'rgba(240,165,0,0.12)',
                      color: isApproved ? '#1ECC8B' : '#F0A500',
                      fontSize: '9px',
                      fontWeight: 600,
                    }}
                  >
                    <CheckCircle2 size={10} />
                    {isApproved ? 'SENT' : 'DRAFT'}
                  </div>
                </div>

                {/* Email card */}
                <div
                  className="rounded-lg overflow-hidden mb-5"
                  style={{
                    background: 'rgba(8,11,15,0.8)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {/* Email header */}
                  <div
                    className="p-4"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      backdropFilter: 'blur(8px)',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: '#484F58', marginBottom: '6px' }}>
                      From:{' '}
                      <span
                        style={{
                          fontSize: '11px',
                          fontFamily: 'JetBrains Mono, monospace',
                          color: '#8B949E',
                        }}
                      >
                        alerts@pharmaguard.ai
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#484F58', marginBottom: '6px' }}>
                      To:{' '}
                      <span
                        style={{
                          fontSize: '11px',
                          fontFamily: 'JetBrains Mono, monospace',
                          color: '#58A6FF',
                          cursor: 'pointer',
                        }}
                      >
                        scheduling@frankfurt-university-hospital.de
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#484F58', marginBottom: '6px' }}>
                      Subject:{' '}
                      <span style={{ color: '#E6EDF3', fontSize: '11px' }}>
                        URGENT: Shipment SHP-2026-0441 — Delay Notification
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#484F58' }}>
                      {isApproved ? 'Sent' : 'Draft generated'}:{' '}
                      <span
                        style={{
                          fontSize: '11px',
                          fontFamily: 'JetBrains Mono, monospace',
                          color: '#8B949E',
                        }}
                      >
                        Apr 11, 2026 02:28 AM UTC
                      </span>
                    </div>
                  </div>

                  {/* Email body */}
                  <div className="p-4" style={{ background: 'rgba(13,17,23,0.6)' }}>
                    <div
                      style={{
                        fontSize: '13px',
                        color: '#E6EDF3',
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      Dear Frankfurt University Hospital Scheduling Team,

We are writing to notify you of an unexpected delay affecting Shipment SHP-2026-0441, transporting MMR Vaccine (500 doses) scheduled for delivery to your facility.

{/* Delay details box */}
                    </div>
                    <div
                      className="my-3 p-3.5 rounded"
                      style={{
                        background: 'rgba(255,68,68,0.06)',
                        borderLeft: '3px solid rgba(255,68,68,0.3)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '12px',
                          fontFamily: 'JetBrains Mono, monospace',
                          color: '#8B949E',
                          lineHeight: 1.6,
                        }}
                      >
                        Original ETA:    Apr 12, 2026 — 14:00 CET
                        <br />
                        <span style={{ color: '#F0A500' }}>
                          Revised ETA:     Apr 13, 2026 — 04:30 CET
                        </span>
                        <br />
                        Delay Reason:    Refrigeration unit failure — emergency rerouting in progress
                        <br />
                        New Route:       Port Said Emergency Diversion → Air Freight → FRA
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: '13px',
                        color: '#E6EDF3',
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                        marginTop: '12px',
                      }}
                    >
We recommend rescheduling patient appointments that depend on this shipment by approximately 14 hours. The cargo will be maintained within the required 2–8°C temperature range throughout the emergency rerouting process.

A temperature excursion report will be filed with the FDA within 24 hours per 21 CFR Part 211 requirements. Full cold-chain documentation will accompany delivery.

For questions, contact our logistics team at +1 (800) PHARMA-24.

PharmaGuard AI Crisis Response System
Authorized by: Dr. Aris Papadopoulos, RP
Ticket: TKT-2026-0441 · Audit ref: AUD-2026-0441-006
                    </div>
                  </div>
                </div>

                <div
                  className="my-5"
                  style={{
                    height: '1px',
                    background: 'rgba(255,255,255,0.04)',
                  }}
                />
              </div>

              {/* SECTION 3: ERP */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div
                    style={{
                      fontSize: '9px',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#484F58',
                      textTransform: 'uppercase',
                    }}
                  >
                    ERP Inventory Update
                  </div>
                  <div
                    className="px-2 py-0.5 rounded"
                    style={{
                      background: isApproved ? 'rgba(30,204,139,0.12)' : 'rgba(240,165,0,0.12)',
                      color: isApproved ? '#1ECC8B' : '#F0A500',
                      fontSize: '9px',
                      fontWeight: 600,
                    }}
                  >
                    {isApproved ? 'POSTED' : 'QUEUED'}
                  </div>
                </div>

                {/* ERP card */}
                <div
                  className="rounded-lg overflow-hidden mb-5"
                  style={{
                    background: 'rgba(8,11,15,0.8)',
                    border: '1px solid rgba(88,166,255,0.12)',
                  }}
                >
                  {/* ERP header */}
                  <div
                    className="p-4 flex items-center justify-between"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '11px',
                          fontFamily: 'JetBrains Mono, monospace',
                          color: '#58A6FF',
                        }}
                      >
                        POST /api/v2/shipments/update
                      </div>
                      <div
                        style={{
                          fontSize: '10px',
                          color: '#484F58',
                          marginTop: '4px',
                        }}
                      >
                        SAP ERP Integration · Endpoint v2.1
                      </div>
                    </div>
                    <div
                      className="px-2 py-1 rounded"
                      style={{
                        background: isApproved ? 'rgba(30,204,139,0.12)' : 'rgba(240,165,0,0.12)',
                        color: isApproved ? '#1ECC8B' : '#F0A500',
                        fontSize: '10px',
                        fontWeight: 600,
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      {isApproved ? '200 OK' : 'PENDING'}
                    </div>
                  </div>

                  {/* JSON body */}
                  <div
                    className="p-3.5"
                    style={{
                      fontSize: '12px',
                      fontFamily: 'JetBrains Mono, monospace',
                      lineHeight: 1.6,
                      color: '#484F58',
                      overflowX: 'auto',
                    }}
                  >
                    <span style={{ color: '#484F58' }}>{'{'}</span>
                    <br />
                    <span style={{ color: '#58A6FF' }}>
                      "shipment_id"
                    </span>
                    <span>: </span>
                    <span style={{ color: '#1ECC8B' }}>"SHP-2026-0441"</span>
                    <span>,</span>
                    <br />
                    <span style={{ color: '#58A6FF' }}>"status"</span>
                    <span>: </span>
                    <span style={{ color: '#1ECC8B' }}>"REROUTED_EMERGENCY"</span>
                    <span>,</span>
                    <br />
                    <span style={{ color: '#58A6FF' }}>"updated_at"</span>
                    <span>: </span>
                    <span style={{ color: '#1ECC8B' }}>"2026-04-11T02:28:00Z"</span>
                    <span>,</span>
                    <br />
                    <span style={{ color: '#58A6FF' }}>"revised_eta"</span>
                    <span>: </span>
                    <span style={{ color: '#1ECC8B' }}>"2026-04-13T04:30:00Z"</span>
                    <span>,</span>
                    <br />
                    <span style={{ color: '#58A6FF' }}>"delay_hours"</span>
                    <span>: </span>
                    <span style={{ color: '#F0A500' }}>14.5</span>
                    <span>,</span>
                    <br />
                    <span style={{ color: '#58A6FF' }}>"new_route"</span>
                    <span>: </span>
                    <span style={{ color: '#1ECC8B' }}>"PORT_SAID_DIVERSION"</span>
                    <span>,</span>
                    <br />
                    <span style={{ color: '#58A6FF' }}>"temperature_range"</span>
                    <span>: </span>
                    <span style={{ color: '#484F58' }}>{'{'}</span>
                    <br />
                    <span style={{ color: '#58A6FF', marginLeft: '20px' }}>
                      "required_min"
                    </span>
                    <span>: </span>
                    <span style={{ color: '#F0A500' }}>2</span>
                    <span>,</span>
                    <br />
                    <span style={{ color: '#58A6FF', marginLeft: '20px' }}>
                      "current"
                    </span>
                    <span>: </span>
                    <span style={{ color: '#F0A500' }}>7.4</span>
                    <br />
                    <span style={{ color: '#484F58' }}>{'}'}</span>
                    <span>,</span>
                    <br />
                    <span style={{ color: '#58A6FF' }}>"authorized_by"</span>
                    <span>: </span>
                    <span style={{ color: '#1ECC8B' }}>"DR_ARIS_PAPADOPOULOS"</span>
                    <br />
                    <span style={{ color: '#484F58' }}>{'}'}</span>
                  </div>
                </div>

                <div
                  className="my-5"
                  style={{
                    height: '1px',
                    background: 'rgba(255,255,255,0.04)',
                  }}
                />
              </div>

              {/* SECTION 4: Insurance */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div
                    style={{
                      fontSize: '9px',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#484F58',
                      textTransform: 'uppercase',
                    }}
                  >
                    Insurance Pre-fill
                  </div>
                  <div
                    className="px-2 py-0.5 rounded"
                    style={{
                      background: isApproved ? 'rgba(30,204,139,0.12)' : 'rgba(240,165,0,0.12)',
                      color: isApproved ? '#1ECC8B' : '#F0A500',
                      fontSize: '9px',
                      fontWeight: 600,
                    }}
                  >
                    {isApproved ? 'FILED' : 'DRAFT'}
                  </div>
                </div>

                {/* Insurance card */}
                <div
                  className="rounded-lg overflow-hidden mb-5"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {/* Insurance header */}
                  <div
                    className="p-4"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      backdropFilter: 'blur(8px)',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <FileText size={14} style={{ color: '#8B949E', marginTop: '2px' }} />
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#E6EDF3' }}>
                          Cargo Spoilage Risk Claim — Pre-fill
                        </div>
                        <div
                          style={{
                            fontSize: '10px',
                            fontFamily: 'JetBrains Mono, monospace',
                            color: '#8B949E',
                            marginTop: '2px',
                          }}
                        >
                          Policy #: PHARM-2026-INT-8841
                        </div>
                      </div>
                    </div>
                    {isApproved ? (
                      <div
                        style={{
                          fontSize: '10px',
                          fontFamily: 'JetBrains Mono, monospace',
                          color: '#8B949E',
                          textAlign: 'right',
                        }}
                      >
                        Filed: Apr 11, 2026 02:28 AM UTC
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: '10px',
                          fontFamily: 'JetBrains Mono, monospace',
                          color: '#F0A500',
                          textAlign: 'right',
                        }}
                      >
                        Status: AWAITING APPROVAL
                      </div>
                    )}
                  </div>

                  {/* Insurance body */}
                  <div className="p-4">
                    {[
                      { label: 'CLAIM TYPE', value: 'Pharmaceutical Cold-Chain — Refrigeration Failure' },
                      { label: 'SHIPMENT ID', value: 'SHP-2026-0441', mono: true },
                      { label: 'CARGO VALUE', value: '$248,500 USD', color: '#F0A500' },
                      { label: 'ANOMALY TIME', value: '2026-04-11 03:30 UTC', mono: true },
                      {
                        label: 'CURRENT TEMP',
                        value: '7.4°C (safe range: 2–8°C)',
                        mono: true,
                        color: '#F0A500',
                      },
                      { label: 'TREND', value: '+0.6°C/hr — approaching threshold', color: '#FF4444' },
                      { label: 'SPOILAGE RISK', value: '78% probability if no intervention', color: '#FF4444' },
                      { label: 'AUTHORIZED BY', value: 'Dr. Aris Papadopoulos — GDP Responsible Person' },
                      { label: 'TICKET REF', value: 'TKT-2026-0441', mono: true },
                    ].map((field, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between py-2"
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '9px',
                            fontFamily: 'JetBrains Mono, monospace',
                            color: '#484F58',
                            textTransform: 'uppercase',
                          }}
                        >
                          {field.label}
                        </span>
                        <span
                          style={{
                            fontSize: '12px',
                            fontFamily: field.mono ? 'JetBrains Mono, monospace' : 'Inter, sans-serif',
                            color: field.color || '#E6EDF3',
                          }}
                        >
                          {field.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Download button */}
                  <div
                    className="px-4 py-3 flex items-center justify-center gap-2 cursor-pointer hover:bg-white/4 transition-colors"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <Download size={14} style={{ color: '#58A6FF' }} />
                    <span style={{ fontSize: '12px', color: '#58A6FF', fontWeight: 500 }}>
                      Download Pre-fill PDF
                    </span>
                  </div>
                </div>

                <div
                  className="my-5"
                  style={{
                    height: '1px',
                    background: 'rgba(255,255,255,0.04)',
                  }}
                />
              </div>

              {/* SECTION 5: Post-approval cascade (only if approved) */}
              {isApproved && (
                <div>
                  <div
                    style={{
                      fontSize: '9px',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#484F58',
                      textTransform: 'uppercase',
                      marginBottom: '8px',
                    }}
                  >
                    Cascade Execution Log
                  </div>

                  {/* Execution rows */}
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                      visible: {
                        transition: {
                          staggerChildren: 0.15,
                        },
                      },
                    }}
                    className="space-y-1"
                  >
                    {[
                      { action: 'Hospital notification sent', time: '02:28:01 AM' },
                      { action: 'ERP inventory updated', time: '02:28:03 AM' },
                      { action: 'Insurance pre-fill filed', time: '02:28:05 AM' },
                      { action: 'Audit log sealed', time: '02:28:07 AM' },
                    ].map((row, idx) => (
                      <motion.div
                        key={idx}
                        variants={{
                          hidden: { y: 8, opacity: 0 },
                          visible: { y: 0, opacity: 1 },
                        }}
                        className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg mb-1"
                        style={{
                          background: 'rgba(30,204,139,0.05)',
                          border: '1px solid rgba(30,204,139,0.15)',
                        }}
                      >
                        <CheckCircle2 size={14} style={{ color: '#1ECC8B' }} />
                        <span style={{ fontSize: '12px', fontWeight: 500, color: '#E6EDF3', flex: 1 }}>
                          {row.action}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontFamily: 'JetBrains Mono, monospace',
                            color: '#484F58',
                          }}
                        >
                          {row.time}
                        </span>
                      </motion.div>
                    ))}
                  </motion.div>

                  {/* Summary box */}
                  <div
                    className="mt-3 p-3.5 rounded-lg flex items-start gap-3"
                    style={{
                      background: 'rgba(30,204,139,0.06)',
                      border: '1px solid rgba(30,204,139,0.2)',
                    }}
                  >
                    <ShieldCheck size={16} style={{ color: '#1ECC8B', marginTop: '2px' }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#1ECC8B' }}>
                        Cascade complete · All actions executed · Audit trail sealed
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          fontFamily: 'JetBrains Mono, monospace',
                          color: '#8B949E',
                          marginTop: '6px',
                        }}
                      >
                        Approved by {approvedBy} at {formatTime(approvedAt)} UTC
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
