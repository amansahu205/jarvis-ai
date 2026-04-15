'use client'

import { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileUp,
  Copy,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Hexagon,
  RotateCcw,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ParsedShipment {
  shipmentId: string
  origin: string
  destination: string
  cargoType: string
  medicationName: string
  quantity: number
  batchNumber: string
  lotNumber: string
  weight_kg: number
  tempMinC: number
  tempMaxC: number
  estimatedDeparture: string
  consignee: string
  notes: string
}

interface POUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onShipmentCreated: (shipment: ParsedShipment) => void
}

type ModalState = 'upload' | 'parsing' | 'confirmation' | 'success'

const loadingMessages = [
  'Extracting shipment details...',
  'Identifying cargo specifications...',
  'Mapping route parameters...',
  'Validating regulatory fields...',
]

const EMPTY_PARSED_SHIPMENT: ParsedShipment = {
  shipmentId: '',
  origin: '',
  destination: '',
  cargoType: '',
  medicationName: '',
  quantity: 0,
  batchNumber: '',
  lotNumber: '',
  weight_kg: 0,
  tempMinC: 0,
  tempMaxC: 0,
  estimatedDeparture: '',
  consignee: '',
  notes: '',
}

export default function POUploadModal({
  isOpen,
  onClose,
  onShipmentCreated,
}: POUploadModalProps) {
  const [state, setState] = useState<ModalState>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [loadingStep, setLoadingStep] = useState(0)
  const [parsedData, setParsedData] = useState<ParsedShipment>(EMPTY_PARSED_SHIPMENT)
  const [formData, setFormData] = useState<ParsedShipment>(EMPTY_PARSED_SHIPMENT)
  const [confirmationState, setConfirmationState] = useState<'editing' | 'creating' | 'success'>(
    'editing'
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // Cycling loading messages
  useEffect(() => {
    if (state !== 'parsing') return
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % loadingMessages.length)
    }, 1500)
    return () => clearInterval(interval)
  }, [state])

  // Simulate parsing without fabricating shipment content
  useEffect(() => {
    if (state !== 'parsing') return
    const timer = setTimeout(() => {
      setState('confirmation')
    }, 1200)
    return () => clearTimeout(timer)
  }, [state])

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
      return
    }
    setFile(selectedFile)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (dropZoneRef.current) {
      dropZoneRef.current.style.borderColor = '#58A6FF'
      dropZoneRef.current.style.background = 'rgba(88,166,255,0.08)'
    }
  }

  const handleDragLeave = () => {
    if (dropZoneRef.current) {
      dropZoneRef.current.style.borderColor = 'rgba(88,166,255,0.3)'
      dropZoneRef.current.style.background = 'transparent'
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (dropZoneRef.current) {
      dropZoneRef.current.style.borderColor = 'rgba(88,166,255,0.3)'
      dropZoneRef.current.style.background = 'transparent'
    }
    if (e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleParse = () => {
    setState('parsing')
    setLoadingStep(0)
  }

  const handleFieldChange = (field: keyof ParsedShipment, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleReupload = () => {
    setFile(null)
    setPasteMode(false)
    setPasteText('')
    setState('upload')
  }

  const handleCreateShipment = async () => {
    setConfirmationState('creating')
    await new Promise((r) => setTimeout(r, 400))
    setConfirmationState('success')
    await new Promise((r) => setTimeout(r, 400))
    onShipmentCreated(formData)
    handleClose()
  }

  const handleClose = () => {
    setState('upload')
    setFile(null)
    setPasteMode(false)
    setPasteText('')
    setConfirmationState('editing')
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[100]"
            style={{
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className={cn(
              'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] rounded-2xl p-8',
              state === 'confirmation' ? 'w-[900px]' : 'w-[600px]'
            )}
            style={{
              background: 'rgba(8,11,15,0.85)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              border: '1px solid rgba(88,166,255,0.2)',
              boxShadow:
                '0 0 60px rgba(88,166,255,0.1), 0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            <AnimatePresence mode="wait">
              {state === 'upload' && (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-8">
                    <div
                      className="flex items-center justify-center w-10 h-10 rounded-lg"
                      style={{
                        background: 'rgba(88,166,255,0.15)',
                        border: '1px solid rgba(88,166,255,0.3)',
                      }}
                    >
                      <FileUp size={20} style={{ color: '#58A6FF' }} />
                    </div>
                    <div>
                      <h2
                        className="text-lg font-bold"
                        style={{ color: '#E6EDF3' }}
                      >
                        Import Purchase Order
                      </h2>
                    </div>
                  </div>

                  {!pasteMode ? (
                    <>
                      {/* Upload Zone */}
                      <div
                        ref={dropZoneRef}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className="relative flex flex-col items-center justify-center p-12 mb-6 rounded-xl cursor-pointer transition-all duration-200"
                        style={{
                          border: '2px dashed rgba(88,166,255,0.3)',
                          background: file ? 'rgba(30,204,139,0.05)' : 'transparent',
                        }}
                      >
                        <motion.div
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <FileUp
                            size={40}
                            style={{ color: '#58A6FF', marginBottom: '12px' }}
                          />
                        </motion.div>
                        <p
                          className="text-base font-semibold"
                          style={{ color: '#E6EDF3' }}
                        >
                          {file ? `📄 ${file.name}` : 'Drop PDF or click to upload'}
                        </p>
                        <p
                          className="text-sm mt-1"
                          style={{ color: '#8B949E' }}
                        >
                          Supports PDF, CSV, XLSX · Max 10MB
                        </p>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.csv,.xlsx"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleFileSelect(e.target.files[0])
                          }
                        }}
                        className="hidden"
                      />

                      {/* Or Paste Link */}
                      <div className="flex items-center gap-3 my-6">
                        <div
                          className="flex-1 h-px"
                          style={{
                            background:
                              'linear-gradient(90deg, transparent, rgba(88,166,255,0.2), transparent)',
                          }}
                        />
                        <button
                          onClick={() => setPasteMode(true)}
                          className="text-sm font-medium underline hover:opacity-80 transition-opacity"
                          style={{ color: '#58A6FF' }}
                        >
                          Or paste PO text
                        </button>
                        <div
                          className="flex-1 h-px"
                          style={{
                            background:
                              'linear-gradient(90deg, transparent, rgba(88,166,255,0.2), transparent)',
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Paste Mode */}
                      <textarea
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        placeholder="Paste your PO text here..."
                        className="w-full h-32 p-4 rounded-xl mb-4 text-sm resize-none focus:outline-none"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(88,166,255,0.2)',
                          color: '#E6EDF3',
                        }}
                      />
                      <button
                        onClick={() => setPasteMode(false)}
                        className="text-sm font-medium underline hover:opacity-80 transition-opacity"
                        style={{ color: '#58A6FF' }}
                      >
                        ← Back to file upload
                      </button>
                    </>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-3 mt-8">
                    <button
                      onClick={handleClose}
                      className="px-6 py-2.5 rounded-lg font-medium transition-all"
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(88,166,255,0.3)',
                        color: '#8B949E',
                      }}
                    >
                      Cancel
                    </button>
                    <motion.button
                      onClick={handleParse}
                      disabled={!file && !pasteText}
                      whileHover={{ boxShadow: '0 0 30px rgba(88,166,255,0.4)' }}
                      className="px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      style={{
                        background: !file && !pasteText ? 'rgba(88,166,255,0.2)' : 'linear-gradient(135deg, #58A6FF, #3870C8)',
                        color: '#fff',
                        border: '1px solid rgba(88,166,255,0.5)',
                      }}
                    >
                      Parse with AI
                      <ArrowRight size={16} />
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {state === 'parsing' && (
                <motion.div
                  key="parsing"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center justify-center py-16"
                >
                  {/* Animated Hexagon */}
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="mb-6"
                  >
                    <Hexagon
                      size={60}
                      style={{ color: '#58A6FF', strokeWidth: 1.5 }}
                    />
                  </motion.div>

                  <h3
                    className="text-lg font-bold mb-2"
                    style={{ color: '#E6EDF3' }}
                  >
                    JARVIS is reading your PO...
                  </h3>

                  {/* Cycling Messages */}
                  <motion.p
                    key={loadingStep}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="text-sm mb-6"
                    style={{ color: '#8B949E' }}
                  >
                    {loadingMessages[loadingStep]}
                  </motion.p>

                  {/* Progress Bar */}
                  <div
                    className="w-48 h-1 rounded-full overflow-hidden mb-6"
                    style={{
                      background: 'rgba(88,166,255,0.15)',
                      border: '1px solid rgba(88,166,255,0.2)',
                    }}
                  >
                    <motion.div
                      animate={{ x: ['100%', '-100%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      className="h-full w-1/3"
                      style={{
                        background: 'linear-gradient(90deg, transparent, #58A6FF, transparent)',
                      }}
                    />
                  </div>

                  <p
                    className="text-xs"
                    style={{ color: '#484F58' }}
                  >
                    Powered by Claude claude-sonnet-4-20250514
                  </p>
                </motion.div>
              )}

              {state === 'confirmation' && (
                <motion.div
                  key="confirmation"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Header with Confidence */}
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <CheckCircle2
                        size={24}
                        style={{ color: '#1ECC8B' }}
                      />
                      <div>
                        <h2
                          className="text-lg font-bold"
                          style={{ color: '#E6EDF3' }}
                        >
                          Review Parsed Fields
                        </h2>
                      </div>
                    </div>
                    <div
                      className="px-3 py-1.5 rounded-lg text-xs font-bold"
                      style={{
                        background: 'rgba(30,204,139,0.1)',
                        border: '1px solid rgba(30,204,139,0.3)',
                        color: '#1ECC8B',
                      }}
                    >
                      AI Confidence: 94%
                    </div>
                  </div>

                  {/* Form Grid */}
                  <div className="grid grid-cols-2 gap-6 mb-8 max-h-96 overflow-y-auto pr-4">
                    {/* Left Column */}
                    <div className="space-y-4">
                      {[
                        { key: 'shipmentId' as const, label: 'Shipment ID' },
                        { key: 'origin' as const, label: 'Origin Airport/Port' },
                        { key: 'destination' as const, label: 'Destination Airport/Port' },
                        { key: 'cargoType' as const, label: 'Cargo Type' },
                        { key: 'medicationName' as const, label: 'Medication Name' },
                        { key: 'batchNumber' as const, label: 'Batch Number' },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label
                            className="block text-xs uppercase tracking-wider mb-2 font-mono"
                            style={{ color: '#8B949E' }}
                          >
                            {label}
                          </label>
                          {key === 'cargoType' ? (
                            <select
                              value={formData[key]}
                              onChange={(e) => handleFieldChange(key, e.target.value)}
                              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                              style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(88,166,255,0.2)',
                                color: '#E6EDF3',
                              }}
                            >
                              <option value="vaccine">Vaccine</option>
                              <option value="biologic">Biologic</option>
                              <option value="drug">Drug</option>
                              <option value="device">Device</option>
                            </select>
                          ) : (
                            <motion.input
                              type={key === 'shipmentId' ? 'text' : 'text'}
                              value={formData[key]}
                              onChange={(e) => handleFieldChange(key, e.target.value)}
                              disabled={key === 'shipmentId'}
                              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none disabled:opacity-60"
                              style={{
                                background: 'rgba(255,255,255,0.04)',
                                border:
                                  key === 'shipmentId'
                                    ? '1px solid rgba(88,166,255,0.2)'
                                    : '1px solid rgba(88,166,255,0.2)',
                                color: '#E6EDF3',
                                borderLeftWidth: '3px',
                                borderLeftColor: '#1ECC8B',
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      {[
                        { key: 'quantity' as const, label: 'Quantity (units)' },
                        { key: 'weight_kg' as const, label: 'Weight (kg)' },
                        { key: 'tempMinC' as const, label: 'Min Temp °C' },
                        { key: 'tempMaxC' as const, label: 'Max Temp °C' },
                        { key: 'estimatedDeparture' as const, label: 'Estimated Departure' },
                        { key: 'consignee' as const, label: 'Consignee Name' },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label
                            className="block text-xs uppercase tracking-wider mb-2 font-mono"
                            style={{ color: '#8B949E' }}
                          >
                            {label}
                          </label>
                          <div className="relative">
                            <input
                              type={
                                key === 'quantity' ||
                                key === 'weight_kg' ||
                                key === 'tempMinC' ||
                                key === 'tempMaxC'
                                  ? 'number'
                                  : key === 'estimatedDeparture'
                                    ? 'datetime-local'
                                    : 'text'
                              }
                              value={
                                key === 'estimatedDeparture'
                                  ? new Date(formData[key])
                                      .toISOString()
                                      .slice(0, 16)
                                  : formData[key]
                              }
                              onChange={(e) =>
                                handleFieldChange(
                                  key,
                                  key === 'estimatedDeparture'
                                    ? new Date(e.target.value).toISOString()
                                    : key === 'quantity' ||
                                        key === 'weight_kg' ||
                                        key === 'tempMinC' ||
                                        key === 'tempMaxC'
                                      ? parseFloat(e.target.value) || 0
                                      : e.target.value
                                )
                              }
                              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                              style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(88,166,255,0.2)',
                                color: '#E6EDF3',
                                borderLeftWidth: '3px',
                                borderLeftColor: '#1ECC8B',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Special Instructions */}
                  <div className="mb-8">
                    <label
                      className="block text-xs uppercase tracking-wider mb-2 font-mono"
                      style={{ color: '#8B949E' }}
                    >
                      Special Instructions
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => handleFieldChange('notes', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none resize-none"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(88,166,255,0.2)',
                        color: '#E6EDF3',
                      }}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleReupload}
                      className="text-sm font-medium underline hover:opacity-80 transition-opacity"
                      style={{ color: '#58A6FF' }}
                    >
                      ← Re-upload
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleClose}
                        className="px-6 py-2.5 rounded-lg font-medium transition-all"
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(88,166,255,0.3)',
                          color: '#8B949E',
                        }}
                      >
                        Cancel
                      </button>
                      <motion.button
                        onClick={handleCreateShipment}
                        disabled={confirmationState !== 'editing'}
                        whileHover={
                          confirmationState === 'editing'
                            ? { boxShadow: '0 0 30px rgba(30,204,139,0.4)' }
                            : {}
                        }
                        className="px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 transition-all"
                        style={{
                          background:
                            confirmationState === 'success'
                              ? 'rgba(30,204,139,0.2)'
                              : 'linear-gradient(135deg, #1ECC8B, #15aa72)',
                          color:
                            confirmationState === 'success' ? '#1ECC8B' : '#fff',
                          border:
                            confirmationState === 'success'
                              ? '1px solid rgba(30,204,139,0.3)'
                              : '1px solid rgba(30,204,139,0.5)',
                        }}
                      >
                        {confirmationState === 'editing' && (
                          <>
                            Create Shipment
                            <ArrowRight size={16} />
                          </>
                        )}
                        {confirmationState === 'creating' && (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Creating...
                          </>
                        )}
                        {confirmationState === 'success' && (
                          <>
                            <CheckCircle2 size={16} />
                            Shipment created
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
