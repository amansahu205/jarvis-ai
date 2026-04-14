'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  FileText,
  Route,
  Shield,
  Activity,
  MessageSquare,
  Sparkles,
  Thermometer,
  GitBranch,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  Play,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react'
import { useInView } from '@/lib/use-in-view'
import { AGENTS, FEATURES, STATS, COMPLIANCE_REGS, TERMINAL_LOGS } from '@/lib/landing-data'

// Icon mapping
const iconMap: Record<string, React.ElementType> = {
  FileText,
  Route,
  Shield,
  Activity,
  MessageSquare,
  Sparkles,
  Thermometer,
  GitBranch,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
}

// Animated counter component
function AnimatedCounter({ value, suffix, duration }: { value: number; suffix: string; duration: number }) {
  const [count, setCount] = useState(0)
  const [ref, isInView] = useInView<HTMLSpanElement>({ threshold: 0.5 })

  useEffect(() => {
    if (!isInView) return

    let startTime: number
    let animationFrame: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      setCount(Math.floor(easeOutQuart * value))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [isInView, value, duration])

  const formattedCount = value >= 1000000
    ? `${(count / 1000000).toFixed(1)}M`
    : value >= 1000
    ? `${(count / 1000).toFixed(count >= 1000 ? 0 : 1)}K`
    : count.toString()

  return (
    <span ref={ref}>
      {value >= 1000000 ? `${(count / 1000000).toFixed(1)}M` : count.toLocaleString()}
      {suffix}
    </span>
  )
}

// Terminal animation component
function AnimatedTerminal() {
  const [logs, setLogs] = useState<typeof TERMINAL_LOGS>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const terminalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentIndex >= TERMINAL_LOGS.length) return

    const timer = setTimeout(() => {
      setLogs(prev => [...prev, TERMINAL_LOGS[currentIndex]])
      setCurrentIndex(prev => prev + 1)
    }, 800)

    return () => clearTimeout(timer)
  }, [currentIndex])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className="rounded-xl border border-[#21262D] bg-[#0D1117] overflow-hidden shadow-2xl">
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#161B22] border-b border-[#21262D]">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
          <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
        </div>
        <span className="ml-4 text-sm text-[#8B949E] font-mono">jarvis-ai-terminal</span>
      </div>

      {/* Terminal body */}
      <div
        ref={terminalRef}
        className="p-4 h-[280px] overflow-y-auto font-mono text-sm custom-scrollbar"
      >
        <div className="text-[#8B949E] mb-2">$ jarvis --start-agents</div>
        <div className="text-[#1ECC8B] mb-4">Initializing PharmaGuard AI agents...</div>

        <AnimatePresence>
          {logs.map((log, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex gap-2 mb-2"
            >
              <span style={{ color: log.color }} className="font-semibold">
                [{log.agent}]
              </span>
              <span className="text-[#E6EDF3]">{log.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {currentIndex < TERMINAL_LOGS.length && (
          <span className="terminal-cursor text-[#58A6FF]">_</span>
        )}
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // Section refs for scroll animations
  const [heroRef, heroInView] = useInView<HTMLElement>({ threshold: 0.1 })
  const [statsRef, statsInView] = useInView<HTMLElement>({ threshold: 0.3 })
  const [howItWorksRef, howItWorksInView] = useInView<HTMLElement>({ threshold: 0.2 })
  const [featuresRef, featuresInView] = useInView<HTMLElement>({ threshold: 0.2 })
  const [complianceRef, complianceInView] = useInView<HTMLElement>({ threshold: 0.2 })
  const [ctaRef, ctaInView] = useInView<HTMLElement>({ threshold: 0.3 })

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-[#080B0F] text-[#E6EDF3] overflow-x-hidden">
      {/* Sticky Navigation */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#080B0F]/90 backdrop-blur-xl border-b border-[#21262D]'
            : 'bg-transparent'
        }`}
      >
        <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#58A6FF] to-[#1ECC8B] flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl">PharmaGuard<span className="text-[#58A6FF]">AI</span></span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
              How It Works
            </a>
            <a href="#features" className="text-sm text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
              Features
            </a>
            <a href="#compliance" className="text-sm text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
              Compliance
            </a>
            <Link
              href="/"
              className="px-5 py-2.5 rounded-lg bg-[#58A6FF] text-white text-sm font-medium hover:bg-[#4A90E2] transition-colors"
            >
              Launch Dashboard
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </nav>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-[#0D1117] border-b border-[#21262D]"
            >
              <div className="px-6 py-4 flex flex-col gap-4">
                <a href="#how-it-works" className="text-[#8B949E] hover:text-[#E6EDF3]">How It Works</a>
                <a href="#features" className="text-[#8B949E] hover:text-[#E6EDF3]">Features</a>
                <a href="#compliance" className="text-[#8B949E] hover:text-[#E6EDF3]">Compliance</a>
                <Link
                  href="/"
                  className="px-5 py-2.5 rounded-lg bg-[#58A6FF] text-white text-sm font-medium text-center"
                >
                  Launch Dashboard
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero Section */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center pt-20"
      >
        {/* Background effects */}
        <div className="absolute inset-0 dot-grid opacity-30" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#58A6FF]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#1ECC8B]/10 rounded-full blur-[120px]" />

        <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* Left: Copy */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#161B22] border border-[#21262D] mb-6">
              <span className="status-dot" />
              <span className="text-sm text-[#8B949E]">5 AI Agents Working in Harmony</span>
            </div>

            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              Cold-Chain
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#58A6FF] to-[#1ECC8B]">
                Crisis Intelligence
              </span>
            </h1>

            <p className="text-xl text-[#8B949E] mb-8 max-w-lg">
              PharmaGuard AI orchestrates five specialized agents to protect pharmaceutical
              shipments worth billions—from document parsing to crisis resolution.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#58A6FF] text-white font-medium hover:bg-[#4A90E2] transition-all animate-pulse-glow"
              >
                <Play className="w-4 h-4" />
                Try Live Demo
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-[#21262D] text-[#E6EDF3] font-medium hover:bg-[#161B22] transition-colors"
              >
                See How It Works
                <ChevronDown className="w-4 h-4" />
              </a>
            </div>
          </motion.div>

          {/* Right: Animated Terminal */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={heroInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <AnimatedTerminal />
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <ChevronDown className="w-8 h-8 text-[#484F58]" />
        </motion.div>
      </section>

      {/* Stats Strip */}
      <section
        ref={statsRef}
        className="py-16 border-y border-[#21262D] bg-[#0D1117]/50"
      >
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={statsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={statsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="text-center"
              >
                <div className="font-display text-4xl md:text-5xl font-bold text-[#E6EDF3] mb-2">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} duration={stat.duration} />
                </div>
                <div className="text-sm text-[#8B949E]">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works - Agent Cards */}
      <section
        ref={howItWorksRef}
        id="how-it-works"
        className="py-24 relative"
      >
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={howItWorksInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
              Five Agents, One Mission
            </h2>
            <p className="text-xl text-[#8B949E] max-w-2xl mx-auto">
              Each AI agent specializes in a critical aspect of cold-chain logistics,
              working together seamlessly to protect your shipments.
            </p>
          </motion.div>

          {/* Agent cards with connector line */}
          <div className="relative">
            {/* Dashed connector line (desktop only) */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px border-t-2 border-dashed border-[#21262D] -translate-y-1/2 z-0" />

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 relative z-10">
              {AGENTS.map((agent, i) => {
                const Icon = iconMap[agent.icon]
                return (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={howItWorksInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="group"
                  >
                    <div className="relative p-6 rounded-2xl bg-[#0D1117] border border-[#21262D] hover:border-[#58A6FF]/50 transition-all duration-300 hover:-translate-y-2">
                      {/* Agent number badge */}
                      <div
                        className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{ backgroundColor: agent.color }}
                      >
                        {i + 1}
                      </div>

                      {/* Icon */}
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                        style={{ backgroundColor: `${agent.color}20` }}
                      >
                        {Icon && <Icon className="w-7 h-7" style={{ color: agent.color }} />}
                      </div>

                      <h3 className="font-display font-bold text-lg mb-1">{agent.name}</h3>
                      <p className="text-sm text-[#58A6FF] mb-3">{agent.role}</p>
                      <p className="text-sm text-[#8B949E] leading-relaxed">{agent.description}</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section
        ref={featuresRef}
        id="features"
        className="py-24 bg-[#0D1117]/30"
      >
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
              Enterprise-Grade Capabilities
            </h2>
            <p className="text-xl text-[#8B949E] max-w-2xl mx-auto">
              Built for the world&apos;s most demanding pharmaceutical supply chains.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => {
              const Icon = iconMap[feature.icon]
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="group relative p-8 rounded-2xl bg-[#0D1117] border border-[#21262D] hover:border-[#58A6FF]/30 transition-all duration-300 overflow-hidden"
                >
                  {/* Gradient background on hover */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                  />

                  <div className="relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-[#161B22] flex items-center justify-center mb-5 group-hover:bg-[#21262D] transition-colors">
                      {Icon && <Icon className="w-6 h-6 text-[#58A6FF]" />}
                    </div>

                    <h3 className="font-display font-bold text-xl mb-3">{feature.title}</h3>
                    <p className="text-[#8B949E] leading-relaxed">{feature.description}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Compliance Section */}
      <section
        ref={complianceRef}
        id="compliance"
        className="py-24"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={complianceInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
                Global Compliance,
                <br />
                <span className="text-[#1ECC8B]">Automated</span>
              </h2>

              <p className="text-xl text-[#8B949E] mb-8">
                Our Comply agent continuously validates shipments against regulatory
                requirements across 190+ countries, ensuring you never miss a checkpoint.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {COMPLIANCE_REGS.map((reg, i) => (
                  <motion.div
                    key={reg.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={complianceInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.4, delay: 0.3 + i * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#0D1117] border border-[#21262D]"
                  >
                    <CheckCircle2 className="w-5 h-5 text-[#1ECC8B] shrink-0" />
                    <div>
                      <div className="font-medium text-sm">{reg.name}</div>
                      <div className="text-xs text-[#8B949E]">{reg.region}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Right: Compliance visualization */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={complianceInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="rounded-2xl border border-[#21262D] bg-[#0D1117] p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-[#F0A500]/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-[#F0A500]" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Compliance Engine</h4>
                    <p className="text-sm text-[#8B949E]">Real-time validation</p>
                  </div>
                  <div className="ml-auto px-3 py-1 rounded-full bg-[#1ECC8B]/20 text-[#1ECC8B] text-sm font-medium">
                    Active
                  </div>
                </div>

                {/* Animated compliance checks */}
                <div className="space-y-3">
                  {['GDP Article 9.4 - Temperature Monitoring', 'WHO PQS E006 - Cold Chain Equipment', 'FDA 21 CFR Part 211 - Storage Controls'].map((check, i) => (
                    <motion.div
                      key={check}
                      initial={{ width: 0 }}
                      animate={complianceInView ? { width: '100%' } : {}}
                      transition={{ duration: 1, delay: 0.5 + i * 0.2 }}
                      className="relative h-12 rounded-lg bg-[#161B22] overflow-hidden"
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={complianceInView ? { width: '100%' } : {}}
                        transition={{ duration: 1.5, delay: 0.7 + i * 0.2 }}
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#1ECC8B]/30 to-[#1ECC8B]/10"
                      />
                      <div className="absolute inset-0 flex items-center justify-between px-4">
                        <span className="text-sm">{check}</span>
                        <CheckCircle2 className="w-5 h-5 text-[#1ECC8B]" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        ref={ctaRef}
        className="py-24 relative overflow-hidden"
      >
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#58A6FF]/5 to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#58A6FF]/10 rounded-full blur-[150px]" />

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={ctaInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-display text-4xl md:text-6xl font-bold mb-6">
              Ready to Protect Your
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#58A6FF] to-[#1ECC8B]">
                Cold Chain?
              </span>
            </h2>

            <p className="text-xl text-[#8B949E] mb-10 max-w-2xl mx-auto">
              Join leading pharmaceutical companies using PharmaGuard AI to safeguard
              billions in temperature-sensitive shipments.
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#58A6FF] text-white font-semibold text-lg hover:bg-[#4A90E2] transition-all animate-pulse-glow"
              >
                Launch Dashboard
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="mailto:contact@jarvis-ai.com"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-[#21262D] text-[#E6EDF3] font-semibold text-lg hover:bg-[#161B22] transition-colors"
              >
                Contact Sales
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-[#21262D]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#58A6FF] to-[#1ECC8B] flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-bold">PharmaGuard<span className="text-[#58A6FF]">AI</span></span>
            </div>

            <div className="flex items-center gap-6 text-sm text-[#8B949E]">
              <a href="#" className="hover:text-[#E6EDF3] transition-colors">Privacy</a>
              <a href="#" className="hover:text-[#E6EDF3] transition-colors">Terms</a>
              <a href="#" className="hover:text-[#E6EDF3] transition-colors">Security</a>
            </div>

            <div className="text-sm text-[#484F58]">
              &copy; {new Date().getFullYear()} Jarvis AI. All rights reserved.
            </div>
          </div>
        </div>
      </footer>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0D1117;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #21262D;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #30363D;
        }
      `}</style>
    </div>
  )
}
