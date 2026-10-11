import { useState } from "react"
import { Link } from "react-router-dom"
import { FlaskConical, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CommitArea, CommitText, NativeSelect, Notice, Panel, SectionTitle, type Option } from "../fields"
import { assumptionState, riskPriority } from "../scorecard"
import type { AssumptionState, EvidenceStatus, Risk } from "../types"
import type { HypothesisDetail } from "../ventureRepo"
import type { SectionProps } from "./nav"

const CATEGORIES: Option[] = [
  { value: "customer_demand", label: "Customer demand" },
  { value: "technical_feasibility", label: "Technical feasibility" },
  { value: "competition", label: "Competition" },
  { value: "distribution", label: "Distribution / reaching customers" },
  { value: "pricing", label: "Pricing" },
  { value: "operations", label: "Operations" },
  { value: "regulation", label: "Regulation / legal" },
  { value: "funding", label: "Funding" },
  { value: "team", label: "Team" },
  { value: "other", label: "Other" },
]
const KINDS: Option[] = [{ value: "assumption", label: "Assumption" }, { value: "risk", label: "Risk" }]
const SCALE = (label: string): Option[] =>
  [1, 2, 3, 4, 5].map(n => ({ value: String(n), label: `${label} ${n}` }))
const EVIDENCE: Option[] = [
  { value: "unknown", label: "Unknown" }, { value: "assumption", label: "Assumption" },
  { value: "researched", label: "Researched" }, { value: "validated", label: "Validated" },
]

const STATE_TEXT: Record<AssumptionState, string> = {
  untested: "Untested",
  experiment_planned: "Experiment planned",
  evidence_recorded: "Evidence recorded, no conclusion",
  supported: "Marked supported",
  rejected: "Rejected",
  inconclusive: "Inconclusive",
}

const CELL: Record<"high" | "medium" | "low", string> = {
  high: "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200",
  medium: "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  low: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
}

function Matrix({ risks }: { risks: Risk[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="mx-auto border-separate border-spacing-1 text-center text-xs" aria-label="Risk matrix: likelihood by impact">
        <caption className="pb-2 text-left text-xs text-zinc-500">Number of risks by likelihood (rows) and impact (columns)</caption>
        <tbody>
          {[5, 4, 3, 2, 1].map(l => (
            <tr key={l}>
              <th scope="row" className="pr-2 text-right font-medium text-zinc-500">L{l}</th>
              {[1, 2, 3, 4, 5].map(i => {
                const n = risks.filter(r => r.likelihood === l && r.impact === i).length
                const p = riskPriority({ likelihood: l, impact: i })
                return (
                  <td key={i} className={`h-10 w-12 rounded-md font-semibold tabular-nums ${CELL[p]}`}
                    aria-label={`Likelihood ${l}, impact ${i}, ${p} priority: ${n} ${n === 1 ? "risk" : "risks"}`}>
                    {n > 0 ? n : ""}
                  </td>
                )
              })}
            </tr>
          ))}
          <tr>
            <td />
            {[1, 2, 3, 4, 5].map(i => <th key={i} scope="col" className="pt-1 font-medium text-zinc-500">I{i}</th>)}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function HypothesisDialog({ risk, open, onOpenChange, onCreate }: {
  risk: Risk; open: boolean; onOpenChange: (o: boolean) => void
  onCreate: SectionProps["api"]["createHypothesisFromRisk"]
}) {
  const [title, setTitle] = useState(risk.title)
  const [statement, setStatement] = useState("")
  const [metric, setMetric] = useState("")
  const [threshold, setThreshold] = useState("")
  const [method, setMethod] = useState("")
  const [audience, setAudience] = useState("")
  const [window_, setWindow] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !title.trim() || !statement.trim()) return
    setBusy(true)
    const ok = await onCreate(risk.id, {
      title, statement, success_metric: metric, success_threshold: threshold,
      test_method: method, target_audience: audience, time_window: window_,
    })
    setBusy(false)
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Turn this into a testable hypothesis</DialogTitle>
          <DialogDescription>
            A good hypothesis says what you expect, who it applies to, and what result would change your mind. It appears in the Validation Lab.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3 pt-2">
          <div className="space-y-1"><Label htmlFor="h-title">Title</Label>
            <Input id="h-title" required value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="h-statement">Statement</Label>
            <Textarea id="h-statement" required value={statement} onChange={e => setStatement(e.target.value)}
              placeholder="e.g. At least 20% of students shown the pricing page will start a paid trial." /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="h-metric">Success metric</Label>
              <Input id="h-metric" value={metric} onChange={e => setMetric(e.target.value)} placeholder="e.g. paid trial rate" /></div>
            <div className="space-y-1"><Label htmlFor="h-threshold">Success threshold</Label>
              <Input id="h-threshold" value={threshold} onChange={e => setThreshold(e.target.value)} placeholder="e.g. at least 10 of 50" /></div>
            <div className="space-y-1"><Label htmlFor="h-method">How you will test it</Label>
              <Input id="h-method" value={method} onChange={e => setMethod(e.target.value)} placeholder="e.g. landing page + 50 messages" /></div>
            <div className="space-y-1"><Label htmlFor="h-window">Time window</Label>
              <Input id="h-window" value={window_} onChange={e => setWindow(e.target.value)} placeholder="e.g. two weeks" /></div>
          </div>
          <div className="space-y-1"><Label htmlFor="h-aud">Who you will test with</Label>
            <Input id="h-aud" value={audience} onChange={e => setAudience(e.target.value)} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || !title.trim() || !statement.trim()}>{busy ? "Creating…" : "Create hypothesis"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RiskRow({ risk, hyp, api, ideaId }: {
  risk: Risk; hyp: HypothesisDetail | undefined; api: SectionProps["api"]; ideaId: string
}) {
  const [open, setOpen] = useState(false)
  const p = riskPriority(risk)
  const state = hyp ? assumptionState(hyp) : null
  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <CommitText ariaLabel="Title" value={risk.title} className="font-medium sm:flex-1"
          onCommit={v => { if (v.trim()) api.updateRisk(risk.id, { title: v.trim() }) }} />
        <Badge variant={p === "high" ? "destructive" : "secondary"} className="w-fit shrink-0 uppercase text-[10px]">{p} priority</Badge>
        <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${risk.title}`} className="text-red-600"
          onClick={() => { if (window.confirm(`Remove “${risk.title}”?`)) void api.removeRisk(risk.id) }}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <NativeSelect ariaLabel="Kind" className="h-9" value={risk.kind} options={KINDS}
          onChange={v => api.updateRisk(risk.id, { kind: v as Risk["kind"] })} />
        <NativeSelect ariaLabel="Category" className="h-9" value={risk.category} options={CATEGORIES}
          onChange={v => api.updateRisk(risk.id, { category: v })} />
        <NativeSelect ariaLabel="Likelihood" className="h-9" value={String(risk.likelihood)} options={SCALE("Likelihood")}
          onChange={v => api.updateRisk(risk.id, { likelihood: Number(v) })} />
        <NativeSelect ariaLabel="Impact" className="h-9" value={String(risk.impact)} options={SCALE("Impact")}
          onChange={v => api.updateRisk(risk.id, { impact: Number(v) })} />
        <NativeSelect ariaLabel="Evidence status" className="h-9" value={risk.evidence_status} options={EVIDENCE}
          onChange={v => api.updateRisk(risk.id, { evidence_status: v as EvidenceStatus })} />
      </div>
      <CommitArea ariaLabel="Mitigation" placeholder="How will you reduce or test this?" value={risk.mitigation ?? ""}
        onCommit={v => api.updateRisk(risk.id, { mitigation: v })} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {hyp ? (
          <>
            <FlaskConical className="h-4 w-4 text-indigo-500" aria-hidden />
            <span className="font-medium">{hyp.title}</span>
            <Badge variant="outline" className="text-[10px]">{state ? STATE_TEXT[state] : ""}</Badge>
            <span className="text-xs text-zinc-500">{hyp.experimentCount} experiment{hyp.experimentCount === 1 ? "" : "s"}</span>
            <Link to={`/dashboard/validation?idea=${ideaId}`} className="ml-auto text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Open in Validation Lab
            </Link>
          </>
        ) : (
          <>
            <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
              <FlaskConical className="h-4 w-4" /> Create hypothesis
            </Button>
            <span className="text-xs text-zinc-500">No test linked yet.</span>
            {open ? <HypothesisDialog risk={risk} open={open} onOpenChange={setOpen} onCreate={api.createHypothesisFromRisk} /> : null}
          </>
        )}
      </div>
    </div>
  )
}

export function RisksSection({ data, api }: SectionProps) {
  const [title, setTitle] = useState("")
  const [kind, setKind] = useState<Risk["kind"]>("assumption")
  const [category, setCategory] = useState("customer_demand")
  const [likelihood, setLikelihood] = useState("3")
  const [impact, setImpact] = useState("3")
  const [adding, setAdding] = useState(false)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || adding) return
    setAdding(true)
    await api.addRisk({ title, kind, category, likelihood: Number(likelihood), impact: Number(impact) })
    setTitle("")
    setAdding(false)
  }

  const sorted = [...data.risks].sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact)
  const linked = new Set(data.risks.map(r => r.hypothesis_id).filter(Boolean))
  const unlinked = data.hypotheses.filter(h => !linked.has(h.id))

  return (
    <div className="space-y-6">
      <SectionTitle num="05" title="Risks & Validation">
        Write down what must be true for this to work, rate how likely and how damaging each failure would be, then turn the worst
        ones into tests. Evidence comes only from experiments you record; filling in a form never validates an idea.
      </SectionTitle>

      <Panel title="Add a risk or assumption">
        <form onSubmit={add} className="grid gap-2 lg:grid-cols-[1fr_auto_auto_auto_auto_auto]">
          <div>
            <Label htmlFor="risk-title" className="sr-only">Risk or assumption</Label>
            <Input id="risk-title" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Students will pay for this instead of using free videos" />
          </div>
          <NativeSelect ariaLabel="Kind" value={kind} options={KINDS} onChange={v => setKind(v as Risk["kind"])} className="lg:w-36" />
          <NativeSelect ariaLabel="Category" value={category} options={CATEGORIES} onChange={setCategory} className="lg:w-56" />
          <NativeSelect ariaLabel="Likelihood" value={likelihood} options={SCALE("Likelihood")} onChange={setLikelihood} className="lg:w-36" />
          <NativeSelect ariaLabel="Impact" value={impact} options={SCALE("Impact")} onChange={setImpact} className="lg:w-32" />
          <Button type="submit" disabled={!title.trim() || adding} className="gap-2"><Plus className="h-4 w-4" /> Add</Button>
        </form>
        <p className="text-xs text-zinc-500">Likelihood and impact run from 1 (low) to 5 (high). Priority is likelihood × impact: 15 or more is high, 8 to 14 medium.</p>
      </Panel>

      {data.risks.length > 0 ? (
        <Panel title="Risk matrix"><Matrix risks={data.risks} /></Panel>
      ) : (
        <Notice>No risks recorded yet. Start with the assumption that, if wrong, would end the venture, which is usually whether customers will pay.</Notice>
      )}

      <div className="space-y-3">
        {sorted.map(r => (
          <RiskRow key={r.id} risk={r} api={api} ideaId={data.idea.id}
            hyp={r.hypothesis_id ? data.hypotheses.find(h => h.id === r.hypothesis_id) : undefined} />
        ))}
      </div>

      <Panel title="Hypotheses in the Validation Lab" description="Everything you are testing for this venture, whether or not it came from a risk.">
        {data.hypotheses.length === 0 ? (
          <p className="text-sm text-zinc-500">None yet. Use “Create hypothesis” on a risk above.</p>
        ) : (
          <ul className="space-y-2">
            {data.hypotheses.map(h => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                <span className="font-medium">{h.title}</span>
                <Badge variant="outline" className="text-[10px]">{STATE_TEXT[assumptionState(h)]}</Badge>
                <span className="text-xs text-zinc-500">{h.experimentCount} experiment{h.experimentCount === 1 ? "" : "s"}</span>
                {h.status === "validated" && h.experimentCount === 0 ? (
                  <span className="text-xs text-amber-700 dark:text-amber-400">Marked supported, but no experiment is recorded.</span>
                ) : null}
                {unlinked.includes(h) ? <span className="text-xs text-zinc-400">not linked to a risk</span> : null}
              </li>
            ))}
          </ul>
        )}
        <Link to={`/dashboard/validation?idea=${data.idea.id}`}>
          <Button type="button" variant="outline" size="sm" className="gap-2"><FlaskConical className="h-4 w-4" /> Open Validation Lab</Button>
        </Link>
      </Panel>
    </div>
  )
}
