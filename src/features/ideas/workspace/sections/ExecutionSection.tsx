import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BpArea, BpNumber, BpText, CommitText, NativeSelect, Panel, SectionTitle, TextField, type Option } from "../fields"
import type { Milestone } from "../types"
import type { SectionProps } from "./nav"

const PRIORITIES: Option[] = [
  { value: "must", label: "Must have" },
  { value: "should", label: "Should have" },
  { value: "could", label: "Could have" },
  { value: "wont", label: "Won't have (this release)" },
]
const ORDER = ["must", "should", "could", "wont"]

function Row({ m, api }: { m: Milestone; api: SectionProps["api"] }) {
  const isFeature = m.kind === "feature"
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 sm:flex-row sm:items-center">
      <input type="checkbox" aria-label={`Mark “${m.title}” done`} checked={m.done}
        onChange={e => api.updateMilestone(m.id, { done: e.target.checked })}
        className="h-4 w-4 shrink-0 accent-indigo-600" />
      <CommitText ariaLabel="Title" value={m.title} className={`sm:flex-1 ${m.done ? "line-through opacity-60" : ""}`}
        onCommit={v => { if (v.trim()) api.updateMilestone(m.id, { title: v.trim() }) }} />
      {isFeature ? (
        <NativeSelect ariaLabel="Priority" value={m.priority} options={PRIORITIES} className="h-9 sm:w-48"
          onChange={v => api.updateMilestone(m.id, { priority: v as Milestone["priority"] })} />
      ) : (
        <CommitText ariaLabel="Target date" type="date" value={m.target_date ?? ""} className="sm:w-44"
          onCommit={v => api.updateMilestone(m.id, { target_date: v })} />
      )}
      <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${m.title}`} className="text-red-600"
        onClick={() => { if (window.confirm(`Remove “${m.title}”?`)) void api.removeMilestone(m.id) }}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function ExecutionSection({ data, api }: SectionProps) {
  const bp = { data, api }
  const [title, setTitle] = useState("")
  const [kind, setKind] = useState<Milestone["kind"]>("feature")
  const [priority, setPriority] = useState<Milestone["priority"]>("must")
  const [date, setDate] = useState("")
  const [adding, setAdding] = useState(false)

  const features = data.milestones.filter(m => m.kind === "feature")
    .sort((a, b) => ORDER.indexOf(a.priority) - ORDER.indexOf(b.priority))
  const milestones = data.milestones.filter(m => m.kind === "milestone")
    .sort((a, b) => (a.target_date ?? "9999").localeCompare(b.target_date ?? "9999"))

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || adding) return
    setAdding(true)
    await api.addMilestone({ title, kind, priority, ...(kind === "milestone" && date ? { target_date: date } : {}) })
    setTitle(""); setDate("")
    setAdding(false)
  }

  return (
    <div className="space-y-6">
      <SectionTitle num="04" title="Product & Execution">
        The smallest version you could test, who builds it, and what happens when. A short, honest plan beats a long one.
      </SectionTitle>

      <Panel title="MVP scope" description="The smallest thing that lets you learn whether customers care.">
        <BpArea {...bp} s="mvp" k="objective" label="What the MVP must prove" rows={2}
          placeholder="e.g. students will follow a generated roadmap for two weeks" />
        <div className="grid gap-4 md:grid-cols-2">
          <BpArea {...bp} s="mvp" k="journey" label="Core user journey" rows={3} />
          <BpArea {...bp} s="mvp" k="excluded" label="Deliberately left out of the first release" rows={3} />
        </div>
        <BpText {...bp} s="mvp" k="successMetric" label="One success metric for the first release"
          placeholder="e.g. 20 of 50 testers complete week one" />
      </Panel>

      <Panel title="Features and milestones" description="Prioritise features (Must / Should / Could / Won't) and date the milestones you will hold yourself to.">
        <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <div>
            <Label htmlFor="ms-title" className="sr-only">Feature or milestone</Label>
            <Input id="ms-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Feature or milestone" />
          </div>
          <NativeSelect ariaLabel="Type" value={kind} onChange={v => setKind(v as Milestone["kind"])}
            options={[{ value: "feature", label: "Feature" }, { value: "milestone", label: "Milestone" }]} className="sm:w-36" />
          {kind === "feature" ? (
            <NativeSelect ariaLabel="Priority" value={priority} onChange={v => setPriority(v as Milestone["priority"])}
              options={PRIORITIES} className="sm:w-48" />
          ) : (
            <Input aria-label="Target date" type="date" value={date} onChange={e => setDate(e.target.value)} className="h-10 sm:w-44" />
          )}
          <Button type="submit" disabled={!title.trim() || adding} className="gap-2"><Plus className="h-4 w-4" /> Add</Button>
        </form>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Features</h4>
            {features.length === 0 ? <p className="text-sm text-zinc-500">No features yet. Mark at least one as “Must have”.</p> : null}
            {features.map(m => <Row key={m.id} m={m} api={api} />)}
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Milestones</h4>
            {milestones.length === 0 ? <p className="text-sm text-zinc-500">No milestones yet. Add a first launch date.</p> : null}
            {milestones.map(m => <Row key={m.id} m={m} api={api} />)}
          </div>
        </div>
      </Panel>

      <Panel title="Technology" description="Choices that fit the MVP, not the final product.">
        <TextField id="tech-stack" label="Tech stack summary" placeholder="e.g. React, Supabase, basic web scraping"
          value={data.idea.tech_stack ?? ""} onChange={v => api.setIdea({ tech_stack: v })} />
        <div className="grid gap-4 md:grid-cols-2">
          <BpArea {...bp} s="tech" k="architecture" label="Approach" rows={3} />
          <BpArea {...bp} s="tech" k="skillsNeeded" label="Skills needed" rows={3} />
          <BpArea {...bp} s="tech" k="thirdParty" label="Third-party services and dependencies" rows={3} />
          <BpArea {...bp} s="tech" k="constraints" label="Constraints" rows={3} />
          <BpArea {...bp} s="tech" k="security" label="Privacy and security considerations" rows={3} />
          <BpText {...bp} s="tech" k="effortEstimate" label="Rough effort to first launch" placeholder="e.g. 6 weeks, 2 people" />
        </div>
      </Panel>

      <Panel title="Team and resources" description="Who is doing this and what is missing.">
        <BpArea {...bp} s="team" k="background" label="Your background and why you" rows={3} />
        <div className="grid gap-4 md:grid-cols-2">
          <BpArea {...bp} s="team" k="members" label="Team members and roles" rows={3} />
          <BpArea {...bp} s="team" k="skills" label="Skills you have" rows={3} />
          <BpArea {...bp} s="team" k="gaps" label="Capability gaps" rows={3} hint="Name what you cannot do yet and who could help." />
          <BpArea {...bp} s="team" k="advisors" label="Advisors and mentors" rows={3} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <BpArea {...bp} s="team" k="resources" label="Resources you already have" rows={2} />
          <BpNumber {...bp} s="team" k="mvpBudget" label="MVP budget estimate" hint="Stored privately." />
        </div>
      </Panel>
    </div>
  )
}
