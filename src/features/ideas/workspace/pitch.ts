/**
 * Pitch Studio content. Pure and deterministic: turns what the founder has entered into pitch
 * sections, labels where each section's substance comes from, and never states more than the data
 * supports (a venture is never called "validated"; calculated figures are labelled as founder
 * assumptions; empty sections stay visibly empty).
 */
import { bottomUpMarket, computeFinancials } from "./financials"
import { assumptionState, riskPriority } from "./scorecard"
import type { AssumptionState, HypothesisLite, PitchSettings, VentureSnapshot } from "./types"

export type Evidence = "founder" | "calculated" | "experiment" | "assumption" | "missing"

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  founder: "Founder-provided",
  calculated: "Calculated from founder assumptions",
  experiment: "Based on recorded experiments",
  assumption: "Assumption, not yet evidenced",
  missing: "Not provided yet",
}

export type PitchSection = {
  id: string
  title: string
  /** Generated draft. Empty string = nothing to say yet. */
  text: string
  evidence: Evidence
  note?: string
}

export type ResolvedSection = PitchSection & { overridden: boolean; included: boolean }

export type PitchHypothesis = HypothesisLite & { title: string }

const has = (s?: string | null): s is string => (s ?? "").trim().length > 0
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 })
const clip = (s: string, n = 400) => (s.trim().length > n ? `${s.trim().slice(0, n - 1)}…` : s.trim())

/** Identical to the sentence the original IdeaLab stored in ideas.elevator_pitch. */
export function legacyElevatorPitch(d: { market?: string | null; problem?: string | null; solution?: string | null }): string {
  const market = d.market || "[Target Market]"
  const probSnippet = d.problem ? d.problem.split(".")[0] : "[Specific Pain Point]"
  const solSnippet = d.solution ? d.solution.split(".")[0] : "[Unique Value]"
  return `For ${market} who experience ${probSnippet}, our product provides ${solSnippet}.`
}

const STATE_LABEL: Record<AssumptionState, string> = {
  untested: "untested",
  experiment_planned: "experiment planned, nothing recorded yet",
  evidence_recorded: "evidence recorded, no conclusion yet",
  supported: "marked supported by the founder",
  rejected: "rejected",
  inconclusive: "inconclusive",
}

const lines = (...parts: (string | false | null | undefined)[]) => parts.filter((p): p is string => !!p).join("\n")
const kv = (label: string, v?: string | null) => has(v) && `${label}: ${clip(v)}`

export function buildPitch(s: VentureSnapshot, hyps: PitchHypothesis[]): PitchSection[] {
  const { idea, competitors, market, risks, milestones } = s
  const b = idea.blueprint ?? {}
  const out: PitchSection[] = []
  const add = (id: string, title: string, text: string, evidence: Evidence, note?: string) =>
    out.push({ id, title, text, evidence: text ? evidence : "missing", ...(note ? { note } : {}) })

  // Summary
  add("summary", "Executive summary",
    lines(
      has(idea.name) && `${idea.name!.trim()}${has(idea.tagline) ? `: ${idea.tagline!.trim()}` : ""}`,
      !has(idea.name) && has(idea.tagline) && idea.tagline!.trim(),
      kv("Stage", idea.startup_stage?.replace("_", " ")),
      kv("Industry", idea.industry),
      kv("Focus", idea.geographic_focus ?? b.persona?.geography),
    ), "founder")

  // Elevator pitch (generated from three fields; only when all three exist)
  const marketText = idea.market || idea.target_market
  const haveThree = has(idea.problem) && has(idea.solution) && has(marketText)
  add("elevator", "Elevator pitch",
    haveThree ? legacyElevatorPitch({ market: marketText, problem: idea.problem, solution: idea.solution }) : "",
    "founder", haveThree ? undefined : "Needs a problem, a solution and a target audience.")

  // Problem
  const p = b.problem ?? {}
  add("problem", "The problem",
    lines(has(idea.problem) && clip(idea.problem!, 700), kv("Who", p.who), kv("How often", p.frequency),
      kv("How severe", p.severity), kv("Consequences", p.consequences), kv("Today they", p.workarounds),
      kv("Observed", p.observations)),
    has(p.observations) ? "founder" : "assumption",
    has(p.observations) ? undefined : "No observed facts recorded yet: this describes the problem as you believe it to be.")

  // Solution
  const so = b.solution ?? {}
  add("solution", "The solution",
    lines(has(idea.solution) && clip(idea.solution!, 700), kv("Value proposition", so.valueProposition),
      kv("How it works", so.howItWorks), kv("Different because", so.differentiation), kv("Why switch", so.whySwitch)),
    "founder")

  // Customer
  const pe = b.persona ?? {}
  add("customer", "Target customer",
    lines(kv("Audience", marketText), kv("First segment", pe.segment), kv("User", pe.primaryUser),
      kv("Buyer", pe.economicBuyer), kv("Early adopters", pe.earlyAdopters)),
    "founder")

  // Market (calculated, labelled as assumptions unless sourced)
  const tiers = (["tam", "sam", "som"] as const).flatMap(t => {
    const m = market.find(x => x.tier === t)
    if (!m) return []
    const v = bottomUpMarket(m.customer_count, m.annual_spend_per_customer).value
    if (v === null) return []
    const src = m.evidence_status === "researched" || m.evidence_status === "validated"
      ? `${m.evidence_status}${has(m.source_url) ? `, source ${m.source_url}` : ""}${has(m.source_date) ? ` (${m.source_date})` : ""}`
      : "founder assumption"
    return [`${t.toUpperCase()}: ${fmt(v)} per year (${fmt(m.customer_count!)} customers × ${fmt(m.annual_spend_per_customer!)} per year; ${src}${has(m.basis) ? `; basis: ${clip(m.basis!, 160)}` : ""})`]
  })
  const anySourced = market.some(m => m.evidence_status === "researched" || m.evidence_status === "validated")
  add("market", "Market size", tiers.join("\n"), "calculated",
    tiers.length && !anySourced ? "All market figures are founder assumptions; no researched source is recorded." : undefined)

  // Competition
  add("competition", "Alternatives and competition",
    competitors.map(c => `- ${c.name} (${c.kind.replace("_", "-")})${has(c.limitations) ? `: ${clip(c.limitations!, 160)}` : ""}${has(c.differentiation) ? ` We differ: ${clip(c.differentiation!, 160)}` : ""}`).join("\n"),
    "founder")

  // Business model
  const bm = b.business ?? {}
  let calcLine = ""
  if (bm.model) {
    const calcs = computeFinancials({
      model: bm.model, price: bm.price, billing: bm.billing ?? "monthly", customers: bm.customers,
      newCustomersPerMonth: bm.newCustomersPerMonth, variableCostPerCustomerMonthly: bm.variableCostPerCustomerMonthly,
      fixedCostsMonthly: bm.fixedCostsMonthly, acquisitionSpendMonthly: bm.acquisitionSpendMonthly,
    })
    const pick = (id: string) => calcs.find(c => c.id === id)?.value ?? null
    const bits = [
      pick("mrr") !== null && `MRR ${fmt(pick("mrr")!)}`,
      pick("revenue") !== null && `revenue per month ${fmt(pick("revenue")!)}`,
      pick("gross_margin") !== null && `gross margin ${fmt(pick("gross_margin")!)}%`,
      pick("cac") !== null && `CAC ${fmt(pick("cac")!)}`,
      pick("break_even") !== null && `break-even at ${fmt(pick("break_even")!)} customers`,
    ].filter(Boolean)
    if (bits.length) calcLine = `Planning scenario (founder assumptions, not a forecast): ${bits.join(", ")}.`
  }
  const bmText = lines(kv("Model", bm.model?.replace("_", " ") ?? idea.business_model), kv("Who pays", bm.whoPays),
    kv("Pays for", bm.paysFor), typeof bm.price === "number" && `Price: ${fmt(bm.price)} ${bm.billing === "one_time" ? "one time" : `per ${bm.billing ?? "month"}`}`,
    kv("Reaching customers", bm.acquisitionChannels), calcLine)
  add("business", "Business model", bmText, calcLine ? "calculated" : "founder")

  // Traction and evidence (never claims validation)
  const withExp = hyps.filter(h => h.experimentCount > 0).length
  const concluded = hyps.filter(h => h.status !== "testing")
  const tractionText = hyps.length === 0 ? "" : lines(
    `${hyps.length} hypothes${hyps.length === 1 ? "is" : "es"} defined; ${withExp} with recorded experiments.`,
    ...concluded.map(h => {
      const st = assumptionState(h)
      const gap = h.status === "validated" && h.experimentCount === 0 ? "; no experiment is recorded to back this" : ""
      return `- "${h.title}": ${STATE_LABEL[st]} (${h.experimentCount} experiment${h.experimentCount === 1 ? "" : "s"} recorded${gap})`
    }),
  )
  add("traction", "Evidence and traction", tractionText, withExp > 0 ? "experiment" : "assumption",
    hyps.length === 0 ? "No hypotheses or experiments recorded yet." : withExp === 0 ? "Hypotheses are defined but no experiment is recorded yet." : undefined)

  // Execution
  const must = milestones.filter(m => m.kind === "feature" && m.priority === "must")
  const next = milestones.filter(m => m.kind === "milestone" && !m.done)
    .sort((a, c) => (a.target_date ?? "9999").localeCompare(c.target_date ?? "9999")).slice(0, 3)
  add("execution", "MVP and roadmap",
    lines(kv("MVP goal", b.mvp?.objective), kv("First success metric", b.mvp?.successMetric),
      must.length > 0 && `Must-have features: ${must.map(m => m.title).join("; ")}`,
      next.length > 0 && `Next milestones: ${next.map(m => `${m.title}${m.target_date ? ` (${m.target_date})` : ""}`).join("; ")}`,
      kv("Approach", b.tech?.architecture ?? idea.tech_stack)),
    "founder")

  // Team
  const t = b.team ?? {}
  add("team", "Team",
    lines(kv("Background", t.background), kv("Members", t.members), kv("Skills", t.skills),
      kv("Gaps", t.gaps), kv("Advisors", t.advisors)),
    "founder")

  // Funding
  add("funding", "Funding needs",
    lines(typeof idea.funding_goal === "number" && `Seeking: ${fmt(idea.funding_goal)}`, kv("Use of funds", idea.use_of_funds)),
    "founder", "Funding goal and use of funds are stored on the venture record, which other signed-in members can read.")

  // Risks
  const top = [...risks].sort((a, c) => c.likelihood * c.impact - a.likelihood * a.impact).slice(0, 3)
  add("risks", "Key risks and how we will test them",
    top.map(r => {
      const hyp = r.hypothesis_id ? hyps.find(h => h.id === r.hypothesis_id) : undefined
      return `- ${r.title} (${riskPriority(r)} priority)${has(r.mitigation) ? `; mitigation: ${clip(r.mitigation!, 160)}` : ""}${hyp ? `; test: "${hyp.title}", ${STATE_LABEL[assumptionState(hyp)]}` : ""}`
    }).join("\n"),
    "founder")

  return out
}

/** Applies founder overrides and share flags. An override is the founder's own text, so it is labelled founder-provided. */
export function resolvePitch(sections: PitchSection[], settings: PitchSettings | undefined): ResolvedSection[] {
  const overrides = settings?.overrides ?? {}
  const include = settings?.include ?? {}
  return sections.map(sec => {
    const o = overrides[sec.id]
    const overridden = has(o)
    return {
      ...sec,
      text: overridden ? o!.trim() : sec.text,
      evidence: overridden ? "founder" : sec.evidence,
      overridden,
      included: Boolean(include[sec.id]),
    }
  })
}

/** Markdown for the sections the founder chose to share. Gaps stay visible. */
export function compilePitchMarkdown(name: string | null, resolved: ResolvedSection[]): string {
  const chosen = resolved.filter(s => s.included)
  const body = chosen.map(s =>
    `## ${s.title}\n\n${s.text || "_Not provided yet._"}\n\n_${EVIDENCE_LABEL[s.evidence]}_`).join("\n\n")
  return `# ${has(name) ? name.trim() : "Untitled venture"}\n\n${body || "_No sections selected yet._"}\n`
}

/** Share-readiness helper: sections that have content but are not selected. */
export const sectionsWithContent = (resolved: ResolvedSection[]) => resolved.filter(s => has(s.text)).map(s => s.id)
