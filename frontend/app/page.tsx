'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
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
import { FrameAnimator } from '@/components/frame-animator'
import { AGENTS, FEATURES, STATS, COMPLIANCE_REGS, TERMINAL_LOGS } from '@/lib/landing-data'

// Showcase images for scrolling animation
const SHOWCASE_IMAGES = [
  { src: '/images/showcase-dashboard.jpg', alt: 'PharmaGuard Dashboard - Real-time shipment monitoring', title: 'Command Center' },
  { src: '/images/showcase-routes.jpg', alt: 'Route Planning Interface - Global logistics optimization', title: 'Route Planner' },
  { src: '/images/showcase-crisis.jpg', alt: 'Crisis Management - Temperature excursion handling', title: 'Crisis Response' },
  { src: '/images/showcase-compliance.jpg', alt: 'Compliance Dashboard - FDA WHO GDP verification', title: 'Compliance Hub' },
  { src: '/images/showcase-analytics.jpg', alt: 'Analytics Dashboard - Performance metrics', title: 'Analytics' },
]

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
    let start = 0
    const end = value
    const increment = end / (duration / 16)
    const timer = setInterval(() => {
      start += increment
      if (start >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [isInView, value, duration])

  return (
    <span ref={ref} className="tabular-nums">
      {count.toLocaleString()}{suffix}
    </span>
  )
}

// Infinite carousel showcase component
function ScrollingShowcase() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            See It In Action
          </h2>
          <p className="text-white/50 max-w-2xl mx-auto">
            A glimpse into the PharmaGuard experience.
          </p>
        </motion.div>
      </div>

      {/* Infinite scrolling carousel */}
      <div className="relative">
        <motion.div
          className="flex gap-6"
          animate={{ x: ['0%', '-50%'] }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: 'loop',
              duration: 5,
              ease: 'linear',
            },
          }}
        >
          {[...SHOWCASE_IMAGES, ...SHOWCASE_IMAGES].map((image, i) => (
            <div
              key={i}
              className="relative flex-shrink-0 group"
            >
              <div className="relative w-[400px] md:w-[500px] lg:w-[600px] aspect-video rounded-xl overflow-hidden border border-white/10 bg-[#0D1117]">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#080B0F] via-transparent to-transparent opacity-60" />
                {/* Title badge */}
                <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg bg-[#080B0F]/80 backdrop-blur-sm border border-white/10">
                  <span className="text-sm font-medium text-white">{image.title}</span>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Fade edges */}
      <div className="absolute top-0 left-0 w-32 h-full bg-gradient-to-r from-[#080B0F] to-transparent pointer-events-none z-10" />
      <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-[#080B0F] to-transparent pointer-events-none z-10" />
    </section>
  )
}

// Terminal animation component
function AnimatedTerminal() {
  const [logs, setLogs] = useState<typeof TERMINAL_LOGS>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const terminalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentIndex >= TERMINAL_LOGS.length) {
      // Reset after all logs shown
      const resetTimer = setTimeout(() => {
        setLogs([])
        setCurrentIndex(0)
      }, 3000)
      return () => clearTimeout(resetTimer)
    }

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
    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0D1117]">
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#161B22] border-b border-white/10">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
          <div className="w-3 h-3 rounded-full bg-[#27CA40]" />
        </div>
        <span className="ml-4 text-xs text-white/40 font-mono">jarvis-ai-terminal</span>
      </div>
      {/* Terminal content */}
      <div ref={terminalRef} className="p-4 h-64 overflow-y-auto font-mono text-sm">
        <AnimatePresence mode="popLayout">
          {logs.map((log, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-start gap-2 mb-2"
            >
              <span className="text-white/30">{`>`}</span>
              <span
                className="px-1.5 py-0.5 rounded text-xs font-semibold"
                style={{ backgroundColor: `${log.color}20`, color: log.color }}
              >
                {log.agent}
              </span>
              <span className="text-white/70">{log.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        <div className="flex items-center gap-1 text-white/30">
          <span>{`>`}</span>
          <span className="w-2 h-4 bg-[#58A6FF] terminal-cursor" />
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-[#080B0F] text-white overflow-x-hidden">
      {/* Sticky Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#080B0F]/90 backdrop-blur-xl border-b border-white/5' : ''
          }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#58A6FF] to-[#1ECC8B] flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold">PharmaGuard</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm text-white/60 hover:text-white transition-colors">
              How It Works
            </a>
            <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors">
              Features
            </a>
            <a href="#compliance" className="text-sm text-white/60 hover:text-white transition-colors">
              Compliance
            </a>
            <Link
              href="/app"
              className="px-4 py-2 rounded-lg bg-[#58A6FF] hover:bg-[#4A90E2] transition-colors text-sm font-medium"
            >
              Launch App
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-white/60 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-[#0D1117] border-t border-white/10"
            >
              <div className="px-6 py-4 flex flex-col gap-4">
                <a href="#how-it-works" className="text-sm text-white/60 hover:text-white">How It Works</a>
                <a href="#features" className="text-sm text-white/60 hover:text-white">Features</a>
                <a href="#compliance" className="text-sm text-white/60 hover:text-white">Compliance</a>
                <Link href="/app" className="px-4 py-2 rounded-lg bg-[#58A6FF] text-sm font-medium text-center">
                  Launch App
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        {/* Video frame background */}
        <div className="absolute inset-0 z-0">
          <FrameAnimator frameFolder="hero" frameCount={80} fps={10} autoplay={true} loop={true} className="absolute inset-0" />
        </div>

        {/* Background effects */}
        <div className="absolute inset-0 dot-grid opacity-30 z-1" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#58A6FF]/10 rounded-full blur-3xl z-1" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#1ECC8B]/10 rounded-full blur-3xl z-1" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Copy */}
            <div className="space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#58A6FF]/10 text-[#58A6FF] text-sm font-medium border border-[#58A6FF]/20">
                  <Sparkles className="w-4 h-4" />
                  AI-Powered Logistics
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-tight text-balance"
              >
                Cold Chain.{' '}
                <span className="bg-gradient-to-r from-[#58A6FF] to-[#1ECC8B] bg-clip-text text-transparent">
                  Solved.
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg md:text-xl text-white/60 max-w-xl text-pretty"
              >
                Five AI agents orchestrate your pharmaceutical shipments end-to-end.
                From PO parsing to crisis resolution, we handle it all.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-wrap gap-4"
              >
                <Link
                  href="/app"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#58A6FF] hover:bg-[#4A90E2] transition-all text-base font-medium animate-pulse-glow"
                >
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-white/20 hover:border-white/40 transition-colors text-base font-medium"
                >
                  <Play className="w-4 h-4" /> Watch Demo
                </a>
              </motion.div>
            </div>

            {/* Right: Terminal */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <AnimatedTerminal />
            </motion.div>
          </div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40"
          >
            <span className="text-xs">Scroll to explore</span>
            <ChevronDown className="w-5 h-5 animate-bounce" />
          </motion.div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="relative py-16 border-y border-white/5 bg-[#0D1117]/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="font-display text-3xl md:text-4xl font-bold text-white">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} duration={stat.duration} />
                </div>
                <div className="mt-2 text-sm text-white/50">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scrolling Showcase */}
      <ScrollingShowcase />

      {/* How It Works */}
      <section id="how-it-works" className="relative py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Five Agents. One Mission.
            </h2>
            <p className="text-white/50 max-w-2xl mx-auto">
              Our AI agents work in concert to manage every aspect of pharmaceutical logistics.
            </p>
          </div>

          <div className="relative">
            {/* Connector line */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#58A6FF]/30 to-transparent -translate-y-1/2" />

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {AGENTS.map((agent, i) => {
                const Icon = iconMap[agent.icon] || FileText
                return (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="relative group"
                  >
                    <div
                      className="p-6 rounded-xl border border-white/10 bg-[#0D1117]/80 backdrop-blur-sm hover:border-white/20 transition-all hover:-translate-y-1"
                    >
                      {/* Agent icon */}
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                        style={{ backgroundColor: `${agent.color}20` }}
                      >
                        <Icon className="w-6 h-6" style={{ color: agent.color }} />
                      </div>
                      <h3 className="font-display text-lg font-semibold mb-1">{agent.name}</h3>
                      <p className="text-xs text-white/40 mb-3">{agent.role}</p>
                      <p className="text-sm text-white/60">{agent.description}</p>
                    </div>
                    {/* Connection dot */}
                    <div
                      className="hidden lg:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-[#080B0F]"
                      style={{ backgroundColor: agent.color }}
                    />
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative py-24 bg-[#0D1117]/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Enterprise-Grade Features
            </h2>
            <p className="text-white/50 max-w-2xl mx-auto">
              Built for the world&apos;s most demanding pharmaceutical supply chains.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => {
              const Icon = iconMap[feature.icon] || Sparkles
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="group relative p-6 rounded-xl border border-white/10 bg-[#0D1117] overflow-hidden hover:border-white/20 transition-all"
                >
                  {/* Gradient background on hover */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity`}
                  />
                  <div className="relative z-10">
                    <Icon className="w-8 h-8 text-[#58A6FF] mb-4" />
                    <h3 className="font-display text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-white/60">{feature.description}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Compliance Section */}
      <section id="compliance" className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <FrameAnimator frameFolder="compliance" frameCount={80} fps={30} autoplay={true} loop={true} className="absolute inset-0" />
          <div className="absolute inset-0 bg-black/40" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Copy */}
            <div className="space-y-6">
              <h2 className="font-display text-3xl md:text-4xl font-bold">
                Global Compliance,{' '}
                <span className="text-[#1ECC8B]">Automated</span>
              </h2>
              <p className="text-white/60 text-lg">
                Real-time validation against GDP, WHO, FDA, and 50+ regulatory frameworks.
                Never miss a compliance checkpoint again.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-4">
                {COMPLIANCE_REGS.map((reg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-[#0D1117]/50"
                  >
                    <CheckCircle2 className="w-5 h-5 text-[#1ECC8B]" />
                    <div>
                      <div className="text-sm font-medium">{reg.name}</div>
                      <div className="text-xs text-white/40">{reg.region}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right: Visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="p-8 rounded-2xl border border-white/10 bg-[#0D1117]">
                <div className="space-y-4">
                  {COMPLIANCE_REGS.slice(0, 4).map((reg, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-[#1ECC8B]" />
                        <span className="text-sm">{reg.name}</span>
                      </div>
                      <div className="flex-1 mx-4 h-2 rounded-full bg-white/5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: '100%' }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, delay: i * 0.2 }}
                          className="h-full bg-gradient-to-r from-[#1ECC8B] to-[#58A6FF]"
                        />
                      </div>
                      <span className="text-xs text-[#1ECC8B]">Verified</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="p-12 rounded-2xl border border-white/10 bg-gradient-to-br from-[#58A6FF]/10 to-[#1ECC8B]/10 relative overflow-hidden"
          >
            {/* Glow effect */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#58A6FF]/20 rounded-full blur-3xl" />

            <div className="relative z-10">
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                Ready to Transform Your Supply Chain?
              </h2>
              <p className="text-white/60 mb-8 max-w-xl mx-auto">
                Join leading pharmaceutical companies using PharmaGuard AI to ensure
                product integrity and regulatory compliance.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/app"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-[#58A6FF] hover:bg-[#4A90E2] transition-all text-base font-medium"
                >
                  Start Free Trial <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="mailto:sales@pharmaguard.ai"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-lg border border-white/20 hover:border-white/40 transition-colors text-base font-medium"
                >
                  Contact Sales
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#58A6FF] to-[#1ECC8B] flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-bold">PharmaGuard AI</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-white/40">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Security</a>
              <a href="#" className="hover:text-white transition-colors">Status</a>
            </div>
            <div className="text-sm text-white/40">
              2024 PharmaGuard AI. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
