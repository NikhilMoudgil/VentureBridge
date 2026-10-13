/** Domain types for the IdeaLab 2.0 workspace. Pure data, no I/O. */

export type EvidenceStatus = "unknown" | "assumption" | "researched" | "validated"
export type StartupStage = "idea" | "research" | "prototype" | "mvp" | "early_traction" | "growth"
export type WorkspaceStatus = "draft" | "exploring" | "validating" | "pitch_ready"
export type BusinessModelType =
  | "subscription" | "one_time" | "marketplace" | "usage_based" | "service" | "other"
export type BillingInterval = "monthly" | "quarterly" | "annual" | "one_time"

/** Bounded, evolving structures stored in idea_workspace.blueprint (JSONB, owner-only). */
export type Blueprint = {
  /** Funding ask. Lives here (owner-only table) so other members cannot read it from `ideas`. */
  funding?: { goal?: number | null; useOfFunds?: string }
  problem?: {
    who?: string; context?: string; frequency?: string; severity?: string
    consequences?: string; workarounds?: string
    observations?: string   // facts the founder has seen/heard
    assumptions?: string    // beliefs still to verify
  }
  solution?: {
    valueProposition?: string; howItWorks?: string; benefits?: string
    differentiation?: string; whySwitch?: string; primaryOutcome?: string; limitations?: string
  }
  persona?: {
    segment?: string; primaryUser?: string; economicBuyer?: string; useCase?: string
    geography?: string; needs?: string; painPoints?: string; alternatives?: string
    motivation?: string; barriers?: string; earlyAdopters?: string
  }
  business?: {
    whoPays?: string; paysFor?: string; revenueStreams?: string
    pricingModel?: string; acquisitionChannels?: string; salesApproach?: string
    ongoingExpenses?: string; retentionAssumption?: string
    model?: BusinessModelType
    price?: number | null; billing?: BillingInterval
    customers?: number | null; newCustomersPerMonth?: number | null
    variableCostPerCustomerMonthly?: number | null
    fixedCostsMonthly?: number | null; acquisitionSpendMonthly?: number | null
  }
  mvp?: { objective?: string; journey?: string; successMetric?: string; excluded?: string }
  tech?: {
    architecture?: string; skillsNeeded?: string; teamCapabilities?: string; gaps?: string
    thirdParty?: string; constraints?: string; security?: string; effortEstimate?: string
  }
  team?: { background?: string; members?: string; skills?: string; gaps?: string
           advisors?: string; resources?: string; mvpBudget?: number | null }
}

export type PitchSettings = {
  /** section id -> included in the shareable version */
  include?: Record<string, boolean>
  /** founder-edited overrides; never auto-overwritten */
  overrides?: Record<string, string>
}

export type Idea = {
  id: string
  name: string | null
  tagline: string | null
  problem: string | null
  solution: string | null
  market: string | null
  target_market: string | null
  tech_stack: string | null
  elevator_pitch: string | null
  industry: string | null
  startup_stage: StartupStage | null
  business_model: string | null
  geographic_focus: string | null
  funding_goal: number | null
  use_of_funds: string | null
  pitch_ready_confirmed: boolean
  /** Loaded from the owner-only `idea_workspace` table (NOT a column of `ideas`, which every
   *  authenticated user can read). The loader merges it in; absent row => {}. */
  blueprint: Blueprint
  pitch_settings: PitchSettings
  health_score: number | null
  row_version: number
  updated_at: string | null
}

export type Competitor = {
  id: string; name: string; kind: "direct" | "indirect" | "non_product"
  strengths?: string | null; limitations?: string | null; pricing?: string | null
  differentiation?: string | null; source_url?: string | null
}

export type MarketAssumption = {
  tier: "tam" | "sam" | "som"
  customer_count: number | null
  annual_spend_per_customer: number | null
  basis?: string | null; source_url?: string | null; source_date?: string | null
  evidence_status: EvidenceStatus
}

export type Risk = {
  id: string; title: string; kind: "risk" | "assumption"; category: string
  likelihood: number; impact: number; evidence_status: EvidenceStatus
  mitigation?: string | null; hypothesis_id?: string | null
}

export type Milestone = {
  id: string; title: string; priority: "must" | "should" | "could" | "wont"
  kind: "feature" | "milestone"; target_date?: string | null; done: boolean
}

export type HypothesisStatus = "testing" | "validated" | "invalidated" | "inconclusive"

export type HypothesisLite = {
  id: string; status: HypothesisStatus
  success_metric?: string | null; success_threshold?: string | null
  experimentCount: number
}

/** Everything the deterministic scorecard may read. */
export type VentureSnapshot = {
  idea: Idea
  competitors: Competitor[]
  market: MarketAssumption[]
  risks: Risk[]
  milestones: Milestone[]
  hypotheses: HypothesisLite[]
}

/** Derived lifecycle of a single risk/assumption. Never inferred as "supported" from experiments alone. */
export type AssumptionState =
  | "untested" | "experiment_planned" | "evidence_recorded"
  | "supported" | "rejected" | "inconclusive"
