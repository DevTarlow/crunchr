import type { EngineStatus, RenderedSound } from './types'

type AudioContextConstructor = typeof AudioContext

interface ActiveVoice {
  source: AudioBufferSourceNode
  gain: GainNode
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
  private voices = new Set<ActiveVoice>()
  private progressTimers = new Set<number>()
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

  private async ensureRunning(): Promise<AudioContext> {
    const unlocked = await this.unlock()
    const context = this.context
    if (!unlocked || !context || !this.master) {
      throw new Error('Sound could not start. Press Play again.')
    }
    if (context.state !== 'running') {
      try {
        await context.resume()
      } catch {
        throw new Error('This browser blocked the sound. Press Play again.')
      }
    }
    if (context.state !== 'running') {
      throw new Error('Sound is still paused. Press Play again.')
    }
    return context
  }

  private getBuffer(sound: RenderedSound): AudioBuffer {
    const context = this.context
    if (!context) throw new Error('Sound is not ready yet.')
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

  private fadeOutVoices(fadeSeconds = 0.006): void {
    const context = this.context
    if (!context) return

    for (const timer of this.progressTimers) window.clearTimeout(timer)
    this.progressTimers.clear()

    const voices = Array.from(this.voices)
    this.voices.clear()
    const now = context.currentTime
    for (const voice of voices) {
      try {
        voice.gain.gain.cancelScheduledValues(now)
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now)
        voice.gain.gain.linearRampToValueAtTime(0.00001, now + fadeSeconds)
        voice.source.stop(now + fadeSeconds + 0.002)
      } catch {
        // A source that has already ended can throw when stopped again; no state
        // is left dangling by this path.
      }
    }
  }

  async play(sound: RenderedSound, onEnded?: () => void): Promise<void> {
    if (this.disposed) throw new Error('The sound player is closed.')
    const context = await this.ensureRunning()
    const master = this.master
    if (!master) throw new Error('Sound could not start. Press Play again.')

    this.fadeOutVoices()
    const buffer = this.getBuffer(sound)
    const source = context.createBufferSource()
    source.buffer = buffer
    const gain = context.createGain()
    gain.gain.setValueAtTime(1, context.currentTime)
    source.connect(gain)
    gain.connect(master)

    const voice: ActiveVoice = { source, gain }
    this.voices.add(voice)
    source.onended = () => {
      if (!this.voices.delete(voice)) return
      this.setStatus('armed')
      onEnded?.()
    }

    // A 2 ms scheduling cushion avoids a first-sample glitch on some engines
    // while staying under the perceptual threshold for a game-feel click.
    source.start(context.currentTime + 0.002)
  }

  /**
   * Play the whole variation set back to back. Every sound is scheduled on the
   * AudioContext clock so the spacing stays steady even when the page is busy.
   */
  async playSequence(
    sounds: readonly RenderedSound[],
    gapMs: number,
    onStep?: (step: number, total: number) => void,
    onEnded?: () => void,
  ): Promise<void> {
    if (this.disposed) throw new Error('The sound player is closed.')
    if (sounds.length === 0) return

    const context = await this.ensureRunning()
    const master = this.master
    if (!master) throw new Error('Sound could not start. Press Play again.')

    this.fadeOutVoices()
    const gapSeconds = Math.max(0, gapMs) / 1000
    const total = sounds.length
    let startAt = context.currentTime + 0.002

    sounds.forEach((sound, index) => {
      const buffer = this.getBuffer(sound)
      const source = context.createBufferSource()
      source.buffer = buffer
      const gain = context.createGain()
      gain.gain.setValueAtTime(1, startAt)
      source.connect(gain)
      gain.connect(master)

      const voice: ActiveVoice = { source, gain }
      this.voices.add(voice)
      source.onended = () => {
        if (!this.voices.delete(voice)) return
        if (index === total - 1) {
          this.setStatus('armed')
          onEnded?.()
        }
      }
      source.start(startAt)

      const delay = Math.max(0, (startAt - context.currentTime) * 1000)
      const timer = window.setTimeout(() => {
        this.progressTimers.delete(timer)
        if (this.voices.has(voice)) onStep?.(index + 1, total)
      }, delay)
      this.progressTimers.add(timer)

      startAt += buffer.duration + gapSeconds
    })
  }

  /** Stop whatever is playing, including a scheduled batch preview. */
  stop(): void {
    this.fadeOutVoices()
    if (this.context?.state === 'running') this.setStatus('armed')
  }

  /** Live time-domain samples for the oscilloscope. */
  getTimeDomain(): Float32Array | null {
    if (!this.analyser || this.voices.size === 0) return null
    if (this.waveform.length !== this.analyser.fftSize) {
      this.waveform = new Float32Array(this.analyser.fftSize)
    }
    this.analyser.getFloatTimeDomainData(this.waveform)
    return this.waveform
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.fadeOutVoices(0)
    try {
      void this.context?.close()
    } catch {
      // Closing an already-closed context is harmless.
    }
    this.voices.clear()
    this.context = null
    this.master = null
    this.analyser = null
    this.cachedSound = null
    this.cachedBuffer = null
  }
}
