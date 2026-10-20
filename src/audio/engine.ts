import type { EngineStatus, RenderedSound } from './types'

type AudioContextConstructor = typeof AudioContext

interface ActiveVoice {
  source: AudioBufferSourceNode
  gain: GainNode
  token: number
  onEnded?: () => void
}

/**
 * Thin Web Audio playback layer for the procedural preview buffers. The actual
 * synthesis lives in synthesis.ts so audition, single export and batch export
 * can all use one deterministic source of truth.
 */
export class CrunchrAudioEngine {
  onStatus: ((status: EngineStatus) => void) | null = null

  private context: AudioContext | null = null
  private master: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private active: ActiveVoice | null = null
  private token = 0
  private silentUnlockDone = false
  private disposed = false
  private cachedSound: RenderedSound | null = null
  private cachedBuffer: AudioBuffer | null = null
  private status: EngineStatus = 'standby'
  private waveform = new Float32Array(2048)

  private setStatus(next: EngineStatus): void {
    if (this.status === next) return
    this.status = next
    this.onStatus?.(next)
  }

  private createContext(): AudioContext | null {
    if (this.disposed) return null
    if (this.context) return this.context

    if (typeof window === 'undefined') return null
    const AudioCtor: AudioContextConstructor | undefined =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext

    if (!AudioCtor) {
      this.setStatus('unsupported')
      return null
    }

    try {
      const context = new AudioCtor({ latencyHint: 'interactive' })
      const master = context.createGain()
      master.gain.value = 0.92
      const analyser = context.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.58
      master.connect(analyser)
      analyser.connect(context.destination)

      this.context = context
      this.master = master
      this.analyser = analyser
      this.waveform = new Float32Array(analyser.fftSize)
      return context
    } catch {
      this.setStatus('unsupported')
      return null
    }
  }

  /**
   * Must be invoked from a user gesture. Creates/resumes the AudioContext and
   * starts an inaudible one-sample source to satisfy strict mobile autoplay
   * policies, then reports the engine armed.
   */
  async unlock(): Promise<boolean> {
    if (this.disposed) return false
    const context = this.createContext()
    if (!context || !this.master) {
      this.setStatus('unsupported')
      return false
    }

    try {
      if (context.state === 'suspended') await context.resume()
      if (context.state !== 'running') {
        this.setStatus('unsupported')
        return false
      }

      if (!this.silentUnlockDone) {
        const silent = context.createBuffer(1, 1, context.sampleRate)
        const source = context.createBufferSource()
        source.buffer = silent
        source.connect(this.master)
        source.start(0)
        this.silentUnlockDone = true
      }

      this.setStatus('armed')
      return true
    } catch {
      this.setStatus('unsupported')
      return false
    }
  }

  private getBuffer(sound: RenderedSound): AudioBuffer {
    const context = this.context
    if (!context) throw new Error('Audio context is not ready.')
    if (this.cachedSound === sound && this.cachedBuffer) return this.cachedBuffer

    const frames = Math.max(1, sound.channels[0].length)
    const buffer = context.createBuffer(sound.channels.length, frames, sound.sampleRate)
    for (let channel = 0; channel < sound.channels.length; channel += 1) {
      buffer.getChannelData(channel).set(sound.channels[channel])
    }
    this.cachedSound = sound
    this.cachedBuffer = buffer
    return buffer
  }

  private fadeOutActive(fadeSeconds = 0.006): void {
    const context = this.context
    const active = this.active
    if (!context || !active) return
    this.active = null
    const now = context.currentTime
    try {
      active.gain.gain.cancelScheduledValues(now)
      active.gain.gain.setValueAtTime(active.gain.gain.value, now)
      active.gain.gain.linearRampToValueAtTime(0.00001, now + fadeSeconds)
      active.source.stop(now + fadeSeconds + 0.002)
    } catch {
      // A source that has already ended can throw when stopped again; no state
      // is left dangling by this path.
    }
  }

  async play(sound: RenderedSound, onEnded?: () => void): Promise<void> {
    if (this.disposed) throw new Error('Audio engine has been disposed.')
    const unlocked = await this.unlock()
    const context = this.context
    if (!unlocked || !context || !this.master) {
      throw new Error('Audio could not be started. Tap the trigger again to enable sound.')
    }
    if (context.state !== 'running') {
      try {
        await context.resume()
      } catch {
        throw new Error('This browser blocked audio. Tap the trigger again to enable sound.')
      }
    }
    if (context.state !== 'running') {
      throw new Error('Audio is still suspended. Tap the trigger again to enable sound.')
    }

    this.fadeOutActive()
    const buffer = this.getBuffer(sound)
    const source = context.createBufferSource()
    source.buffer = buffer
    const gain = context.createGain()
    gain.gain.setValueAtTime(1, context.currentTime)
    source.connect(gain)
    gain.connect(this.master)

    const token = ++this.token
    const voice: ActiveVoice = { source, gain, token, onEnded }
    this.active = voice
    source.onended = () => {
      if (this.active?.token !== token) return
      this.active = null
      this.setStatus('armed')
      onEnded?.()
    }

    // A 2 ms scheduling cushion avoids a first-sample glitch on some engines
    // while staying under the perceptual threshold for a game-feel click.
    source.start(context.currentTime + 0.002)
  }

  /** Live time-domain samples for the oscilloscope. */
  getTimeDomain(): Float32Array | null {
    if (!this.analyser || !this.active) return null
    if (this.waveform.length !== this.analyser.fftSize) {
      this.waveform = new Float32Array(this.analyser.fftSize)
    }
    this.analyser.getFloatTimeDomainData(this.waveform)
    return this.waveform
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.fadeOutActive(0)
    try {
      void this.context?.close()
    } catch {
      // Closing an already-closed context is harmless.
    }
    this.active = null
    this.context = null
    this.master = null
    this.analyser = null
    this.cachedSound = null
    this.cachedBuffer = null
  }
}
