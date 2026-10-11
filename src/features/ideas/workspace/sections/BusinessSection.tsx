import { computeFinancials, type Calc } from "../financials"
import { BpArea, BpNumber, BpSelect, BpText, Notice, Panel, SectionTitle, type Option } from "../fields"
import type { SectionProps } from "./nav"

const MODELS: Option[] = [
  { value: "subscription", label: "Subscription (recurring)" },
  { value: "one_time", label: "One-time purchase" },
  { value: "marketplace", label: "Marketplace (commission or fee)" },
  { value: "usage_based", label: "Usage-based" },
  { value: "service", label: "Service / consulting" },
  { value: "other", label: "Other" },
]

const BILLING: Option[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
  { value: "one_time", label: "One time" },
]

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 })
const show = (c: Calc) => (c.value === null ? "—" : c.unit === "percent" ? `${fmt(c.value)}%` : c.unit === "count" ? fmt(c.value) : fmt(c.value))

function CalcCard({ calc }: { calc: Calc }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-xs font-medium text-zinc-500">{calc.label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{show(calc)}</div>
      {calc.value === null ? (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Needs: {calc.missing.join(", ")}</p>
      ) : null}
      <details className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
        <summary className="cursor-pointer select-none font-medium text-indigo-600 dark:text-indigo-400">How this is calculated</summary>
        <div className="mt-2 space-y-1.5">
          <p><span className="font-semibold">Formula:</span> {calc.formula}</p>
          <p>
            <span className="font-semibold">Inputs used:</span>{" "}
            {Object.entries(calc.inputs).map(([k, v]) => `${k} = ${v === null ? "missing" : fmt(v)}`).join("; ")}
          </p>
          <p><span className="font-semibold">Limits:</span> {calc.limitations}</p>
        </div>
      </details>
    </div>
  )
}

export function BusinessSection({ data, api }: SectionProps) {
  const bp = { data, api }
  const b = data.idea.blueprint.business ?? {}
  const calcs = b.model
    ? computeFinancials({
        model: b.model, price: b.price, billing: b.billing ?? "monthly", customers: b.customers,
        newCustomersPerMonth: b.newCustomersPerMonth, variableCostPerCustomerMonthly: b.variableCostPerCustomerMonthly,
        fixedCostsMonthly: b.fixedCostsMonthly, acquisitionSpendMonthly: b.acquisitionSpendMonthly,
      })
    : []
  const isSub = b.model === "subscription"

  return (
    <div className="space-y-6">
      <SectionTitle num="03" title="Business Model">
        How the venture earns money. The numbers below are stored privately in your workspace and are not shown to other members.
      </SectionTitle>

      <Panel title="How it makes money">
        <div className="grid gap-4 md:grid-cols-2">
          <BpSelect {...bp} s="business" k="model" label="Business model" options={MODELS} />
          <BpText {...bp} s="business" k="whoPays" label="Who pays" placeholder="e.g. the student, or the college" />
          <BpText {...bp} s="business" k="paysFor" label="What they pay for" />
          <BpText {...bp} s="business" k="pricingModel" label="Pricing approach" placeholder="e.g. flat monthly fee, free tier + paid" />
        </div>
        <BpArea {...bp} s="business" k="revenueStreams" label="Revenue streams" rows={2} />
        <div className="grid gap-4 md:grid-cols-2">
          <BpArea {...bp} s="business" k="acquisitionChannels" label="How you will reach customers" rows={3}
            hint="Name the first channel you will actually use, not a list of everything possible." />
          <BpArea {...bp} s="business" k="salesApproach" label="Sales approach" rows={3} />
          <BpArea {...bp} s="business" k="ongoingExpenses" label="Major ongoing costs" rows={3} />
          <BpArea {...bp} s="business" k="retentionAssumption" label="Why customers will stay" rows={3} />
        </div>
      </Panel>

      <Panel title="Planning numbers" description="Your assumptions. Leave anything you do not know blank; it stays blank in the results.">
        <div className="grid gap-4 md:grid-cols-3">
          <BpNumber {...bp} s="business" k="price" label={isSub ? "Price per billing period" : "Price per purchase"} />
          <BpSelect {...bp} s="business" k="billing" label="Billing interval" options={BILLING}
            hint={isSub ? "Subscriptions cannot be “one time”." : undefined} />
          <BpNumber {...bp} s="business" k="customers" label={isSub ? "Paying customers" : "Purchases per month"} />
          <BpNumber {...bp} s="business" k="newCustomersPerMonth" label="New customers per month" />
          <BpNumber {...bp} s="business" k="variableCostPerCustomerMonthly" label="Cost to serve one customer per month" />
          <BpNumber {...bp} s="business" k="fixedCostsMonthly" label="Fixed costs per month" />
          <BpNumber {...bp} s="business" k="acquisitionSpendMonthly" label="Acquisition spend per month" />
        </div>
      </Panel>

      <Panel title="What those numbers imply"
        description="Simple unit economics from your inputs. Open “How this is calculated” on any figure.">
        <Notice tone="warn">
          These are planning estimates from your own assumptions, not forecasts. They ignore churn, taxes, discounts and ramp-up time.
        </Notice>
        {!b.model ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
            Choose a business model above to see the calculations.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {calcs.map(c => <CalcCard key={c.id} calc={c} />)}
          </div>
        )}
      </Panel>
    </div>
  )
}
