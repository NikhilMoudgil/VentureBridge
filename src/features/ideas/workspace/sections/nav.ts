import type { VentureApi } from "../useVenture"
import type { VentureData } from "../ventureRepo"

export type SectionKey =
  | "overview" | "blueprint" | "market" | "business" | "execution" | "risks" | "pitch" | "scorecard"

export const SECTIONS: { key: SectionKey; num: string; label: string; blurb: string }[] = [
  { key: "overview", num: "", label: "Overview", blurb: "Where this venture stands and what to do next" },
  { key: "blueprint", num: "01", label: "Venture Blueprint", blurb: "Problem, solution and customer persona" },
  { key: "market", num: "02", label: "Customer & Market", blurb: "Alternatives and market-size estimates" },
  { key: "business", num: "03", label: "Business Model", blurb: "Who pays, pricing and unit economics" },
  { key: "execution", num: "04", label: "Product & Execution", blurb: "MVP scope, team and roadmap" },
  { key: "risks", num: "05", label: "Risks & Validation", blurb: "Assumptions, hypotheses and evidence" },
  { key: "pitch", num: "06", label: "Pitch Studio", blurb: "Editable pitch you choose how to share" },
  { key: "scorecard", num: "07", label: "Venture Scorecard", blurb: "What is filled in, what is missing, and why" },
]

export const isSectionKey = (v: string | null): v is SectionKey => SECTIONS.some(s => s.key === v)

/** Which screen to open to improve each scorecard indicator (also used for "next action"). */
export const INDICATOR_SECTION: Record<string, SectionKey> = {
  completeness: "blueprint",
  problem_clarity: "blueprint",
  customer_specificity: "blueprint",
  differentiation: "market",
  market_evidence: "market",
  business_model: "business",
  execution: "execution",
  validation: "risks",
  risk_coverage: "risks",
  pitch: "pitch",
  risks: "risks",
}

export type SectionProps = { data: VentureData; api: VentureApi }
