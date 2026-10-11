import { test } from "node:test"
import assert from "node:assert/strict"
import { computeFinancials, bottomUpMarket, marketConsistency, monthlyEquivalentPrice } from "./financials"
import { computeScorecard, deriveStatus, assumptionState, riskPriority, nextAction } from "./scorecard"
import type { FinancialInputs } from "./financials"
import type { VentureSnapshot, Idea } from "./types"

const base: FinancialInputs = {
  model: "subscription", price: 30, billing: "monthly", customers: 100,
  newCustomersPerMonth: 20, variableCostPerCustomerMonthly: 6,
  fixedCostsMonthly: 1000, acquisitionSpendMonthly: 400,
}
const get = (calcs: ReturnType<typeof computeFinancials>, id: string) => calcs.find(c => c.id === id)!

test("subscription metrics are computed with formulas shown", () => {
  const c = computeFinancials(base)
  assert.equal(get(c, "mrr").value, 3000)
  assert.equal(get(c, "arr").value, 36000)
  assert.equal(get(c, "gross_profit").value, 2400)
  assert.equal(get(c, "gross_margin").value, 80)
  assert.equal(get(c, "cac").value, 20)
  assert.equal(get(c, "contribution").value, 24)
  assert.equal(get(c, "break_even").value, 42) // ceil(1000/24)
  assert.ok(get(c, "mrr").formula.length > 0 && get(c, "mrr").limitations.length > 0)
})

test("annual billing is converted to a monthly equivalent", () => {
  assert.equal(monthlyEquivalentPrice(120, "annual"), 10)
  const c = computeFinancials({ ...base, price: 120, billing: "annual" })
  assert.equal(get(c, "mrr").value, 1000)
})

test("non-subscription models never get MRR/ARR", () => {
  const c = computeFinancials({ ...base, model: "one_time", billing: "one_time" })
  assert.equal(c.find(x => x.id === "mrr"), undefined)
  assert.equal(c.find(x => x.id === "arr"), undefined)
  assert.equal(get(c, "revenue").value, 3000)
})

test("a subscription with one-time billing is flagged, not computed", () => {
  const c = computeFinancials({ ...base, billing: "one_time" })
  assert.equal(get(c, "mrr").value, null)
  assert.ok(get(c, "mrr").missing.length > 0)
})

test("zero denominators and missing inputs yield null with reasons", () => {
  const c = computeFinancials({ ...base, newCustomersPerMonth: 0, customers: 0 })
  assert.equal(get(c, "cac").value, null)
  assert.equal(get(c, "gross_margin").value, null) // revenue 0
  const empty = computeFinancials({ ...base, price: null })
  assert.equal(get(empty, "mrr").value, null)
  assert.deepEqual(get(empty, "mrr").missing, ["price"])
})

test("negative or NaN inputs are treated as missing", () => {
  const c = computeFinancials({ ...base, price: -5, customers: Number.NaN })
  assert.equal(get(c, "mrr").value, null)
  assert.deepEqual(get(c, "mrr").missing.sort(), ["customers", "price"])
})

test("break-even is unreachable when contribution is not positive", () => {
  const c = computeFinancials({ ...base, variableCostPerCustomerMonthly: 30 })
  assert.equal(get(c, "break_even").value, null)
  assert.ok(get(c, "break_even").missing.some(m => m.includes("positive")))
})

test("bottom-up market and consistency", () => {
  assert.equal(bottomUpMarket(1000, 50).value, 50000)
  assert.equal(bottomUpMarket(null, 50).value, null)
  assert.deepEqual(marketConsistency({ tam: 10, sam: 20 }), ["SAM is larger than TAM."])
  assert.deepEqual(marketConsistency({ tam: null, sam: 20, som: 5 }), [])
})

const emptyIdea: Idea = {
  id: "i1", name: null, tagline: null, problem: null, solution: null, market: null,
  target_market: null, tech_stack: null, elevator_pitch: null, industry: null,
  startup_stage: null, business_model: null, geographic_focus: null, funding_goal: null,
  use_of_funds: null, pitch_ready_confirmed: false, blueprint: {}, pitch_settings: {},
  health_score: null, row_version: 1, updated_at: null,
}
const snap = (over: Partial<VentureSnapshot> = {}): VentureSnapshot => ({
  idea: emptyIdea, competitors: [], market: [], risks: [], milestones: [], hypotheses: [], ...over,
})

test("empty venture: every indicator scores 0 and lists what is missing", () => {
  const sc = computeScorecard(snap())
  assert.equal(sc.indicators.length, 10)
  for (const i of sc.indicators) { assert.equal(i.score, 0); assert.ok(i.missing.length > 0); assert.ok(i.action) }
  assert.equal(deriveStatus(snap(), sc), "draft")
})

test("draftStrength is the unchanged checkIdea output and kept separate", () => {
  const sc = computeScorecard(snap({ idea: { ...emptyIdea, problem: "x" } }))
  assert.equal(sc.draftStrength.hasContent, true)
  assert.equal(typeof sc.draftStrength.score, "number")
})

test("completing forms never yields a 'validated' status; pitch_ready needs explicit confirmation", () => {
  const full = snap({
    idea: {
      ...emptyIdea, name: "N", tagline: "T", problem: "p ".repeat(20), solution: "s ".repeat(20),
      market: "2nd-year CS students in Jalandhar", pitch_ready_confirmed: false,
      blueprint: { persona: { segment: "CS students" }, business: { model: "subscription" },
        mvp: { objective: "o" }, team: { background: "b" } },
      pitch_settings: { include: { problem: true } },
    },
    risks: [{ id: "r", title: "t", kind: "risk", category: "customer_demand", likelihood: 3, impact: 3, evidence_status: "unknown" }],
    milestones: [{ id: "m", title: "Launch", priority: "must", kind: "milestone", target_date: "2026-12-01", done: false }],
  })
  assert.equal(deriveStatus(full), "exploring")
  const confirmed = snap({ ...full, idea: { ...full.idea, pitch_ready_confirmed: true } })
  assert.equal(deriveStatus(confirmed), "pitch_ready")
})

test("a hypothesis marked supported without experiments produces a warning, not credit", () => {
  const sc = computeScorecard(snap({
    hypotheses: [{ id: "h", status: "validated", experimentCount: 0, success_metric: "m", success_threshold: "t" }],
  }))
  const v = sc.indicators.find(i => i.id === "validation")!
  assert.ok(v.warnings.length === 1)
  assert.ok(v.missing.includes("At least one experiment recorded"))
})

test("assumption lifecycle never infers 'supported' from experiments", () => {
  assert.equal(assumptionState(null), "untested")
  assert.equal(assumptionState({ id: "h", status: "testing", experimentCount: 0 }), "experiment_planned")
  assert.equal(assumptionState({ id: "h", status: "testing", experimentCount: 3 }), "evidence_recorded")
  assert.equal(assumptionState({ id: "h", status: "validated", experimentCount: 1 }), "supported")
  assert.equal(assumptionState({ id: "h", status: "invalidated", experimentCount: 1 }), "rejected")
  assert.equal(assumptionState({ id: "h", status: "inconclusive", experimentCount: 1 }), "inconclusive")
})

test("risk priority and next action", () => {
  assert.equal(riskPriority({ likelihood: 5, impact: 3 }), "high")
  assert.equal(riskPriority({ likelihood: 2, impact: 4 }), "medium")
  assert.equal(riskPriority({ likelihood: 1, impact: 2 }), "low")
  const s = snap({ risks: [{ id: "r", title: "Students won't pay", kind: "assumption", category: "pricing",
    likelihood: 5, impact: 4, evidence_status: "unknown" }] })
  const n = nextAction(s)
  assert.match(n.text, /Students won't pay/)
  assert.equal(n.target, "risks")
})

test("market indicator flags SOM larger than SAM", () => {
  const sc = computeScorecard(snap({ market: [
    { tier: "sam", customer_count: 100, annual_spend_per_customer: 10, evidence_status: "assumption", basis: "b" },
    { tier: "som", customer_count: 500, annual_spend_per_customer: 10, evidence_status: "assumption", basis: "b" },
  ] }))
  const m = sc.indicators.find(i => i.id === "market_evidence")!
  assert.deepEqual(m.warnings, ["SOM is larger than SAM."])
})
