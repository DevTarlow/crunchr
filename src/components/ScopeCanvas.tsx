import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { RenderedSound } from '../audio/types'
import { formatElapsedMs } from '../lib/format'

interface ScopeCanvasProps {
  sound: RenderedSound
  isPlaying: boolean
  triggerNonce: number
  getWaveform: () => Float32Array | null
  onTrigger: () => void
  presetName: string
}

interface HoverInfo {
  timeMs: number
  amplitude: number
}

/**
 * Canvas oscilloscope. Idle state draws the complete rendered one-shot; while a
 * voice is alive it switches to the real AnalyserNode time-domain signal and a
 * playhead. No perpetual animation loop runs when the instrument is quiet.
 */
export function ScopeCanvas({
  sound,
  isPlaying,
  triggerNonce,
  getWaveform,
  onTrigger,
  presetName,
}: ScopeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const hoverXRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const cssWidth = canvas.clientWidth
    const cssHeight = canvas.clientHeight
    if (cssWidth < 2 || cssHeight < 2) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const expectedWidth = Math.max(1, Math.round(cssWidth * dpr))
    const expectedHeight = Math.max(1, Math.round(cssHeight * dpr))
    if (canvas.width !== expectedWidth || canvas.height !== expectedHeight) {
      canvas.width = expectedWidth
      canvas.height = expectedHeight
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, cssWidth, cssHeight)

    const midY = cssHeight * 0.52
    const plotHeight = cssHeight * 0.68

    // Fine instrument grid.
    context.save()
    context.strokeStyle = 'rgba(239, 233, 221, 0.055)'
    context.lineWidth = 1
    context.setLineDash([2, 5])
    for (let i = 1; i < 8; i += 1) {
      const x = (cssWidth / 8) * i
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x, cssHeight)
      context.stroke()
    }
    for (let i = 1; i < 4; i += 1) {
      const y = (cssHeight / 4) * i
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(cssWidth, y)
      context.stroke()
    }
    context.setLineDash([])
    context.strokeStyle = 'rgba(255, 132, 0, 0.18)'
    context.beginPath()
    context.moveTo(0, midY)
    context.lineTo(cssWidth, midY)
    context.stroke()
    context.restore()

    const hoverX = hoverXRef.current
    const liveData = isPlaying ? getWaveform() : null

    if (liveData && liveData.length > 0) {
      context.save()
      context.strokeStyle = '#ff8400'
      context.lineWidth = 1.7
      context.shadowColor = 'rgba(255, 132, 0, 0.7)'
      context.shadowBlur = 12
      context.beginPath()
      const analyserStep = liveData.length / Math.max(1, cssWidth)
      for (let x = 0; x < cssWidth; x += 1) {
        const start = Math.floor(x * analyserStep)
        const end = Math.min(liveData.length, Math.floor((x + 1) * analyserStep))
        let peak = 0
        for (let i = start; i < Math.max(start + 1, end); i += 1) {
          if (Math.abs(liveData[i]) > Math.abs(peak)) peak = liveData[i]
        }
        const y = midY - peak * plotHeight * 1.35
        if (x === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      }
      context.stroke()
      context.restore()
    } else {
      // Downsample the complete one-shot into a min/max envelope so a 800 ms
      // granular sound remains legible on a 600 px scope.
      const left = sound.channels[0]
      const right = sound.channels[1]
      const length = left.length
      const columns = Math.max(2, Math.ceil(cssWidth))
      const topPoints = new Float32Array(columns)
      const bottomPoints = new Float32Array(columns)
      let peakIndex = 0
      let peakValue = 0

      // Draw a min/max envelope mirrored around zero. A single-sided peak trace
      // loses the bipolar nature of an oscilloscope and reads as a filled shape.
      for (let column = 0; column < columns; column += 1) {
        const start = Math.min(length - 1, Math.floor((column / columns) * length))
        const end = Math.max(start + 1, Math.floor(((column + 1) / columns) * length))
        const stride = Math.max(1, Math.floor((end - start) / 32))
        let localMax = -1
        let localMin = 1
        for (let i = start; i < Math.min(length, end); i += stride) {
          const value = (left[i] + right[i]) * 0.5
          if (value > localMax) localMax = value
          if (value < localMin) localMin = value
          if (Math.abs(value) > peakValue) {
            peakValue = Math.abs(value)
            peakIndex = i
          }
        }
        topPoints[column] = midY - localMax * plotHeight
        bottomPoints[column] = midY - localMin * plotHeight
      }

      context.save()
      context.beginPath()
      for (let column = 0; column < columns; column += 1) {
        const x = (column / (columns - 1)) * cssWidth
        if (column === 0) context.moveTo(x, topPoints[column])
        else context.lineTo(x, topPoints[column])
      }
      for (let column = columns - 1; column >= 0; column -= 1) {
        const x = (column / (columns - 1)) * cssWidth
        context.lineTo(x, bottomPoints[column])
      }
      context.closePath()
      context.fillStyle = 'rgba(255, 132, 0, 0.085)'
      context.fill()
      context.strokeStyle = 'rgba(255, 140, 18, 0.72)'
      context.lineWidth = 1.3
      context.stroke()
      context.restore()

      // Highlight the hottest transient in the one-shot.
      const peakX = (peakIndex / Math.max(1, length - 1)) * cssWidth
      context.save()
      context.strokeStyle = 'rgba(255, 178, 90, 0.28)'
      context.setLineDash([2, 4])
      context.beginPath()
      context.moveTo(peakX, cssHeight * 0.15)
      context.lineTo(peakX, cssHeight * 0.88)
      context.stroke()
      context.setLineDash([])
      context.restore()
    }

    if (isPlaying) {
      const progress = Math.min(
        1,
        Math.max(0, (performance.now() - startTimeRef.current) / Math.max(1, sound.durationMs)),
      )
      const x = progress * cssWidth
      context.save()
      context.strokeStyle = 'rgba(255, 178, 90, 0.56)'
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(x, cssHeight * 0.1)
      context.lineTo(x, cssHeight * 0.9)
      context.stroke()
      context.fillStyle = '#ff8400'
      context.beginPath()
      context.arc(x, cssHeight * 0.1, 2.5, 0, Math.PI * 2)
      context.fill()
      context.restore()
    }

    if (hoverX !== null) {
      const x = hoverX * cssWidth
      const sampleIndex = Math.min(
        sound.channels[0].length - 1,
        Math.max(0, Math.round(hoverX * (sound.channels[0].length - 1))),
      )
      const sample = (sound.channels[0][sampleIndex] + sound.channels[1][sampleIndex]) * 0.5
      context.save()
      context.strokeStyle = 'rgba(241, 237, 228, 0.28)'
      context.lineWidth = 1
      context.setLineDash([3, 4])
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x, cssHeight)
      context.stroke()
      context.setLineDash([])
      context.fillStyle = '#f1ede5'
      context.beginPath()
      context.arc(x, midY - sample * plotHeight, 2, 0, Math.PI * 2)
      context.fill()
      context.restore()
    }
  }, [getWaveform, isPlaying, sound])

  useEffect(() => {
    const canvas = canvasRef.current
    const screen = screenRef.current
    if (!canvas || !screen) return undefined

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const width = Math.max(1, Math.round(rect.width * dpr))
      const height = Math.max(1, Math.round(rect.height * dpr))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      paint()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(screen)
    resize()
    return () => observer.disconnect()
  }, [paint])

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      paint()
      return undefined
    }

    startTimeRef.current = performance.now()
    const loop = () => {
      paint()
      rafRef.current = requestAnimationFrame(loop)
    }
    loop()
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [isPlaying, paint])

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0) return
    const normalized = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    hoverXRef.current = normalized
    const length = sound.channels[0].length
    const index = Math.min(length - 1, Math.max(0, Math.round(normalized * (length - 1))))
    const amplitude = (sound.channels[0][index] + sound.channels[1][index]) * 0.5
    setHoverInfo({
      timeMs: (index / sound.sampleRate) * 1000,
      amplitude,
    })
    paint()
  }

  const handlePointerLeave = () => {
    hoverXRef.current = null
    setHoverInfo(null)
    paint()
  }

  return (
    <div className="scope-block">
      <div className="scope-toolbar">
        <div className="scope-mode">
          <span className={`scope-live-dot ${isPlaying ? 'is-live' : ''}`} aria-hidden="true" />
          <span>{isPlaying ? 'PLAYING' : 'SOUND WAVE'}</span>
        </div>
        <span className="scope-meta">TIME / LOUDNESS</span>
      </div>

      <div
        ref={screenRef}
        className={`scope-screen ${isPlaying ? 'is-playing' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={`Sound wave for ${presetName}. Click to play again.`}
        aria-keyshortcuts="Enter Space"
        onClick={onTrigger}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.code === 'Space') {
            event.preventDefault()
            onTrigger()
          }
        }}
      >
        <canvas ref={canvasRef} className="scope-canvas" aria-hidden="true" />
        <div className="scope-corner scope-corner-tl" aria-hidden="true" />
        <div className="scope-corner scope-corner-br" aria-hidden="true" />
        {triggerNonce > 0 ? (
          <span className="scope-flash" key={triggerNonce} aria-hidden="true" />
        ) : null}
        {hoverInfo ? (
          <span className="scope-inspect" aria-hidden="true">
            <span>{formatElapsedMs(hoverInfo.timeMs)}</span>
            <span>
              {hoverInfo.amplitude >= 0 ? '+' : ''}
              {hoverInfo.amplitude.toFixed(2)}
            </span>
          </span>
        ) : (
          <span className="scope-hint" aria-hidden="true">
            Point to inspect · click to play again
          </span>
        )}
      </div>

      <div className="scope-axis" aria-hidden="true">
        <span>0 ms</span>
        <span className="scope-axis-line" />
        <span>{Math.round(sound.durationMs)} ms</span>
      </div>
    </div>
  )
}
