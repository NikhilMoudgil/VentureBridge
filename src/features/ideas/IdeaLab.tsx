import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { Sparkles, Save, AlertTriangle, Target, HelpCircle, Rocket, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { checkIdea } from "./ideaCheck"

const supabase = createClient()

export function IdeaLab() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState("problem")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    problem: "",
    solution: "",
    market: "",
    techStack: ""
  })

  // Instant, rule-based feedback on the current draft (no network, no cost)
  const check = useMemo(() => checkIdea(formData), [formData])

  useEffect(() => {
    async function loadDraft() {
      if (!user) return
      const { data } = await supabase.from('ideas').select('*').eq('id', user.id).maybeSingle()
      if (data) {
        setFormData({
          problem: data.problem || data.solution || "",
          solution: data.solution || data.elevator_pitch || "",
          market: data.market || data.target_market || "",
          techStack: data.tech_stack || ""
        })
      }
      setLoading(false)
    }
    loadDraft()
  }, [user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    // Satisfy all potential columns seen in your schema graph
    const payload = {
      id: user.id,
      owner_id: user.id,
      problem: formData.problem,
      solution: formData.solution,
      elevator_pitch: formData.solution, // Sync legacy column
      market: formData.market,
      target_market: formData.market, // Sync legacy column
      tech_stack: formData.techStack,
      updated_at: new Date().toISOString()
    }

    try {
      const { error } = await supabase.from('ideas').upsert(payload)
      if (error) throw error
      toast.success("Venture details saved successfully!")
    } catch (error: any) {
      toast.error(error.message || "Failed to save draft.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading IdeaLab workspace...</div>

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 pb-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">IdeaLab</h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            Structure your venture hypothesis and check how strong your draft is.
          </p>
        </div>
        <div className="mt-4 flex gap-3 md:mt-0">
          <Sheet>
            <SheetTrigger asChild>
              <Button type="button" variant="secondary" className="gap-2">
                <Sparkles className="h-4 w-4" /> Idea Check
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-500" />
                  Idea Check
                </SheetTitle>
                <SheetDescription>
                  Instant feedback on how complete and specific your draft is. It updates as you type.
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="mt-6 h-[calc(100vh-8rem)] pr-4">
                {!check.hasContent ? (
                  <div className="py-12 text-center text-sm text-zinc-500">{check.verdict}</div>
                ) : (
                  <div className="space-y-6 pb-8">
                    <div className="space-y-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-medium">Draft strength</span>
                        <span className="text-2xl font-semibold tabular-nums">{check.score}<span className="text-sm font-normal text-zinc-500"> / 100</span></span>
                      </div>
                      <Progress value={check.score} className="h-2" />
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{check.verdict}</p>
                    </div>

                    {check.strengths.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-50">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> What's working
                        </h4>
                        <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                          {check.strengths.map((s, i) => (
                            <li key={i} className="rounded-md border p-3 dark:border-zinc-800">{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="space-y-3">
                      <h4 className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-50">
                        <AlertTriangle className="h-4 w-4 text-amber-500" /> Gaps to fix
                      </h4>
                      {check.risks.length === 0 ? (
                        <p className="rounded-md border p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                          No obvious gaps in how the draft is written. The real risks are the ones only customers can confirm.
                        </p>
                      ) : (
                        <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                          {check.risks.map((r, i) => (
                            <li key={i} className="rounded-md border p-3 dark:border-zinc-800">{r}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h4 className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-50">
                        <Target className="h-4 w-4 text-emerald-500" /> Who to talk to first
                      </h4>
                      <div className="rounded-md border p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                        {check.audience}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-50">
                        <HelpCircle className="h-4 w-4 text-blue-500" /> Questions to answer with real customers
                      </h4>
                      <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {check.questions.map((q, i) => (
                          <li key={i} className="rounded-md border p-3 dark:border-zinc-800">{q}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-3">
                      <h4 className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-50">
                        <Rocket className="h-4 w-4 text-indigo-500" /> First steps
                      </h4>
                      <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {check.mvpSteps.map((step, i) => (
                          <li key={i} className="rounded-md border p-3 dark:border-zinc-800">{step}</li>
                        ))}
                      </ul>
                    </div>

                    <p className="text-xs leading-relaxed text-zinc-500">
                      These are rule-based checks on how the draft is written. They can't tell you whether the market wants it. Only customers can, so log what you learn in the Validation Lab.
                    </p>
                  </div>
                )}
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Draft"}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-8 grid w-full grid-cols-3">
            <TabsTrigger value="problem">1. The Problem</TabsTrigger>
            <TabsTrigger value="solution">2. The Solution</TabsTrigger>
            <TabsTrigger value="market">3. Market & Stage</TabsTrigger>
          </TabsList>

          <TabsContent value="problem">
            <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <CardHeader>
                <CardTitle>Define the Problem</CardTitle>
                <CardDescription>What is the core pain point you are solving?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="problem">Problem Statement</Label>
                  <Textarea 
                    id="problem" 
                    name="problem"
                    value={formData.problem} 
                    onChange={handleChange}
                    placeholder="Describe the problem your target audience faces..." 
                    className="min-h-[150px]" 
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end border-t border-zinc-100 p-4 dark:border-zinc-800">
                <Button type="button" onClick={() => setActiveTab("solution")}>Next: The Solution →</Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="solution">
            <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <CardHeader>
                <CardTitle>Outline your Solution</CardTitle>
                <CardDescription>How does your product eliminate the pain point?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="solution">Core Value Proposition</Label>
                  <Textarea 
                    id="solution" 
                    name="solution"
                    value={formData.solution}
                    onChange={handleChange}
                    placeholder="Describe your product or service..." 
                    className="min-h-[150px]" 
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t border-zinc-100 p-4 dark:border-zinc-800">
                <Button type="button" variant="outline" onClick={() => setActiveTab("problem")}>← Back</Button>
                <Button type="button" onClick={() => setActiveTab("market")}>Next: Market & Stage →</Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="market">
            <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <CardHeader>
                <CardTitle>Market & Execution</CardTitle>
                <CardDescription>Who is paying for this and where are you right now?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="market">Target Audience</Label>
                  <Input 
                    id="market" 
                    name="market"
                    value={formData.market}
                    onChange={handleChange}
                    placeholder="e.g. B2B SaaS companies, College students" 
                  />
                </div>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="techStack">Tech Stack / Required Skills</Label>
                  <Input 
                    id="techStack" 
                    name="techStack"
                    value={formData.techStack}
                    onChange={handleChange}
                    placeholder="e.g. React, Python, Marketing" 
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t border-zinc-100 p-4 dark:border-zinc-800">
                <Button type="button" variant="outline" onClick={() => setActiveTab("solution")}>← Back</Button>
                <Button type="submit" disabled={saving}>Save Venture Details</Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </form>
    </div>
  )
}