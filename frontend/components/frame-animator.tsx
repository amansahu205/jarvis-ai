'use client'

import { useState, useEffect, useRef } from 'react'

interface FrameAnimatorProps {
  frameFolder: string // e.g., 'hero' or 'compliance'
  frameCount: number // total number of frames
  fps?: number // frames per second (default: 30)
  autoplay?: boolean // auto-play animation (default: true)
  loop?: boolean // loop animation (default: true)
  className?: string
}

export function FrameAnimator({
  frameFolder,
  frameCount,
  fps = 30,
  autoplay = true,
  loop = true,
  className = ''
}: FrameAnimatorProps) {
  const [currentFrame, setCurrentFrame] = useState(0)
  const [isPlaying, setIsPlaying] = useState(autoplay)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imagesRef = useRef<HTMLImageElement[]>([])
  const frameIndexRef = useRef(0)

  // Preload all frames
  useEffect(() => {
    const loadFrames = async () => {
      const images: HTMLImageElement[] = []
      for (let i = 1; i <= frameCount; i++) {
        const img = new Image()
        const frameNum = String(i).padStart(4, '0')
        img.src = `/images/frames/${frameFolder}/frame_${frameNum}.png`
        img.crossOrigin = 'anonymous'
        images.push(img)
      }
      imagesRef.current = images
    }

    loadFrames()
  }, [frameFolder, frameCount])

  // Animation loop
  useEffect(() => {
    if (!isPlaying || imagesRef.current.length === 0) return

    const frameTime = 1000 / fps
    let lastTime = Date.now()

    const animate = () => {
      const now = Date.now()
      const elapsed = now - lastTime

      if (elapsed >= frameTime) {
        frameIndexRef.current = (frameIndexRef.current + 1) % frameCount

        if (frameIndexRef.current === 0 && !loop) {
          setIsPlaying(false)
          return
        }

        setCurrentFrame(frameIndexRef.current)
        lastTime = now
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    let animationFrameId = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(animationFrameId)
  }, [isPlaying, fps, frameCount, loop])

  // Draw frame to canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || imagesRef.current.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = imagesRef.current[currentFrame]

    const drawFrame = () => {
      // Get container dimensions
      const container = canvas.parentElement
      if (!container) return

      const width = container.clientWidth || 1920
      const height = container.clientHeight || 1080

      canvas.width = width
      canvas.height = height

      // Draw image scaled to fit container
      ctx.drawImage(img, 0, 0, width, height)
    }

    if (img.complete) {
      drawFrame()
    } else {
      img.onload = drawFrame
    }
  }, [currentFrame])

  return (
    <div className={`relative w-full h-full bg-black ${className}`} suppressHydrationWarning>
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

      {/* Playback controls (optional) */}
      <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 hover:opacity-100 transition-opacity" suppressHydrationWarning>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <div className="text-white/60 text-xs px-2 py-1">
          {currentFrame + 1} / {frameCount}
        </div>
      </div>
    </div>
  )
}
