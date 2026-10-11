/**
 * Deterministic, explainable venture scorecard. A SEPARATE layer from checkIdea():
 *  - checkIdea()  = how complete/specific the written Problem/Solution/Market draft is.
 *  - scorecard    = ten independent indicators, each with met / missing items and an action.
 * Nothing here estimates demand, investor readiness or odds of success. A completed form
 * is not evidence of a good business.
 */
import { checkIdea, type IdeaCheck } from "../ideaCheck"
import { bottomUpMarket, marketConsistency } from "./financials"
import type {
  AssumptionState, HypothesisLite, Risk, VentureSnapshot, WorkspaceStatus,
} from "./types"

export type Indicator = {
  id: string
  label: string
  assesses: string
  why: string
  /** 0-100 = share of checklist items met. Not a probability of anything. */
  score: number
  met: string[]
  missing: string[]
  warnings: string[]
  action: string
}

type Item = { label: string; ok: boolean }

const words = (s?: string | null) => (s ?? "").trim().split(/\s+/).filter(Boolean).length
const has = (s?: string | null) => (s ?? "").trim().length > 0
const BROAD = /\b(everyone|everybody|anyone|all people|all businesses|all users|general public|the world)\b/i

function build(
  id: string, label: string, assesses: string, why: string,
  items: Item[], action: string, warnings: string[] = [],
): Indicator {
  const met = items.filter(i => i.ok).map(i => i.label)
  const missing = items.filter(i => !i.ok).map(i => i.label)
  const score = items.length ? Math.round((met.length / items.length) * 100) : 0
  return { id, label, assesses, why, score, met, missing, warnings,
           action: missing.length ? action : "Nothing missing on this checklist. Keep it current as you learn." }
}

export const riskPriority = (r: Pick<Risk, "likelihood" | "impact">): "high" | "medium" | "low" => {
  const p = r.likelihood * r.impact
  return p >= 15 ? "high" : p >= 8 ? "medium" : "low"
}

/** Lifecycle of an assumption. An experiment existing never implies "supported". */
export function assumptionState(h: HypothesisLite | undefined | null): AssumptionState {
  if (!h) return "untested"
  if (h.status === "validated") return "supported"
  if (h.status === "invalidated") return "rejected"
  if (h.status === "inconclusive") return "inconclusive"
  return h.experimentCount > 0 ? "evidence_recorded" : "experiment_planned"
}

export function computeScorecard(s: VentureSnapshot): {
  indicators: Indicator[]
  completion: number
  draftStrength: IdeaCheck
} {
  const { idea, competitors, market, risks, milestones, hypotheses } = s
  const b = idea.blueprint ?? {}
  const marketText = idea.market || idea.target_market || ""
  const hypById = new Map(hypotheses.map(h => [h.id, h]))
  const mustHaves = milestones.filter(m => m.kind === "feature" && m.priority === "must")
  const tier = (t: "tam" | "sam" | "som") => market.find(m => m.tier === t)
  const highRisks = risks.filter(r => riskPriority(r) === "high")

  const completeness = build(
    "completeness", "Blueprint completeness",
    "How many core blueprint fields have any content.",
    "Gaps here are the cheapest improvements to make and unblock every other section.",
    [
      { label: "Venture name", ok: has(idea.name) },
      { label: "One-line description", ok: has(idea.tagline) },
      { label: "Problem", ok: has(idea.problem) },
      { label: "Solution", ok: has(idea.solution) },
      { label: "Target market", ok: has(marketText) },
      { label: "Customer segment", ok: has(b.persona?.segment) },
      { label: "Business model type", ok: !!b.business?.model || has(idea.business_model) },
      { label: "MVP objective", ok: has(b.mvp?.objective) },
      { label: "At least one risk or assumption", ok: risks.length > 0 },
      { label: "Founder background", ok: has(b.team?.background) },
    ],
    "Fill the missing fields above, starting with name, problem and customer segment.",
  )

  const p = b.problem ?? {}
  const problemClarity = build(
    "problem_clarity", "Problem clarity",
    "Whether the problem is specific, quantified and grounded in observation.",
    "Investors and mentors reject vague problems first; customers only pay for painful, frequent ones.",
    [
      { label: "Problem statement of at least 15 words", ok: words(idea.problem) >= 15 },
      { label: "Who experiences it", ok: has(p.who) },
      { label: "How often / how severe", ok: has(p.frequency) || has(p.severity) },
      { label: "Cost or consequence", ok: has(p.consequences) },
      { label: "Current workarounds", ok: has(p.workarounds) },
      { label: "Observed facts recorded (separate from assumptions)", ok: has(p.observations) },
    ],
    "Talk to five affected people and record what you actually observed under 'Observations'.",
    has(p.assumptions) && !has(p.observations)
      ? ["Only assumptions are recorded; no observed facts yet."] : [],
  )

  const per = b.persona ?? {}
  const customerSpecificity = build(
    "customer_specificity", "Customer specificity",
    "Whether the first customer is a reachable, named group, and whether user and buyer are separated.",
    "A narrow first segment lets you run real tests this month; 'everyone' cannot be tested.",
    [
      { label: "Segment named", ok: has(per.segment) },
      { label: "Segment is not 'everyone'", ok: has(per.segment) && !BROAD.test(per.segment ?? "") && !BROAD.test(marketText) },
      { label: "Primary user described", ok: has(per.primaryUser) },
      { label: "Economic buyer stated (write 'same as user' if so)", ok: has(per.economicBuyer) },
      { label: "Early-adopter traits", ok: has(per.earlyAdopters) },
      { label: "Geographic focus", ok: has(per.geography) || has(idea.geographic_focus) },
    ],
    "Pick one segment you can contact personally and state who uses it versus who pays.",
  )

  const sol = b.solution ?? {}
  const differentiation = build(
    "differentiation", "Solution differentiation",
    "Whether the claimed difference is stated and compared with real alternatives.",
    "'Unique' is a claim; a comparison against what customers use today is support for it.",
    [
      { label: "Differentiation stated", ok: has(sol.differentiation) },
      { label: "Reason customers would switch", ok: has(sol.whySwitch) },
      { label: "At least one alternative listed", ok: competitors.length > 0 },
      { label: "A non-product alternative listed (spreadsheet, manual process)", ok: competitors.some(c => c.kind === "non_product") },
      { label: "Each listed alternative has strengths or limitations", ok: competitors.length > 0 && competitors.every(c => has(c.strengths) || has(c.limitations)) },
      { label: "Limitations of your own solution acknowledged", ok: has(sol.limitations) },
    ],
    "List what customers use today, including manual workarounds, and compare honestly.",
    has(sol.differentiation) && competitors.length === 0
      ? ["Differentiation is asserted without any listed alternative to compare against."] : [],
  )

  const tam = tier("tam"), sam = tier("sam"), som = tier("som")
  const val = (m?: typeof tam) => (m ? bottomUpMarket(m.customer_count, m.annual_spend_per_customer).value : null)
  const issues = marketConsistency({ tam: val(tam), sam: val(sam), som: val(som) })
  const sourced = market.filter(m => m.evidence_status === "researched" || m.evidence_status === "validated")
  const marketEvidence = build(
    "market_evidence", "Market evidence",
    "Whether market size is calculated transparently and backed by dated sources.",
    "An unsourced market number is an assumption; labelling it as one keeps the pitch honest.",
    [
      { label: "Bottom-up customer count × spend entered for at least one tier", ok: market.some(m => val(m) !== null) },
      { label: "SAM or SOM estimated (not only TAM)", ok: val(sam) !== null || val(som) !== null },
      { label: "Basis of each estimate explained", ok: market.length > 0 && market.every(m => has(m.basis)) },
      { label: "At least one figure marked researched or validated", ok: sourced.length > 0 },
      { label: "Researched figures cite a source and date", ok: sourced.length > 0 && sourced.every(m => has(m.source_url) && has(m.source_date)) },
      { label: "TAM ≥ SAM ≥ SOM", ok: market.length > 0 && issues.length === 0 },
    ],
    "Estimate customers × annual spend for your first segment, and record where each number came from.",
    issues,
  )

  const bm = b.business ?? {}
  const businessModel = build(
    "business_model", "Business-model clarity",
    "Whether it is clear who pays, for what, how much, and how customers are reached.",
    "Founders often describe a product without describing a business.",
    [
      { label: "Business model type chosen", ok: !!bm.model || has(idea.business_model) },
      { label: "Who pays", ok: has(bm.whoPays) },
      { label: "What they pay for", ok: has(bm.paysFor) },
      { label: "Price and billing interval", ok: typeof bm.price === "number" && bm.price >= 0 && !!bm.billing },
      { label: "Acquisition channels", ok: has(bm.acquisitionChannels) },
      { label: "Cost to deliver or run", ok: typeof bm.variableCostPerCustomerMonthly === "number" || has(bm.ongoingExpenses) },
    ],
    "State the price, who pays and the first channel you will use to reach them.",
  )

  const t = b.tech ?? {}
  const execution = build(
    "execution", "Execution readiness",
    "Whether the smallest testable MVP, its owners and its dates are defined.",
    "A defined MVP lets you test demand before building everything. Tech sophistication is not scored.",
    [
      { label: "MVP objective", ok: has(b.mvp?.objective) },
      { label: "At least one Must-have feature", ok: mustHaves.length > 0 },
      { label: "At least one dated milestone", ok: milestones.some(m => m.kind === "milestone" && has(m.target_date)) },
      { label: "Implementation approach", ok: has(t.architecture) || has(idea.tech_stack) },
      { label: "Capability gaps identified", ok: has(t.gaps) || has(b.team?.gaps) },
      { label: "MVP budget estimate", ok: typeof b.team?.mvpBudget === "number" },
      { label: "First-release success metric", ok: has(b.mvp?.successMetric) },
    ],
    "Define the smallest version you could test in 2–4 weeks and one metric for it.",
  )

  const defined = hypotheses.filter(h => has(h.success_metric) && has(h.success_threshold))
  const withExp = hypotheses.filter(h => h.experimentCount > 0)
  const supportedNoExp = hypotheses.filter(h => h.status === "validated" && h.experimentCount === 0)
  const validation = build(
    "validation", "Validation evidence",
    "Whether assumptions have defined tests and recorded results. Self-rated signal scores are not counted.",
    "Only real customer behaviour reduces uncertainty.",
    [
      { label: "At least one hypothesis", ok: hypotheses.length > 0 },
      { label: "Hypothesis with a metric and success threshold", ok: defined.length > 0 },
      { label: "At least one experiment recorded", ok: withExp.length > 0 },
      { label: "A concluded hypothesis (supported, rejected or inconclusive) backed by an experiment",
        ok: hypotheses.some(h => h.status !== "testing" && h.experimentCount > 0) },
    ],
    "Turn your highest-priority risk into a hypothesis with a threshold, then log the result.",
    supportedNoExp.length
      ? [`${supportedNoExp.length} hypothesis marked supported without any recorded experiment.`] : [],
  )

  const cats = new Set(risks.map(r => r.category))
  const riskCoverage = build(
    "risk_coverage", "Risk coverage",
    "Whether major risk categories are considered and top risks have a plan. Not a risk score.",
    "Unknowns you have not written down are the ones that surprise you.",
    [
      { label: "At least three risks or assumptions", ok: risks.length >= 3 },
      { label: "Customer-demand risk recorded", ok: cats.has("customer_demand") },
      { label: "Risks span at least three categories", ok: cats.size >= 3 },
      { label: "Every high-priority risk has a mitigation or linked hypothesis",
        ok: highRisks.length > 0 && highRisks.every(r => has(r.mitigation) || (r.hypothesis_id && hypById.has(r.hypothesis_id))) },
      { label: "At least one high-priority risk identified", ok: highRisks.length > 0 },
    ],
    "Add the three things most likely to make this fail and attach a test to the worst one.",
  )

  const incl = idea.pitch_settings?.include ?? {}
  const pitch = build(
    "pitch", "Pitch completeness",
    "Whether the shareable pitch has content for its core sections.",
    "A pitch with honest gaps is fine; a pitch that hides them is not.",
    [
      { label: "Name and one-liner", ok: has(idea.name) && has(idea.tagline) },
      { label: "Problem and solution", ok: has(idea.problem) && has(idea.solution) },
      { label: "Target customer", ok: has(per.segment) || has(marketText) },
      { label: "Business model", ok: !!bm.model || has(idea.business_model) },
      { label: "MVP plan", ok: has(b.mvp?.objective) },
      { label: "Team background", ok: has(b.team?.background) },
      { label: "At least one next milestone", ok: milestones.some(m => m.kind === "milestone" && !m.done) },
      { label: "At least one section selected for sharing", ok: Object.values(incl).some(Boolean) },
    ],
    "Complete the missing sections, then choose which ones to share.",
  )

  const indicators = [completeness, problemClarity, customerSpecificity, differentiation,
    marketEvidence, businessModel, execution, validation, riskCoverage, pitch]

  const draftStrength = checkIdea({
    problem: idea.problem ?? "", solution: idea.solution ?? "",
    market: marketText, techStack: idea.tech_stack ?? "",
  })
  return { indicators, completion: completeness.score, draftStrength }
}

/**
 * Lifecycle label. "Validated" is intentionally not a status: filling forms never validates.
 * pitch_ready needs an explicit founder confirmation AND a minimally complete pitch.
 */
export function deriveStatus(s: VentureSnapshot, sc = computeScorecard(s)): WorkspaceStatus {
  const pitch = sc.indicators.find(i => i.id === "pitch")!.score
  if (s.idea.pitch_ready_confirmed && pitch >= 75) return "pitch_ready"
  if (s.hypotheses.some(h => h.experimentCount > 0)) return "validating"
  if (sc.completion >= 40) return "exploring"
  return "draft"
}

/** The single most useful next step, chosen by fixed rules (no hidden weighting). */
export function nextAction(s: VentureSnapshot, sc = computeScorecard(s)): { text: string; target: string } {
  const linked = new Set(s.risks.map(r => r.hypothesis_id).filter(Boolean))
  const topUntested = s.risks
    .filter(r => riskPriority(r) === "high" && !r.hypothesis_id && !linked.has(r.id))
    .sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact)[0]
  if (topUntested) return { text: `Turn "${topUntested.title}" into a testable hypothesis.`, target: "risks" }
  const order = ["completeness", "problem_clarity", "customer_specificity", "business_model",
    "risk_coverage", "validation", "execution", "pitch"]
  for (const id of order) {
    const ind = sc.indicators.find(i => i.id === id)!
    if (ind.missing.length) return { text: ind.action, target: id }
  }
  return { text: "Run an experiment and record the result.", target: "validation" }
}
