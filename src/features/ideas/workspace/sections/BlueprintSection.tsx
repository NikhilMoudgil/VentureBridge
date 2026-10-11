import { AreaField, BpArea, BpText, Notice, Panel, SectionTitle, TextField, words } from "../fields"
import type { SectionProps } from "./nav"

export function BlueprintSection({ data, api }: SectionProps) {
  const { idea } = data
  const bp = { data, api }
  const hasObservations = (idea.blueprint.problem?.observations ?? "").trim().length > 0
  const hasAssumptions = (idea.blueprint.problem?.assumptions ?? "").trim().length > 0

  return (
    <div className="space-y-6">
      <SectionTitle num="01" title="Venture Blueprint">
        The foundation of the venture: the problem, your solution and who you are building it for. Be specific; vague
        answers are the cheapest thing to improve and the first thing mentors push back on.
      </SectionTitle>

      <Panel title="The problem" description="Who has it, how often, what it costs them, and what they do today.">
        <AreaField id="problem" label="Problem statement" rows={6} showWords
          hint="Say who has the problem, what goes wrong, and how often or how much it costs."
          placeholder="e.g. Second-year students waste hours each week deciding what to learn next because existing platforms offer huge libraries but no personalised order…"
          value={idea.problem ?? ""} onChange={v => api.setIdea({ problem: v })} />
        <div className="grid gap-4 md:grid-cols-2">
          <BpText {...bp} s="problem" k="who" label="Who experiences it most" placeholder="e.g. 2nd-year CS students in tier-2 colleges" />
          <BpText {...bp} s="problem" k="frequency" label="How often" placeholder="e.g. every week before assignments" />
          <BpText {...bp} s="problem" k="severity" label="How severe" placeholder="e.g. loses 5+ hours a week; misses deadlines" />
          <BpText {...bp} s="problem" k="consequences" label="Cost or consequence" placeholder="e.g. lower grades, fewer interview calls" />
        </div>
        <BpArea {...bp} s="problem" k="workarounds" label="What they do today" rows={3}
          hint="Include non-product workarounds: spreadsheets, asking friends, doing nothing." />
        <div className="grid gap-4 md:grid-cols-2">
          <BpArea {...bp} s="problem" k="observations" label="What you have actually observed" rows={4}
            hint="Facts from real conversations or data: who said what, how many people, what you measured." />
          <BpArea {...bp} s="problem" k="assumptions" label="What you are still assuming" rows={4}
            hint="Beliefs you have not yet checked. These become your risks and hypotheses." />
        </div>
        {hasAssumptions && !hasObservations ? (
          <Notice tone="warn">
            You have written assumptions but no observed facts yet. Talk to five affected people and record what they said under
            “observed”; the scorecard and your pitch keep these two apart.
          </Notice>
        ) : null}
      </Panel>

      <Panel title="Your solution" description="What the product does and why someone would switch to it.">
        <AreaField id="solution" label="Core value proposition" rows={6} showWords
          hint="What does the product do, and how does that remove the pain above?"
          placeholder="e.g. A guided path generator that assesses current skill level and outputs a step-by-step curriculum with free tutorials…"
          value={idea.solution ?? ""} onChange={v => api.setIdea({ solution: v })} />
        <div className="grid gap-4 md:grid-cols-2">
          <BpText {...bp} s="solution" k="valueProposition" label="Unique value proposition (one line)" />
          <BpText {...bp} s="solution" k="primaryOutcome" label="The main outcome for the customer" />
        </div>
        <BpArea {...bp} s="solution" k="howItWorks" label="How it works" rows={3} />
        <div className="grid gap-4 md:grid-cols-2">
          <BpArea {...bp} s="solution" k="differentiation" label="How it is different from what they use today" rows={3}
            hint="Compare against real alternatives on the Customer & Market page." />
          <BpArea {...bp} s="solution" k="whySwitch" label="Why would they switch" rows={3} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <BpArea {...bp} s="solution" k="benefits" label="Key benefits" rows={3} />
          <BpArea {...bp} s="solution" k="limitations" label="Limitations of your solution" rows={3}
            hint="Naming limits honestly builds credibility." />
        </div>
      </Panel>

      <Panel title="Customer persona" description="Pick one first segment you can reach personally; “everyone” cannot be tested.">
        <TextField id="market" label="Target audience (one line)"
          hint="Shown to other members and used in your elevator pitch."
          placeholder="e.g. 2nd-year CS students aiming for internships"
          value={idea.market ?? ""} onChange={v => api.setIdea({ market: v })} />
        <div className="grid gap-4 md:grid-cols-2">
          <BpText {...bp} s="persona" k="segment" label="First customer segment" placeholder="e.g. CS students at one college" />
          <BpText {...bp} s="persona" k="primaryUser" label="Primary user" />
          <BpText {...bp} s="persona" k="economicBuyer" label="Who pays" hint="Write “same as user” if so." />
          <BpText {...bp} s="persona" k="geography" label="Geography" />
        </div>
        <BpArea {...bp} s="persona" k="useCase" label="Main use case" rows={2} />
        <div className="grid gap-4 md:grid-cols-2">
          <BpArea {...bp} s="persona" k="needs" label="Needs" rows={3} />
          <BpArea {...bp} s="persona" k="painPoints" label="Pain points" rows={3} />
          <BpArea {...bp} s="persona" k="motivation" label="Motivation to change" rows={3} />
          <BpArea {...bp} s="persona" k="barriers" label="Barriers to adopting" rows={3} />
        </div>
        <BpArea {...bp} s="persona" k="earlyAdopters" label="Who would try it first (early adopters)" rows={2}
          hint="Traits of the people who feel the problem most and will tolerate a rough first version." />
        <BpArea {...bp} s="persona" k="alternatives" label="Alternatives they use today (summary)" rows={2} />
        {words(idea.problem ?? "") === 0 && words(idea.solution ?? "") === 0 ? (
          <Notice>Start with the problem. Everything else on this page is easier once it is written down.</Notice>
        ) : null}
      </Panel>
    </div>
  )
}
