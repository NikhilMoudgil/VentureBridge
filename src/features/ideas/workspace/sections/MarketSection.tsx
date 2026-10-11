import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { bottomUpMarket, marketConsistency } from "../financials"
import { CommitArea, CommitNumber, CommitText, NativeSelect, Notice, Panel, SectionTitle, type Option } from "../fields"
import type { Competitor, EvidenceStatus, MarketAssumption } from "../types"
import type { SectionProps } from "./nav"

const KINDS: Option[] = [
  { value: "direct", label: "Direct competitor" },
  { value: "indirect", label: "Indirect alternative" },
  { value: "non_product", label: "Non-product (spreadsheet, manual process)" },
]

const EVIDENCE: Option[] = [
  { value: "unknown", label: "Unknown" },
  { value: "assumption", label: "Assumption" },
  { value: "researched", label: "Researched (has a source)" },
  { value: "validated", label: "Validated with customers" },
]

const TIERS = [
  { tier: "tam", name: "TAM: total market", help: "Everyone who could ever buy something like this." },
  { tier: "sam", name: "SAM: serviceable market", help: "The part you can serve with your product, geography and channels." },
  { tier: "som", name: "SOM: obtainable market", help: "The share you can realistically win in the first one to two years." },
] as const

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 })

export function MarketSection({ data, api }: SectionProps) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<Competitor["kind"]>("direct")
  const [adding, setAdding] = useState(false)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || adding) return
    setAdding(true)
    await api.addCompetitor(name, kind)
    setName("")
    setAdding(false)
  }

  const value = (t: "tam" | "sam" | "som") => {
    const m = data.market.find(x => x.tier === t)
    return m ? bottomUpMarket(m.customer_count, m.annual_spend_per_customer).value : null
  }
  const issues = marketConsistency({ tam: value("tam"), sam: value("sam"), som: value("som") })

  return (
    <div className="space-y-6">
      <SectionTitle num="02" title="Customer & Market">
        What customers use today, and a market-size estimate you can explain. Unknown stays unknown: a number without a basis is
        labelled as an assumption.
      </SectionTitle>

      <Panel title="Alternatives and competitors"
        description="Include things that are not products: spreadsheets, asking a friend, doing nothing.">
        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <Label htmlFor="comp-name" className="sr-only">Name of the alternative</Label>
            <Input id="comp-name" value={name} onChange={e => setName(e.target.value)} placeholder="Name, e.g. Coursera, or “asking seniors”" />
          </div>
          <NativeSelect ariaLabel="Kind of alternative" value={kind} onChange={v => setKind(v as Competitor["kind"])}
            options={KINDS} className="sm:w-72" />
          <Button type="submit" disabled={!name.trim() || adding} className="gap-2"><Plus className="h-4 w-4" /> Add</Button>
        </form>

        {data.competitors.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-zinc-500 dark:border-zinc-800">
            No alternatives listed yet. Claiming to be different is much stronger next to a real comparison.
          </p>
        ) : null}

        <div className="space-y-3">
          {data.competitors.map(c => (
            <div key={c.id} className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <CommitText ariaLabel="Name" value={c.name} onCommit={v => { if (v.trim()) api.updateCompetitor(c.id, { name: v.trim() }) }}
                  className="font-medium sm:flex-1" />
                <NativeSelect ariaLabel="Kind" value={c.kind} options={KINDS} className="h-9 sm:w-72"
                  onChange={v => api.updateCompetitor(c.id, { kind: v as Competitor["kind"] })} />
                <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${c.name}`} className="text-red-600"
                  onClick={() => { if (window.confirm(`Remove “${c.name}”?`)) void api.removeCompetitor(c.id) }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <CommitArea ariaLabel="Strengths" placeholder="Their strengths" value={c.strengths ?? ""}
                  onCommit={v => api.updateCompetitor(c.id, { strengths: v })} />
                <CommitArea ariaLabel="Limitations" placeholder="Their limitations" value={c.limitations ?? ""}
                  onCommit={v => api.updateCompetitor(c.id, { limitations: v })} />
                <CommitArea ariaLabel="How you differ" placeholder="How you are different" value={c.differentiation ?? ""}
                  onCommit={v => api.updateCompetitor(c.id, { differentiation: v })} />
                <div className="space-y-2">
                  <CommitText ariaLabel="Pricing" placeholder="Their pricing" value={c.pricing ?? ""}
                    onCommit={v => api.updateCompetitor(c.id, { pricing: v })} />
                  <CommitText ariaLabel="Source link" placeholder="Source link (optional)" value={c.source_url ?? ""}
                    onCommit={v => api.updateCompetitor(c.id, { source_url: v })} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Market size" description="Bottom-up: potential customers × what each spends per year. Use your own currency.">
        {issues.map(i => <Notice key={i} tone="warn">{i} Check the customer counts and spend.</Notice>)}
        <div className="grid gap-4 lg:grid-cols-3">
          {TIERS.map(({ tier, name: tierName, help }) => {
            const m = data.market.find(x => x.tier === tier)
            const calc = m ? bottomUpMarket(m.customer_count, m.annual_spend_per_customer) : null
            const save = (patch: Partial<MarketAssumption>) => api.saveMarket(tier, patch)
            const needsSource = m && (m.evidence_status === "researched" || m.evidence_status === "validated") &&
              !((m.source_url ?? "").trim() && (m.source_date ?? "").trim())
            return (
              <div key={tier} className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div>
                  <h4 className="text-sm font-semibold">{tierName}</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{help}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Potential customers</Label>
                  <CommitNumber ariaLabel={`${tierName} customers`} value={m?.customer_count} onCommit={n => save({ customer_count: n })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Spend per customer per year</Label>
                  <CommitNumber ariaLabel={`${tierName} annual spend`} value={m?.annual_spend_per_customer}
                    onCommit={n => save({ annual_spend_per_customer: n })} />
                </div>
                <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900/60" aria-live="polite">
                  <div className="text-xs text-zinc-500">Estimated market per year</div>
                  <div className="text-xl font-bold tabular-nums">{calc?.value != null ? fmt(calc.value) : "Unknown"}</div>
                  <div className="mt-1 text-[11px] leading-snug text-zinc-500">
                    {calc?.value != null ? "customers × spend per year" : `Needs: ${(calc?.missing ?? ["customer count", "annual spend per customer"]).join(" and ")}`}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">How the numbers were derived</Label>
                  <CommitArea ariaLabel={`${tierName} basis`} value={m?.basis ?? ""} onCommit={v => save({ basis: v })}
                    placeholder="e.g. 1,200 CS students × 40% who buy paid courses" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Evidence status</Label>
                  <NativeSelect ariaLabel={`${tierName} evidence status`} className="h-9" value={m?.evidence_status ?? "assumption"} options={EVIDENCE}
                    onChange={v => save({ evidence_status: v as EvidenceStatus })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <CommitText ariaLabel={`${tierName} source link`} placeholder="Source link" value={m?.source_url ?? ""} onCommit={v => save({ source_url: v })} />
                  <CommitText ariaLabel={`${tierName} source date`} type="date" value={m?.source_date ?? ""} onCommit={v => save({ source_date: v })} />
                </div>
                {needsSource ? <Notice tone="warn">Marked “{m?.evidence_status}” but the source link or date is missing.</Notice> : null}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          These are planning estimates from the numbers you enter. VentureBridge does not look up market data.
        </p>
      </Panel>
    </div>
  )
}
