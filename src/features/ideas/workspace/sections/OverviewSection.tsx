import { ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CommitArea, NumberField, Notice, Panel, SectionTitle, SelectField, TextField, type Option } from "../fields"
import type { Indicator } from "../scorecard"
import type { StartupStage, WorkspaceStatus } from "../types"
import { INDICATOR_SECTION, type SectionKey, type SectionProps } from "./nav"

const STAGES: Option[] = [
  { value: "idea", label: "Idea" }, { value: "research", label: "Researching" }, { value: "prototype", label: "Prototype" },
  { value: "mvp", label: "MVP built" }, { value: "early_traction", label: "Early traction" }, { value: "growth", label: "Growth" },
]

export const STATUS_TEXT: Record<WorkspaceStatus, { label: string; blurb: string }> = {
  draft: { label: "Draft", blurb: "Mostly empty so far. Start with the problem and your first customer." },
  exploring: { label: "Exploring", blurb: "The blueprint is taking shape. The next gain is testing it with real customers." },
  validating: { label: "Validating", blurb: "You have recorded at least one experiment. Keep testing your riskiest assumptions." },
  pitch_ready: { label: "Pitch ready", blurb: "You confirmed the pitch is ready and its checklist is largely complete." },
}

export function OverviewSection({ data, api, status, next, indicators, go }: SectionProps & {
  status: WorkspaceStatus; next: { text: string; target: string }; indicators: Indicator[]; go: (k: SectionKey) => void
}) {
  const { idea } = data
  const target = INDICATOR_SECTION[next.target] ?? "blueprint"
  const completion = indicators.find(i => i.id === "completeness")?.score ?? 0
  const st = STATUS_TEXT[status]

  return (
    <div className="space-y-6">
      <SectionTitle title="Overview">
        Where this venture stands, and the single most useful thing to do next.
      </SectionTitle>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Stage of the workspace</span>
            <Badge className="bg-indigo-600 text-white hover:bg-indigo-600">{st.label}</Badge>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{st.blurb}</p>
          <p className="text-xs text-zinc-500">Worked out from what you have entered. “Validated” is never a status: only customers can validate an idea.</p>
        </div>
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Blueprint filled in</span>
            <span className="text-2xl font-bold tabular-nums">{completion}%</span>
          </div>
          <Progress value={completion} aria-label={`Blueprint ${completion}% filled in`} className="h-2 bg-zinc-200 dark:bg-zinc-800 [&>div]:bg-indigo-500" />
          <p className="text-xs text-zinc-500">Share of ten core fields with content. It measures completeness, not quality.</p>
        </div>
        <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-5 shadow-sm dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Suggested next step</span>
          <p className="text-sm font-medium">{next.text}</p>
          <Button type="button" size="sm" className="gap-2" onClick={() => go(target)}>Go there <ArrowRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Panel title="Venture details">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField id="v-name" label="Venture name" value={idea.name ?? ""} onChange={v => api.setIdea({ name: v })} />
          <TextField id="v-tagline" label="One-line description" placeholder="What it is, for whom, in one sentence"
            value={idea.tagline ?? ""} onChange={v => api.setIdea({ tagline: v })} />
          <SelectField id="v-stage" label="Stage" options={STAGES} value={idea.startup_stage ?? ""}
            onChange={v => api.setIdea({ startup_stage: (v || null) as StartupStage | null })} />
          <TextField id="v-industry" label="Industry" value={idea.industry ?? ""} onChange={v => api.setIdea({ industry: v })} />
          <TextField id="v-geo" label="Geographic focus" value={idea.geographic_focus ?? ""} onChange={v => api.setIdea({ geographic_focus: v })} />
          <NumberField id="v-fund" label="Funding goal" value={idea.funding_goal} onChange={n => api.setIdea({ funding_goal: n })}
            hint="Stored on the venture record, which other signed-in members can read." />
        </div>
        <TextField id="v-use" label="Use of funds" placeholder="e.g. 60% product, 25% first customers, 15% legal"
          value={idea.use_of_funds ?? ""} onChange={v => api.setIdea({ use_of_funds: v })} />
      </Panel>

      <Panel title="Scorecard at a glance" description="Each bar is the share of that checklist completed.">
        <ul className="grid gap-3 md:grid-cols-2">
          {indicators.map(i => (
            <li key={i.id} className="space-y-1">
              <div className="flex items-baseline justify-between text-sm">
                <button type="button" className="text-left font-medium hover:underline" onClick={() => go(INDICATOR_SECTION[i.id] ?? "scorecard")}>{i.label}</button>
                <span className="tabular-nums text-zinc-500">{i.score}%{i.missing.length ? `, ${i.missing.length} missing` : ""}</span>
              </div>
              <Progress value={i.score} aria-label={`${i.label} ${i.score}%`} className="h-1.5 bg-zinc-200 dark:bg-zinc-800 [&>div]:bg-indigo-500" />
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" onClick={() => go("scorecard")}>See why each score is what it is</Button>
      </Panel>

      <Panel title="Private notes" description="Only you can read these. They never appear in your pitch.">
        <CommitArea ariaLabel="Private notes" rows={5} value={data.notes} onCommit={v => { void api.saveNotes(v) }}
          placeholder="Interview takeaways, things to remember, questions for a mentor…" />
        <Notice>Notes save when you click outside the box.</Notice>
      </Panel>
    </div>
  )
}
