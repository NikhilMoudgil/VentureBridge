import { useEffect, useRef, type ReactNode } from "react"
import { animate, motion, useReducedMotion, type Variants } from "framer-motion"
import { cn } from "@/lib/utils"

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1]

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

const rise: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } },
}

/** One page-load sequence: every <Reveal> inside a <Stagger> enters in order. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  )
}

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={rise} className={className}>
      {children}
    </motion.div>
  )
}

/** Counts up on first paint; after that, tweens from the previous number (e.g. after Accept). */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef<number | null>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const from = shown.current ?? 0
    if (reduce || from === value) {
      node.textContent = String(value)
      shown.current = value
      return
    }
    const controls = animate(from, value, {
      duration: 1.1,
      delay: shown.current === null ? 0.3 : 0,
      ease: "easeOut",
      onUpdate: (v) => {
        shown.current = v
        node.textContent = String(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [value, reduce])

  return (
    <span ref={ref} className={className}>
      0
    </span>
  )
}

export function ProgressRing({
  value,
  size = 88,
  stroke = 6,
  textClass = "text-lg",
}: {
  value: number
  size?: number
  stroke?: number
  textClass?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-zinc-200 dark:stroke-zinc-800"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          className="stroke-indigo-500"
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(100, value) / 100) }}
          transition={{ duration: 1.1, ease: "easeOut", delay: 0.4 }}
        />
      </svg>
      <div className={cn("absolute inset-0 grid place-items-center font-semibold tabular-nums", textClass)}>
        <CountUp value={value} />
      </div>
    </div>
  )
}

export function Initials({ name, className }: { name: string; className?: string }) {
  const text =
    (name || "?")
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  return (
    <span
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-900 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900",
        className
      )}
    >
      {text}
    </span>
  )
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
