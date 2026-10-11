/**
 * Transparent planning calculators. Every result carries its formula, the inputs it used,
 * which inputs were missing/invalid, and its limitations. These are planning estimates,
 * not forecasts. Pure and deterministic.
 */
import type { BillingInterval, BusinessModelType } from "./types"

export type Calc = {
  id: string
  label: string
  unit: "currency" | "percent" | "count"
  value: number | null
  formula: string
  inputs: Record<string, number | null>
  missing: string[]
  limitations: string
}

export type FinancialInputs = {
  model: BusinessModelType
  price: number | null | undefined
  billing: BillingInterval
  /** subscription: active paying customers; other models: purchases/transactions per month */
  customers: number | null | undefined
  newCustomersPerMonth: number | null | undefined
  variableCostPerCustomerMonthly: number | null | undefined
  fixedCostsMonthly: number | null | undefined
  acquisitionSpendMonthly: number | null | undefined
}

/** A usable input is a finite, non-negative number. Anything else counts as missing. */
const clean = (n: number | null | undefined): number | null =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null

const MONTHS: Record<Exclude<BillingInterval, "one_time">, number> = {
  monthly: 1, quarterly: 3, annual: 12,
}

/** Price expressed per month. One-time prices are NOT annualised. */
export function monthlyEquivalentPrice(price: number, billing: BillingInterval): number | null {
  if (billing === "one_time") return price
  return price / MONTHS[billing]
}

const round2 = (n: number) => Math.round(n * 100) / 100

function make(
  base: Omit<Calc, "value" | "missing">,
  needed: Record<string, number | null>,
  compute: () => number | null,
  extraMissing: string[] = [],
): Calc {
  const missing = [...Object.entries(needed).filter(([, v]) => v === null).map(([k]) => k), ...extraMissing]
  const value = missing.length ? null : compute()
  return { ...base, value: value === null || !Number.isFinite(value) ? null : round2(value), missing }
}

export function computeFinancials(raw: FinancialInputs): Calc[] {
  const price = clean(raw.price)
  const customers = clean(raw.customers)
  const newCust = clean(raw.newCustomersPerMonth)
  const varCost = clean(raw.variableCostPerCustomerMonthly)
  const fixed = clean(raw.fixedCostsMonthly)
  const acq = clean(raw.acquisitionSpendMonthly)
  const isSub = raw.model === "subscription"
  const billingOk = isSub ? raw.billing !== "one_time" : true

  const unitRevenue =
    price === null ? null : isSub ? (billingOk ? monthlyEquivalentPrice(price, raw.billing) : null) : price
  const revenue = unitRevenue !== null && customers !== null ? unitRevenue * customers : null
  const out: Calc[] = []

  if (isSub) {
    out.push(make(
      { id: "mrr", label: "Monthly recurring revenue (MRR)", unit: "currency",
        formula: "MRR = paying customers × price per month (price ÷ months in billing interval)",
        inputs: { customers, price },
        limitations: "Assumes every customer stays and pays; ignores churn, discounts, taxes and failed payments." },
      { customers, price }, () => revenue,
      billingOk ? [] : ["billing interval (a subscription cannot be 'one time')"],
    ))
    const mrr = out[0].value
    out.push(make(
      { id: "arr", label: "Annualised recurring revenue (ARR)", unit: "currency",
        formula: "ARR = MRR × 12", inputs: { mrr },
        limitations: "A run-rate snapshot, not a prediction of next year's revenue." },
      { mrr }, () => (mrr as number) * 12,
    ))
  } else {
    out.push(make(
      { id: "revenue", label: "Revenue per month", unit: "currency",
        formula: "Revenue = purchases per month × price per purchase",
        inputs: { customers, price },
        limitations: "Recurring-revenue metrics (MRR/ARR) are not shown because this model is not a subscription." },
      { customers, price }, () => revenue,
    ))
  }

  const revKey = isSub ? "mrr" : "revenue"
  const revValue = out[0].value
  out.push(make(
    { id: "gross_profit", label: "Gross profit per month", unit: "currency",
      formula: "Gross profit = revenue − (variable cost per customer × customers)",
      inputs: { revenue: revValue, variableCost: varCost, customers },
      limitations: `Uses ${revKey}; excludes fixed costs, marketing and founder pay.` },
    { revenue: revValue, variableCost: varCost, customers }, () =>
      (revValue as number) - (varCost as number) * (customers as number),
  ))
  const gp = out[out.length - 1].value

  out.push(make(
    { id: "gross_margin", label: "Gross margin", unit: "percent",
      formula: "Gross margin = gross profit ÷ revenue × 100",
      inputs: { grossProfit: gp, revenue: revValue },
      limitations: "Undefined when revenue is zero; can be negative if variable cost exceeds price." },
    { grossProfit: gp, revenue: revValue }, () => ((gp as number) / (revValue as number)) * 100,
    revValue === 0 ? ["revenue must be greater than zero"] : [],
  ))

  out.push(make(
    { id: "cac", label: "Customer acquisition cost (CAC)", unit: "currency",
      formula: "CAC = acquisition spend per month ÷ new customers per month",
      inputs: { acquisitionSpend: acq, newCustomers: newCust },
      limitations: "Counts only the spend you enter; organic and founder-time acquisition is not priced." },
    { acquisitionSpend: acq, newCustomers: newCust }, () => (acq as number) / (newCust as number),
    newCust === 0 ? ["new customers per month must be greater than zero"] : [],
  ))

  const contribution = unitRevenue !== null && varCost !== null ? unitRevenue - varCost : null
  out.push(make(
    { id: "contribution", label: "Contribution margin per customer per month", unit: "currency",
      formula: "Contribution = price per month − variable cost per customer per month",
      inputs: { unitRevenue, variableCost: varCost },
      limitations: "Per-customer view; does not include acquisition cost." },
    { unitRevenue, variableCost: varCost }, () => contribution,
  ))

  const cm = out[out.length - 1].value
  out.push(make(
    { id: "break_even", label: "Break-even customers (monthly)", unit: "count",
      formula: "Break-even = ⌈fixed monthly costs ÷ contribution per customer⌉",
      inputs: { fixedCosts: fixed, contribution: cm },
      limitations: "Ignores acquisition spend, churn and ramp-up time. Not reachable if contribution ≤ 0." },
    { fixedCosts: fixed, contribution: cm },
    () => Math.ceil((fixed as number) / (cm as number)),
    cm !== null && cm <= 0 ? ["contribution must be positive (price must exceed variable cost)"] : [],
  ))
  return out
}

/** TAM/SAM/SOM bottom-up: customers × annual spend. Unknown stays unknown (null). */
export function bottomUpMarket(
  customerCount: number | null | undefined,
  annualSpend: number | null | undefined,
): { value: number | null; formula: string; missing: string[] } {
  const c = clean(customerCount), s = clean(annualSpend)
  const missing = [c === null ? "customer count" : "", s === null ? "annual spend per customer" : ""].filter(Boolean)
  return {
    value: missing.length ? null : round2((c as number) * (s as number)),
    formula: "Market = potential customers × annual spend per customer",
    missing,
  }
}

/** SOM ⊆ SAM ⊆ TAM sanity check; returns human-readable problems. */
export function marketConsistency(v: { tam?: number | null; sam?: number | null; som?: number | null }): string[] {
  const issues: string[] = []
  if (v.tam != null && v.sam != null && v.sam > v.tam) issues.push("SAM is larger than TAM.")
  if (v.sam != null && v.som != null && v.som > v.sam) issues.push("SOM is larger than SAM.")
  if (v.tam != null && v.som != null && v.som > v.tam) issues.push("SOM is larger than TAM.")
  return issues
}
