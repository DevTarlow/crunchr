import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export function CrunchMark(props: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M3 23h6.5l2.8-12.5L18 33l4.4-26 4.3 16.2 2.4-5.3H37"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path d="M3 32.5h34" stroke="currentColor" strokeWidth="1.4" opacity="0.35" />
    </svg>
  )
}

export function SparkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2.8 14.1 9l6.2 2.1-6.2 2.1L12 19.4l-2.1-6.2-6.2-2.1L9.9 9 12 2.8Z" />
      <path d="M19 16.5 19.9 19l2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9.9-2.5Z" />
    </IconBase>
  )
}

export function MutateIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h3.2c4.1 0 5.5 10 9.6 10H20" />
      <path d="m17 14 3 3-3 3" />
      <path d="M4 17h3.2c1.4 0 2.5-1.2 3.5-2.8" />
      <path d="M15.2 8.9c.5-.9 1-1.9 1.6-1.9H20" />
      <path d="m17 4 3 3-3 3" />
    </IconBase>
  )
}

export function DownloadIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3v11" />
      <path d="m7.5 10 4.5 4.5L16.5 10" />
      <path d="M4 16.5v3.7h16v-3.7" />
    </IconBase>
  )
}

export function ArchiveIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 6.5h18v4H3z" />
      <path d="M4.5 10.5v9h15v-9" />
      <path d="M9.5 14h5" />
      <path d="M9.5 3v3.5M14.5 3v3.5" />
    </IconBase>
  )
}

export function TriggerIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M13.6 2.5 5.2 13h5.1l-1 8.5 8.6-11.2h-5.1l.8-7.8Z" />
    </IconBase>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m4 12.5 5.2 5L20 6" />
    </IconBase>
  )
}

export function AlertIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v5" />
      <path d="M12 17.5h.01" />
    </IconBase>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m5 5 14 14M19 5 5 19" />
    </IconBase>
  )
}

export function SlidersIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h8M16 7h4M4 17h3M11 17h9" />
      <path d="M15 4v6M8 14v6" />
    </IconBase>
  )
}

export function SpeakerIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 9h4l5-4v14l-5-4H4V9Z" />
      <path d="M17 8.5a5 5 0 0 1 0 7" />
      <path d="M19.5 6a8.5 8.5 0 0 1 0 12" />
    </IconBase>
  )
}

export function InfoIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19Z" />
      <path d="M12 10.8v6.1" />
      <path d="M12 7.2h.01" />
    </IconBase>
  )
}

export function RerollIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 11.2a8 8 0 1 0-2.4 7" />
      <path d="M20 4.5v6.7h-6.7" />
    </IconBase>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7.5 4.8 19.2 12 7.5 19.2V4.8Z" />
    </IconBase>
  )
}

export function StopIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6.5 6.5h11v11h-11z" />
    </IconBase>
  )
}
