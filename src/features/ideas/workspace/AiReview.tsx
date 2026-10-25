import { useCallback, useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/client"
import { listReviews, requestReview, sectionsForReview, type SavedReview } from "./aiReviewRepo"
import { MissingSchemaError } from "./ventureRepo"

const supabase = createClient()

type Props = { ideaId: string; resolved: { id: string; title: string; text: string; evidence: string }[] }

/** Founder-only AI feedback on the pitch. Advice, clearly labelled; it never changes the scorecard. */
export function AiReview({ ideaId, resolved }: Props) {
  const [items, setItems] = useState<SavedReview[]>([])
  const [state, setState] = useState<"loading" | "ready" | "upgrade">("loading")
  const [busy, setBusy] = useState(false)
  const sections = sectionsForReview(resolved)

  const load = useCallback(async () => {
    try { setItems(await listReviews(supabase, ideaId)); setState("ready") }
    catch (e) { setState(e instanceof MissingSchemaError ? "upgrade" : "ready") }
  }, [ideaId])
  useEffect(() => { setState("loading"); void load() }, [load])

  const run = async () => {
    if (busy) return
    if (sections.length === 0) { toast.error("Fill in at least one pitch section first."); return }
    if (!window.confirm("Your pitch text will be sent to an AI service to generate feedback. Continue?")) return
    setBusy(true)
    try {
      const saved = await requestReview(supabase, ideaId, sections)
      setItems((p) => [saved, ...p])
      toast.success("AI review ready.")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not run the review.") }
    finally { setBusy(false) }
  }

  if (state === "loading") return null
  const latest = items[0]?.review

  return (
    <section aria-label="AI pitch review" className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-indigo-500" /> AI pitch review</h2>
        <span className="text-xs text-zinc-500">Private to you. Advice only: it never changes your score.</span>
        <Button type="button" size="sm" className="ml-auto" onClick={run} disabled={busy || state === "upgrade"}>
          {busy ? "Reviewing..." : items.length ? "Run a new review" : "Review my pitch"}
        </Button>
      </div>

      {state === "upgrade" ? <p className="text-xs text-amber-700 dark:text-amber-400">AI review needs its database upgrade first.</p> : null}

      {latest ? (
        <div className="space-y-3 text-sm">
          {latest.summary ? <p className="text-zinc-800 dark:text-zinc-200">{latest.summary}</p> : null}
          {latest.strengths.length ? <Block title="What is working" items={latest.strengths} /> : null}
          {latest.gaps.length ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Biggest gaps</h3>
              <ul className="mt-1 space-y-2">
                {latest.gaps.map((g, i) => (
                  <li key={i} className="rounded-lg border border-zinc-100 p-2.5 dark:border-zinc-800/70">
                    <p className="font-medium">{g.section ? `${g.section}: ` : ""}{g.issue}</p>
                    {g.why ? <p className="text-xs text-zinc-500">{g.why}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {latest.investorQuestions.length ? <Block title="Questions an investor will ask" items={latest.investorQuestions} /> : null}
          {latest.nextExperiments.length ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Next experiments to run</h3>
              <ul className="mt-1 space-y-2">
                {latest.nextExperiments.map((e, i) => (
                  <li key={i} className="rounded-lg border border-zinc-100 p-2.5 dark:border-zinc-800/70">
                    {e.assumption ? <p className="text-xs text-zinc-500">Assumption: {e.assumption}</p> : null}
                    <p className="font-medium">{e.experiment}</p>
                    {e.signal ? <p className="text-xs text-emerald-700 dark:text-emerald-400">Good sign: {e.signal}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-[11px] text-zinc-500">
            Generated {new Date(items[0].createdAt).toLocaleString()}{items[0].model ? ` by ${items[0].model}` : ""} from your own pitch text. It can be wrong; treat it as a second opinion, not evidence.
          </p>
        </div>
      ) : state === "ready" ? (
        <p className="text-sm text-zinc-500">Get a quick second opinion: the biggest gaps, the questions investors will ask, and what to test next.</p>
      ) : null}
    </section>
  )
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  )
}
