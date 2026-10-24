/**
 * "At a glance" summary for the investor and mentor pitch page. Pure: it only condenses sections the founder
 * already chose to share (nothing is read from anywhere else), and each row keeps that section's evidence label.
 */
import type { Evidence } from "./pitch"
import type { PitchSnapshot, SharedSection } from "./shareRepo"

export type GlanceRow = { id: string; label: string; value: string; evidence: Evidence }

const lines = (t: string) => t.split("\n").map(l => l.trim()).filter(Boolean)

export function firstSentence(s: string, max = 150): string {
  const t = s.trim().replace(/\s+/g, " ")
  const cut = t.split(/(?<=[.!?])\s/)[0] ?? t
  return cut.length > max ? `${cut.slice(0, max - 1).trimEnd()}…` : cut
}

export function compactNumber(n: number): string {
  const abs = Math.abs(n)
  const f = (v: number, u: string) => `${Number.isInteger(v) ? v : v.toFixed(1)}${u}`
  if (abs >= 1e9) return f(n / 1e9, "B")
  if (abs >= 1e6) return f(n / 1e6, "M")
  if (abs >= 1e3) return f(n / 1e3, "K")
  return String(n)
}

const afterLabel = (line: string, label: string) =>
  line.toLowerCase().startsWith(`${label.toLowerCase()}:`) ? line.slice(label.length + 1).trim() : null
const findLabel = (ls: string[], label: string) => {
  for (const l of ls) { const v = afterLabel(l, label); if (v) return v }
  return null
}

type Rule = { id: string; label: string; pick: (s: SharedSection, ls: string[]) => string | null }

const RULES: Rule[] = [
  { id: "problem", label: "Problem", pick: (_s, ls) => (ls[0] ? firstSentence(ls[0]) : null) },
  { id: "solution", label: "Solution", pick: (_s, ls) => {
      const v = findLabel(ls, "Value proposition")
      return v ? firstSentence(v) : ls[0] ? firstSentence(ls[0]) : null } },
  { id: "customer", label: "Who it is for", pick: (_s, ls) => {
      const v = findLabel(ls, "First segment") ?? findLabel(ls, "Audience")
      return v ? firstSentence(v, 120) : ls[0] ? firstSentence(ls[0], 120) : null } },
  { id: "market", label: "Market size", pick: (_s, ls) => {
      const tiers: string[] = []
      for (const l of ls) {
        const m = /^(TAM|SAM|SOM):\s*([\d,]+(?:\.\d+)?)\s+per year/i.exec(l)
        if (m) tiers.push(`${m[1].toUpperCase()} ${compactNumber(Number(m[2].replace(/,/g, "")))}/yr`)
      }
      return tiers.length ? tiers.join(" · ") : ls[0] ? firstSentence(ls[0], 120) : null } },
  { id: "traction", label: "Evidence so far", pick: (_s, ls) => (ls[0] ? firstSentence(ls[0], 140) : null) },
  { id: "business", label: "Business model", pick: (_s, ls) => (ls.length ? firstSentence(ls.slice(0, 2).join(" · "), 140) : null) },
  { id: "funding", label: "Funding ask", pick: (_s, ls) => (ls.length ? firstSentence(ls.slice(0, 2).join(" · "), 140) : null) },
  { id: "team", label: "Team", pick: (_s, ls) => {
      const v = findLabel(ls, "Background")
      return v ? firstSentence(v, 130) : ls[0] ? firstSentence(ls[0], 130) : null } },
  { id: "risks", label: "Biggest risk", pick: (_s, ls) => {
      const first = ls.find(l => l.startsWith("- "))
      if (!first) return ls[0] ? firstSentence(ls[0], 130) : null
      return firstSentence(first.slice(2).split(";")[0], 130) } },
]

export function buildGlance(snap: PitchSnapshot): GlanceRow[] {
  const byId = new Map(snap.sections.map(s => [s.id, s]))
  const out: GlanceRow[] = []
  for (const r of RULES) {
    const s = byId.get(r.id)
    if (!s) continue
    const value = r.pick(s, lines(s.text))
    if (value) out.push({ id: r.id, label: r.label, value, evidence: s.evidence })
  }
  return out
}
