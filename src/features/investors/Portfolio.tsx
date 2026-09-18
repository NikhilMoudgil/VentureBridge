import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Briefcase, ExternalLink, Activity } from "lucide-react"

export function Portfolio() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Portfolio</h1>
        <p className="mt-1 text-zinc-500">Track milestones and updates from your active investments.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500" /> Portfolio Health
            </CardTitle>
            <CardDescription>Aggregate metrics across your backed ventures.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
              <span className="text-sm text-zinc-500">Analytics integration pending first investment.</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-indigo-500" /> Active Commitments
            </CardTitle>
            <CardDescription>Startups you are currently advising or funding.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="text-center">
                <p className="text-sm text-zinc-500">No active portfolio companies.</p>
                <Button variant="link" className="mt-2 h-auto p-0 text-indigo-600">
                  Browse Deal Flow <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}