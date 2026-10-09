import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { 
  Sparkles, Save, AlertTriangle, Target, HelpCircle, 
  Rocket, CheckCircle2, Copy, FileText, Lightbulb, Code, ChevronRight 
} from "lucide-react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { checkIdea } from "./ideaCheck"

const supabase = createClient()

export function IdeaLab() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState("problem")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  
  // Track the actual Supabase UUID of the idea to prevent ID overwriting bugs
  const [draftId, setDraftId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    problem: "",
    solution: "",
    market: "",
    techStack: ""
  })

  // Synchronous rule-based checks
  const check = useMemo(() => checkIdea(formData), [formData])
  
  // Word counters
  const getWordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length
  const problemWords = getWordCount(formData.problem)
  const solutionWords = getWordCount(formData.solution)

  // Pure form completion metric (independent of idea strength)
  const completionPercentage = useMemo(() => {
    let score = 0
    if (problemWords > 10) score += 30
    if (solutionWords > 10) score += 30
    if (formData.market.length > 5) score += 20
    if (formData.techStack.length > 2) score += 20
    return score
  }, [problemWords, solutionWords, formData.market, formData.techStack])

  useEffect(() => {
    async function loadDraft() {
      if (!user) return
      
      // Query by owner_id rather than forcing id === user.id
      const { data } = await supabase
        .from('ideas')
        .select('*')
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data) {
        setDraftId(data.id)
        setFormData({
          problem: data.problem || "",
          solution: data.solution || "",
          market: data.market || data.target_market || "",
          techStack: data.tech_stack || ""
        })
        if (data.updated_at) setLastSaved(new Date(data.updated_at))
      }
      setLoading(false)
    }
    loadDraft()
  }, [user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setIsDirty(true)
  }

  const synthesizeElevatorPitch = () => {
    const market = formData.market || "[Target Market]"
    const probSnippet = formData.problem ? formData.problem.split('.')[0] : "[Specific Pain Point]"
    const solSnippet = formData.solution ? formData.solution.split('.')[0] : "[Unique Value]"
    return `For ${market} who experience ${probSnippet}, our product provides ${solSnippet}.`
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!user) return
    setSaving(true)

    const payload: any = {
      owner_id: user.id,
      problem: formData.problem,
      solution: formData.solution,
      elevator_pitch: synthesizeElevatorPitch(),
      market: formData.market,
      target_market: formData.market,
      tech_stack: formData.techStack,
      updated_at: new Date().toISOString()
    }

    if (draftId) {
      payload.id = draftId
    }

    try {
      const { data, error } = await supabase
        .from('ideas')
        .upsert(payload)
        .select('id, updated_at')
        .single()

      if (error) throw error
      
      if (data) {
        setDraftId(data.id)
        setLastSaved(new Date(data.updated_at))
      }
      
      setIsDirty(false)
      toast.success("Venture details securely saved.")
    } catch (error: any) {
      toast.error(error.message || "Failed to save draft. Check connection.")
    } finally {
      setSaving(false)
    }
  }

  const copyPitchToClipboard = () => {
    navigator.clipboard.writeText(synthesizeElevatorPitch())
    toast.success("Pitch copied to clipboard!")
  }

  if (loading) return <div className="p-12 text-center text-sm font-medium text-zinc-500 animate-pulse">Initializing Workspace...</div>

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-12 sm:gap-8 animate-in fade-in duration-500">
      
      {/* Workspace Header */}
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-950 shadow-md border border-zinc-700 dark:from-zinc-100 dark:to-zinc-300">
              <Lightbulb className="h-5 w-5 text-zinc-100 dark:text-zinc-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">IdeaLab</h1>
              <p className="text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">
                Structure your venture hypothesis and identify execution gaps.
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-zinc-400 mr-2 hidden sm:block">
            {saving ? "Saving securely..." : isDirty ? "Unsaved changes" : lastSaved ? `Saved ${lastSaved.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : "Draft mode"}
          </span>

          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-2 border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900">
                <FileText className="h-4 w-4 text-indigo-500" /> Pitch Preview
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Pitch Preview</DialogTitle>
                <DialogDescription>A compiled summary of your current hypothesis.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Elevator Pitch</h4>
                  <p className="text-sm font-medium leading-relaxed dark:text-zinc-200">{synthesizeElevatorPitch()}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-zinc-500">Problem Focus</h4>
                    <p className="text-xs line-clamp-3 text-zinc-700 dark:text-zinc-400">{formData.problem || "Not defined."}</p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-zinc-500">Core Solution</h4>
                    <p className="text-xs line-clamp-3 text-zinc-700 dark:text-zinc-400">{formData.solution || "Not defined."}</p>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex justify-between sm:justify-between items-center w-full">
                <Button variant="ghost" size="sm" onClick={copyPitchToClipboard} className="text-zinc-500"><Copy className="h-4 w-4 mr-2"/> Copy Text</Button>
                <Link to="/dashboard/validation-lab">
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white"><Target className="h-4 w-4 mr-2"/> Validate Assumption</Button>
                </Link>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button type="button" variant="secondary" size="sm" className="gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20">
                <Sparkles className="h-4 w-4" /> Idea Check
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[95vw] sm:max-w-md border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              <SheetHeader className="pb-4 border-b border-zinc-100 dark:border-zinc-800/60">
                <SheetTitle className="flex items-center gap-2 text-xl">
                  <Sparkles className="h-5 w-5 text-indigo-500" />
                  Analysis Report
                </SheetTitle>
                <SheetDescription>Rule-based feedback on draft completeness.</SheetDescription>
              </SheetHeader>
              <ScrollArea className="mt-4 h-[calc(100vh-10rem)] pr-4">
                {!check.hasContent ? (
                  <div className="py-16 text-center text-sm text-zinc-500 flex flex-col items-center">
                    <FileText className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mb-3" />
                    {check.verdict}
                  </div>
                ) : (
                  <div className="space-y-6 pb-8">
                    {/* Score Card */}
                    <Card className="border-none shadow-none bg-zinc-50 dark:bg-zinc-900/50">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Draft Strength</span>
                          <span className="text-3xl font-bold tracking-tighter tabular-nums text-zinc-900 dark:text-zinc-50">{check.score}<span className="text-sm font-medium text-zinc-400"> / 100</span></span>
                        </div>
                        <Progress value={check.score} className="h-2.5 bg-zinc-200 dark:bg-zinc-800 [&>div]:bg-indigo-500" />
                        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed">{check.verdict}</p>
                      </CardContent>
                    </Card>

                    {check.strengths.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Established Strengths
                        </h4>
                        <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                          {check.strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 rounded-lg border border-zinc-100 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"><span className="mt-0.5 text-emerald-500">•</span> {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="space-y-3">
                      <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                        <AlertTriangle className="h-4 w-4 text-amber-500" /> Structural Gaps
                      </h4>
                      {check.risks.length === 0 ? (
                        <p className="rounded-lg border border-zinc-100 bg-white p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 shadow-sm">
                          Draft structure is solid. Validate assumptions next.
                        </p>
                      ) : (
                        <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                          {check.risks.map((r, i) => (
                            <li key={i} className="flex items-start gap-2 rounded-lg border border-zinc-100 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"><span className="mt-0.5 text-amber-500">•</span> {r}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                        <Target className="h-4 w-4 text-emerald-500" /> Initial Target Audience
                      </h4>
                      <div className="rounded-lg border border-zinc-100 bg-white p-3 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                        {check.audience}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                        <HelpCircle className="h-4 w-4 text-blue-500" /> Validation Questions
                      </h4>
                      <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {check.questions.map((q, i) => (
                          <li key={i} className="flex items-start gap-2 rounded-lg border border-zinc-100 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"><span className="mt-0.5 text-blue-500 font-bold">Q.</span> {q}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <Button onClick={() => handleSave()} disabled={saving || (!isDirty && !!draftId)} size="sm" className="gap-2 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Draft"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* LEFT COLUMN: Editor */}
        <div className="w-full lg:w-2/3">
          <form onSubmit={handleSave}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-6 grid h-auto w-full grid-cols-3 gap-2 bg-transparent p-0">
                <TabsTrigger value="problem" className={`rounded-md border-b-2 px-3 py-2 text-sm font-medium transition-all data-[state=active]:border-indigo-500 data-[state=active]:bg-zinc-50 dark:data-[state=active]:bg-zinc-900/50 ${problemWords > 10 ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'}`}>
                  <span className="hidden sm:inline">1. Define </span>Problem
                </TabsTrigger>
                <TabsTrigger value="solution" className={`rounded-md border-b-2 px-3 py-2 text-sm font-medium transition-all data-[state=active]:border-indigo-500 data-[state=active]:bg-zinc-50 dark:data-[state=active]:bg-zinc-900/50 ${solutionWords > 10 ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'}`}>
                  <span className="hidden sm:inline">2. Outline </span>Solution
                </TabsTrigger>
                <TabsTrigger value="market" className={`rounded-md border-b-2 px-3 py-2 text-sm font-medium transition-all data-[state=active]:border-indigo-500 data-[state=active]:bg-zinc-50 dark:data-[state=active]:bg-zinc-900/50 ${formData.market.length > 2 ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'}`}>
                  <span className="hidden sm:inline">3. Target </span>Market
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: PROBLEM */}
              <TabsContent value="problem" className="mt-0 focus-visible:outline-none">
                <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
                  <CardHeader className="p-5 sm:p-6 pb-4">
                    <CardTitle className="text-xl">Define the Problem</CardTitle>
                    <CardDescription className="text-sm">Identify the specific pain point and who experiences it most.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 p-5 sm:p-6 pt-0">
                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <Label htmlFor="problem" className="text-sm font-semibold">Problem Statement</Label>
                        <span className="text-[10px] font-mono text-zinc-400">{problemWords} words</span>
                      </div>
                      <Textarea 
                        id="problem" 
                        name="problem"
                        value={formData.problem} 
                        onChange={handleChange}
                        placeholder="e.g. Students often struggle to identify what to learn, in what order, and which resources to use. Existing platforms provide massive content libraries but lack personalized roadmaps..." 
                        className="min-h-[220px] text-sm resize-y leading-relaxed focus-visible:ring-indigo-500" 
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end border-t border-zinc-100 p-4 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/20">
                    <Button type="button" size="sm" onClick={() => setActiveTab("solution")}>Next Step <ChevronRight className="h-4 w-4 ml-1" /></Button>
                  </CardFooter>
                </Card>
              </TabsContent>

              {/* TAB 2: SOLUTION */}
              <TabsContent value="solution" className="mt-0 focus-visible:outline-none">
                <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
                  <CardHeader className="p-5 sm:p-6 pb-4">
                    <CardTitle className="text-xl">Outline your Solution</CardTitle>
                    <CardDescription className="text-sm">How does your product eliminate the specific pain point?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 p-5 sm:p-6 pt-0">
                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <Label htmlFor="solution" className="text-sm font-semibold">Core Value Proposition</Label>
                        <span className="text-[10px] font-mono text-zinc-400">{solutionWords} words</span>
                      </div>
                      <Textarea 
                        id="solution" 
                        name="solution"
                        value={formData.solution}
                        onChange={handleChange}
                        placeholder="e.g. A guided path generator that assesses a student's current skill level and outputs a step-by-step curriculum with links to free top-rated tutorials..." 
                        className="min-h-[220px] text-sm resize-y leading-relaxed focus-visible:ring-indigo-500" 
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between border-t border-zinc-100 p-4 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/20">
                    <Button type="button" variant="outline" size="sm" onClick={() => setActiveTab("problem")}>Back</Button>
                    <Button type="button" size="sm" onClick={() => setActiveTab("market")}>Next Step <ChevronRight className="h-4 w-4 ml-1" /></Button>
                  </CardFooter>
                </Card>
              </TabsContent>

              {/* TAB 3: MARKET */}
              <TabsContent value="market" className="mt-0 focus-visible:outline-none">
                <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
                  <CardHeader className="p-5 sm:p-6 pb-4">
                    <CardTitle className="text-xl">Market & Execution</CardTitle>
                    <CardDescription className="text-sm">Define the audience segment and required technology.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5 p-5 sm:p-6 pt-0">
                    <div className="space-y-2">
                      <Label htmlFor="market" className="text-sm font-semibold">Target Audience</Label>
                      <Input 
                        id="market" 
                        name="market"
                        value={formData.market}
                        onChange={handleChange}
                        placeholder="e.g. 2nd-year CS students aiming for internships" 
                        className="text-sm h-11 focus-visible:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="techStack" className="text-sm font-semibold">Tech Stack / Required Capabilities</Label>
                      <Input 
                        id="techStack" 
                        name="techStack"
                        value={formData.techStack}
                        onChange={handleChange}
                        placeholder="e.g. React, Supabase, Basic Web Scraping" 
                        className="text-sm h-11 focus-visible:ring-indigo-500"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between border-t border-zinc-100 p-4 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/20">
                    <Button type="button" variant="outline" size="sm" onClick={() => setActiveTab("solution")}>Back</Button>
                    <Button type="submit" disabled={saving || (!isDirty && !!draftId)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      {saving ? "Saving..." : "Commit Draft"}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>

            </Tabs>
          </form>
        </div>

        {/* RIGHT COLUMN: Persistent Guidance & Snapshot */}
        <div className="hidden lg:flex w-1/3 flex-col gap-6">
          
          {/* Progress Overview */}
          <Card className="border-none shadow-sm bg-zinc-50 dark:bg-zinc-900/30">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Draft Completion</h4>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{completionPercentage}%</span>
              </div>
              <Progress value={completionPercentage} className="h-2 bg-zinc-200 dark:bg-zinc-800 [&>div]:bg-indigo-500" />
              <div className="flex gap-2">
                <Badge variant={problemWords > 10 ? "default" : "secondary"} className="text-[9px] uppercase px-1.5 py-0">Problem</Badge>
                <Badge variant={solutionWords > 10 ? "default" : "secondary"} className="text-[9px] uppercase px-1.5 py-0">Solution</Badge>
                <Badge variant={formData.market.length > 2 ? "default" : "secondary"} className="text-[9px] uppercase px-1.5 py-0">Market</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Contextual Guidance */}
          <Card className="border-indigo-100 bg-indigo-50/50 dark:border-indigo-900/30 dark:bg-indigo-950/10 shadow-sm">
            <CardContent className="p-5">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-3">
                <HelpCircle className="h-4 w-4" /> Writing Guide
              </h4>
              <div className="text-sm text-indigo-800/80 dark:text-indigo-300/80 leading-relaxed">
                {activeTab === "problem" && (
                  <ul className="space-y-2 list-disc pl-4 marker:text-indigo-400">
                    <li>Who exactly experiences this problem?</li>
                    <li>How are they currently trying to solve it?</li>
                    <li>Is this a minor annoyance or a costly failure?</li>
                  </ul>
                )}
                {activeTab === "solution" && (
                  <ul className="space-y-2 list-disc pl-4 marker:text-indigo-400">
                    <li>What is the core mechanism of your solution?</li>
                    <li>Why is it better than the existing alternatives?</li>
                    <li>What is the first "magic moment" for the user?</li>
                  </ul>
                )}
                {activeTab === "market" && (
                  <ul className="space-y-2 list-disc pl-4 marker:text-indigo-400">
                    <li>Define a niche. "Everyone" is not a target market.</li>
                    <li>Who is easiest to reach first?</li>
                    <li>Keep the tech stack focused on MVP capabilities.</li>
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Live Snapshot */}
          <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 shadow-sm flex-1">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-zinc-500 uppercase tracking-wider">
                <Code className="h-4 w-4" /> Live Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-2 space-y-4">
              <div>
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Problem</span>
                <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300 line-clamp-3">
                  {formData.problem || "Not defined."}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Solution</span>
                <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300 line-clamp-3">
                  {formData.solution || "Not defined."}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Audience</span>
                <p className="mt-1 text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  {formData.market || "Not defined."}
                </p>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}