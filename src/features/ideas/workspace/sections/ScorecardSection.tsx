import { AlertTriangle, CheckCircle2, Circle } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Panel, SectionTitle } from "../fields"
import type { Indicator } from "../scorecard"
import type { IdeaCheck } from "@/features/ideas/ideaCheck"
import { INDICATOR_SECTION, SECTIONS, type SectionKey } from "./nav"

export function ScorecardSection({ indicators, draftStrength, healthScore, go }: {
  indicators: Indicator[]; draftStrength: IdeaCheck; healthScore: number | null; go: (k: SectionKey) => void
}) {
  return (
    <div className="space-y-6">
      <SectionTitle num="07" title="Venture Scorecard">
        Ten separate checklists, each showing what is filled in, what is missing and why it matters. A percentage here means
        “share of this checklist completed”. It is not a prediction of success and it does not measure demand.
      </SectionTitle>

      <div className="grid gap-4 lg:grid-cols-2">
        {indicators.map(i => {
          const target = INDICATOR_SECTION[i.id]
          const targetLabel = SECTIONS.find(s => s.key === target)?.label
          return (
            <section key={i.id} aria-labelledby={`ind-${i.id}`}
              className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
              <div className="flex items-baseline justify-between gap-3">
                <h3 id={`ind-${i.id}`} className="text-base font-semibold">{i.label}</h3>
                <span className="text-xl font-bold tabular-nums">{i.score}%</span>
              </div>
              <Progress value={i.score} aria-label={`${i.label}: ${i.score}% of checklist complete`}
                className="h-2 bg-zinc-200 dark:bg-zinc-800 [&>div]:bg-indigo-500" />
              <p className="text-xs text-zinc-500 dark:text-zinc-400"><span className="font-medium">Assesses:</span> {i.assesses}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400"><span className="font-medium">Why it matters:</span> {i.why}</p>
              {i.warnings.map(w => (
                <p key={w} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {w}
                </p>
              ))}
              {i.met.length > 0 ? (
                <ul className="space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
                  {i.met.map(m => <li key={m} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden /> {m}</li>)}
                </ul>
              ) : null}
              {i.missing.length > 0 ? (
                <ul className="space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
                  {i.missing.map(m => <li key={m} className="flex items-start gap-2"><Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden /> {m}</li>)}
                </ul>
              ) : null}
              <p className="text-xs"><span className="font-semibold">Next:</span> {i.action}
                {target && i.missing.length > 0 ? (
                  <> <button type="button" onClick={() => go(target)} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">Open {targetLabel}</button></>
                ) : null}
              </p>
            </section>
          )
        })}
      </div>

      <Panel title="Draft check (rule-based)"
        description="The original Idea Check: how complete and specific your written draft is. It cannot judge whether a market wants the idea.">
        {!draftStrength.hasContent ? (
          <p className="text-sm text-zinc-500">{draftStrength.verdict}</p>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="flex items-baseline justify-between"><span className="font-semibold">Draft strength</span>
              <span className="text-2xl font-bold tabular-nums">{draftStrength.score}<span className="text-sm font-medium text-zinc-400"> / 100</span></span></div>
            <p className="text-zinc-600 dark:text-zinc-400">{draftStrength.verdict}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div><h4 className="mb-1 font-semibold">Strengths</h4>
                <ul className="list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">{draftStrength.strengths.length ? draftStrength.strengths.map(s => <li key={s}>{s}</li>) : <li>None detected yet.</li>}</ul></div>
              <div><h4 className="mb-1 font-semibold">Gaps</h4>
                <ul className="list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">{draftStrength.risks.length ? draftStrength.risks.map(s => <li key={s}>{s}</li>) : <li>Draft structure is solid.</li>}</ul></div>
            </div>
            <div><h4 className="mb-1 font-semibold">Where to start</h4><p className="text-zinc-600 dark:text-zinc-400">{draftStrength.audience}</p></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div><h4 className="mb-1 font-semibold">Questions for real customers</h4>
                <ul className="list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">{draftStrength.questions.map(q => <li key={q}>{q}</li>)}</ul></div>
              <div><h4 className="mb-1 font-semibold">Suggested first steps</h4>
                <ol className="list-decimal space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">{draftStrength.mvpSteps.map(q => <li key={q}>{q}</li>)}</ol></div>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Validation Lab signal score"
        description="Calculated in the Validation Lab from the signal strengths you rate yourself and from hypotheses you mark validated.">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {healthScore === null ? "Not calculated yet." : <><strong className="text-lg text-zinc-900 dark:text-zinc-100">{healthScore}</strong> / 100. </>}
          It rewards the evidence you log, but it is self-rated, so treat it as a progress indicator rather than a measure of demand.
          It is shown separately and is not part of the percentages above.
        </p>
      </Panel>
    </div>
  )
}
