// Landing page mock data

export const AGENTS = [
  {
    id: 'ingest',
    name: 'Ingest',
    role: 'Document Parser',
    description: 'Parses PO docs, BOLs, and customs forms in seconds using OCR + NLP',
    color: '#58A6FF',
    icon: 'FileText',
  },
  {
    id: 'route',
    name: 'Route',
    role: 'Logistics Optimizer',
    description: 'Calculates optimal multi-modal paths considering cost, time & compliance',
    color: '#1ECC8B',
    icon: 'Route',
  },
  {
    id: 'comply',
    name: 'Comply',
    role: 'Regulation Engine',
    description: 'Real-time GDP/WHO/FDA compliance checks across 190+ jurisdictions',
    color: '#F0A500',
    icon: 'Shield',
  },
  {
    id: 'monitor',
    name: 'Monitor',
    role: 'Telemetry Guardian',
    description: 'Continuous IoT sensor monitoring with predictive excursion alerts',
    color: '#FF4444',
    icon: 'Activity',
  },
  {
    id: 'diplomat',
    name: 'Diplomat',
    role: 'Communication Hub',
    description: 'Auto-drafts stakeholder comms, customs letters & incident reports',
    color: '#A855F7',
    icon: 'MessageSquare',
  },
]

export const FEATURES = [
  {
    title: 'AI-Powered Document Parsing',
    description: 'Upload POs, invoices, and shipping docs. Our AI extracts and validates data in seconds.',
    icon: 'Sparkles',
    gradient: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    title: 'Real-Time Cold Chain Monitoring',
    description: 'Live telemetry from IoT sensors with ML-powered predictive alerts before excursions happen.',
    icon: 'Thermometer',
    gradient: 'from-emerald-500/20 to-teal-500/20',
  },
  {
    title: 'Multi-Modal Route Optimization',
    description: 'Intelligent routing across air, sea, and ground with real-time cost & compliance scoring.',
    icon: 'GitBranch',
    gradient: 'from-orange-500/20 to-amber-500/20',
  },
  {
    title: 'Global Compliance Engine',
    description: 'Automated GDP, WHO, and FDA compliance validation for 190+ countries.',
    icon: 'ShieldCheck',
    gradient: 'from-violet-500/20 to-purple-500/20',
  },
  {
    title: 'Crisis Command Center',
    description: 'Centralized incident management with AI-suggested reroutes and stakeholder comms.',
    icon: 'AlertTriangle',
    gradient: 'from-red-500/20 to-pink-500/20',
  },
  {
    title: 'Immutable Audit Trail',
    description: 'Blockchain-anchored logs for every decision, signature, and sensor reading.',
    icon: 'FileCheck',
    gradient: 'from-slate-500/20 to-zinc-500/20',
  },
]

export const STATS = [
  { value: 2400000, suffix: '+', label: 'Shipments Tracked', duration: 2000 },
  { value: 99.7, suffix: '%', label: 'On-Time Delivery', duration: 1500 },
  { value: 47, suffix: 'ms', label: 'Avg. Alert Latency', duration: 1000 },
  { value: 190, suffix: '+', label: 'Countries Covered', duration: 1800 },
]

export const COMPLIANCE_REGS = [
  { name: 'EU GDP', status: 'certified', region: 'Europe' },
  { name: 'WHO PQS', status: 'certified', region: 'Global' },
  { name: 'FDA 21 CFR', status: 'certified', region: 'USA' },
  { name: 'Health Canada', status: 'certified', region: 'Canada' },
  { name: 'TGA Australia', status: 'certified', region: 'APAC' },
  { name: 'ANVISA Brazil', status: 'certified', region: 'LATAM' },
]

export const TERMINAL_LOGS = [
  { agent: 'Ingest', color: '#58A6FF', message: 'Parsing PO-2024-0847... 94 line items extracted' },
  { agent: 'Route', color: '#1ECC8B', message: 'Optimal path: FRA → DXB → SIN (3.2 days, $4,280)' },
  { agent: 'Comply', color: '#F0A500', message: 'GDP check passed for EU → UAE transit' },
  { agent: 'Monitor', color: '#FF4444', message: 'Alert: Container MSKU-7234 temp at 6.8°C (threshold: 8°C)' },
  { agent: 'Diplomat', color: '#A855F7', message: 'Drafted stakeholder notification for Pfizer Inc.' },
  { agent: 'Comply', color: '#F0A500', message: 'Pre-clearing customs docs for Singapore entry' },
  { agent: 'Monitor', color: '#1ECC8B', message: 'All 12 active shipments within safe parameters' },
  { agent: 'Route', color: '#1ECC8B', message: 'Reroute calculated: Avoiding Suez delay (+0.4 days)' },
]

export const AUDIT_SAMPLES = [
  {
    timestamp: '2024-01-15T14:32:00Z',
    action: 'ROUTE_APPROVED',
    agent: 'Route',
    user: 'J. Martinez (RP)',
    details: 'Multi-modal route FRA→SIN approved with digital signature',
  },
  {
    timestamp: '2024-01-15T14:28:00Z',
    action: 'COMPLIANCE_CHECK',
    agent: 'Comply',
    user: 'System',
    details: 'GDP Article 9.4 validation passed for cold chain integrity',
  },
  {
    timestamp: '2024-01-15T14:15:00Z',
    action: 'TEMP_EXCURSION',
    agent: 'Monitor',
    user: 'System',
    details: 'Container MSKU-7234 recorded 6.8°C (within tolerance)',
  },
]
