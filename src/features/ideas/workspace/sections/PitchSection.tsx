import { useMemo } from "react"
import { Copy, Download, Megaphone } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckField, CommitArea, Notice, Panel, SectionTitle } from "../fields"
import { EVIDENCE_LABEL, buildPitch, compilePitchMarkdown, legacyElevatorPitch, resolvePitch, sectionsWithContent, type Evidence } from "../pitch"
import { computeScorecard } from "../scorecard"
import type { VentureSnapshot } from "../types"
import type { SectionProps } from "./nav"
import { SharePanel } from "./SharePanel"
import { MentorFeedback } from "../MentorFeedback"

const EVIDENCE_STYLE: Record<Evidence, string> = {
  founder: "text-indigo-700 dark:text-indigo-300",
  calculated: "text-sky-700 dark:text-sky-300",
  experiment: "text-emerald-700 dark:text-emerald-300",
  assumption: "text-amber-700 dark:text-amber-300",
  missing: "text-zinc-500",
}

export function PitchSection({ data, api }: SectionProps) {
  const { idea } = data
  const snapshot = useMemo<VentureSnapshot>(() => ({
    idea, competitors: data.competitors, market: data.market, risks: data.risks,
    milestones: data.milestones, hypotheses: data.hypotheses,
  }), [idea, data.competitors, data.market, data.risks, data.milestones, data.hypotheses])

  const drafts = useMemo(() => buildPitch(snapshot, data.hypotheses), [snapshot, data.hypotheses])
  const resolved = useMemo(() => resolvePitch(drafts, idea.pitch_settings), [drafts, idea.pitch_settings])
  const pitchScore = useMemo(
    () => computeScorecard(snapshot).indicators.find(i => i.id === "pitch")?.score ?? 0, [snapshot])
  const markdown = useMemo(() => compilePitchMarkdown(idea.name, resolved), [idea.name, resolved])
  const chosen = resolved.filter(s => s.included).length

  const setInclude = (id: string, on: boolean) =>
    api.setPitchSettings(p => ({ ...p, include: { ...p.include, [id]: on } }))

  const setOverride = (id: string, text: string, draft: string) =>
    api.setPitchSettings(p => {
      const overrides = { ...p.overrides }
      if (!text.trim() || text.trim() === draft.trim()) delete overrides[id] // blank or unchanged = back to the generated draft
      else overrides[id] = text
      return { ...p, overrides }
    })

  const copy = async () => {
    try { await navigator.clipboard.writeText(markdown); toast.success("Pitch copied.") }
    catch { toast.error("Could not copy. Use Download instead.") }
  }

  const download = () => {
    const blob = new Blob([markdown], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const slug = (idea.name ?? "venture").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "venture"
    a.href = url; a.download = `${slug}-pitch.md`; a.click()
    URL.revokeObjectURL(url)
  }

  const publishElevator = () => {
    const el = resolved.find(s => s.id === "elevator")
    if (!el || !el.text) { toast.error("Write or generate an elevator pitch first."); return }
    if (!window.confirm("This puts the elevator pitch on your venture record, which other signed-in members can read. Continue?")) return
    api.setIdea({ elevator_pitch: el.text })
    toast.success("Elevator pitch published to your venture record.")
  }

  const generated = legacyElevatorPitch({ market: idea.market, problem: idea.problem, solution: idea.solution })
  const elevatorLive = idea.elevator_pitch ?? ""

  return (
    <div className="space-y-6">
      <SectionTitle num="06" title="Pitch Studio">
        Each section is drafted from what you have entered and labelled with where it comes from. Edit any section in your own
        words, then choose which ones to share. Nothing is shared automatically.
      </SectionTitle>

      <Notice>
        Pitch completeness: <strong>{pitchScore}%</strong> of the checklist is filled in. {chosen} section{chosen === 1 ? "" : "s"} selected for sharing.
        Gaps are shown as “Not provided yet” rather than hidden.
      </Notice>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline"
          onClick={() => api.setPitchSettings(p => ({ ...p, include: Object.fromEntries(sectionsWithContent(resolved).map(id => [id, true])) }))}>
          Select all with content
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => api.setPitchSettings(p => ({ ...p, include: {} }))}>Clear selection</Button>
        <Button type="button" size="sm" className="gap-2" onClick={copy} disabled={chosen === 0}><Copy className="h-4 w-4" /> Copy shareable pitch</Button>
        <Button type="button" size="sm" className="gap-2" onClick={download} disabled={chosen === 0}><Download className="h-4 w-4" /> Download .md</Button>
      </div>

      <div className="space-y-4">
        {resolved.map(s => {
          const draft = drafts.find(d => d.id === s.id)!
          return (
            <Panel key={s.id} title={
              <span className="flex flex-wrap items-center gap-2">
                {s.title}
                <Badge variant="outline" className={`text-[10px] ${EVIDENCE_STYLE[s.evidence]}`}>{EVIDENCE_LABEL[s.evidence]}</Badge>
                {s.overridden ? <Badge variant="secondary" className="text-[10px]">Edited by you</Badge> : null}
              </span>
            }>
              <CommitArea ariaLabel={`${s.title} text`} rows={s.id === "elevator" ? 3 : 5} value={s.text}
                placeholder={draft.note ?? "Nothing to show yet. Fill in the earlier sections or write this one yourself."}
                onCommit={v => setOverride(s.id, v, draft.text)} />
              {s.note && s.evidence !== "missing" ? <p className="text-xs text-amber-700 dark:text-amber-400">{s.note}</p> : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CheckField id={`inc-${s.id}`} label="Include in the shareable pitch" checked={s.included}
                  onChange={on => setInclude(s.id, on)} />
                {s.overridden ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setOverride(s.id, "", draft.text)}>Reset to generated draft</Button>
                ) : null}
              </div>
            </Panel>
          )
        })}
      </div>

      <SharePanel idea={idea} resolved={resolved} />
      <MentorFeedback ideaId={idea.id} mode="read" sections={resolved.map(r => ({ id: r.id, title: r.title }))} />

      <Panel title="Publish and confirm" description="Two deliberate steps. Neither happens automatically.">
        <div className="space-y-2">
          <p className="text-sm">
            <span className="font-semibold">Elevator pitch on your venture record:</span>{" "}
            {elevatorLive ? <span className="text-zinc-600 dark:text-zinc-300">“{elevatorLive}”</span> : <span className="text-zinc-500">none yet</span>}
          </p>
          {!idea.elevator_pitch || idea.elevator_pitch === generated ? (
            <p className="text-xs text-zinc-500">While you have not customised it, this sentence updates when you change the problem, solution or audience.</p>
          ) : null}
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={publishElevator}>
            <Megaphone className="h-4 w-4" /> Publish this elevator pitch to my venture record
          </Button>
          <p className="text-xs text-zinc-500">Visible to other signed-in members. The other sections stay private to you unless you copy or download them.</p>
        </div>
        <CheckField id="pitch-ready" checked={idea.pitch_ready_confirmed} onChange={v => api.setIdea({ pitch_ready_confirmed: v })}
          label="I have reviewed the selected sections and consider this ready to show mentors"
          hint="This is your own sign-off. VentureBridge does not judge whether a venture is investable; it also needs the pitch checklist to be at least 75% complete before the status reads “Pitch ready”." />
      </Panel>
    </div>
  )
}
