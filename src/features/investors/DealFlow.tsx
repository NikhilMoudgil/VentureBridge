import { useEffect, useState } from "react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, CheckCircle2, X } from "lucide-react"
import { toast } from "sonner"
import { Link } from "react-router-dom"

const supabase = createClient()

type Deal = {
  id: string
  idea_id?: string | null
  status: string
  founders: { full_name: string; industry: string } | null
  ideas: { name?: string | null; tagline?: string | null; elevator_pitch?: string | null; problem?: string | null; target_market?: string | null } | null
}

// Supabase returns a joined row as an object or a one-item array depending on the relation
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

export function DealFlow() {
  const { user } = useAuth()
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDeals() {
      if (!user) return
      
      const query = (ideaCols: string) => supabase
        .from('deal_flow')
        .select(`id, status, idea_id, founders(full_name, industry), ideas(${ideaCols})`)
        .eq('investor_id', user.id)
        .order('created_at', { ascending: false })

      let res: { data: any[] | null; error: { message: string } | null } = await query('name, tagline, elevator_pitch, problem, target_market')
      // Database upgrade not applied yet (no name/tagline columns): fall back to the original fields.
      if (res.error) res = await query('elevator_pitch, problem, target_market')
      const { data, error } = res

      if (error) {
        console.error("Deal Flow Fetch Error:", error)
        toast.error(`Database Error: ${error.message}`)
      } else if (data) {
        setDeals(data.map(d => ({ ...d, founders: one(d.founders), ideas: one(d.ideas) })))
      }
      setLoading(false)
    }

    fetchDeals()

    if (!user) return
    const channel = supabase.channel(`investor_deal_flow_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_flow', filter: `investor_id=eq.${user.id}` }, () => {
        fetchDeals()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  const updateDealStatus = async (dealId: string, newStatus: 'interested' | 'passed') => {
    try {
      const { error } = await supabase.from('deal_flow').update({ status: newStatus }).eq('id', dealId)
      if (error) throw error
      toast.success(`Deal marked as ${newStatus}`)
    } catch (err: any) { 
      toast.error(err.message || "Failed to update status") 
    }
  }

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading deal flow pipeline...</div>

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Deal Flow Pipeline</h1>
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm">Discover and evaluate vetted startup pitches.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 mt-2">
        {deals.length === 0 ? (
          <Card className="col-span-2 flex flex-col items-center justify-center border-dashed bg-zinc-50 py-16 sm:py-24 text-zinc-500 dark:bg-zinc-900/20">
            <TrendingUp className="mb-4 h-8 w-8 opacity-20" />
            <p className="text-xs sm:text-sm">No pitches received yet. Ensure your profile is updated.</p>
          </Card>
        ) : deals.map(deal => (
          <Card key={deal.id} className="flex flex-col justify-between transition-all hover:border-zinc-400">
            <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
              <div className="flex items-center justify-between mb-2">
                <Badge className={deal.status === 'interested' ? "bg-emerald-100 text-emerald-700 text-[10px]" : deal.status === 'passed' ? "bg-zinc-100 text-zinc-500 text-[10px]" : "bg-indigo-100 text-indigo-700 text-[10px]"}>
                  {deal.status.toUpperCase()}
                </Badge>
                <span className="text-xs font-mono text-zinc-500">{deal.founders?.industry || "Tech"}</span>
              </div>
              <CardTitle className="text-base sm:text-lg">{deal.ideas?.name?.trim() || `Pitch by ${deal.founders?.full_name ?? "a founder"}`}</CardTitle>
              {deal.ideas?.name?.trim() ? <p className="text-xs text-zinc-500">by {deal.founders?.full_name ?? "a founder"}</p> : null}
              <CardDescription className="mt-2 line-clamp-2 text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 font-medium">
                {deal.ideas?.tagline?.trim() || deal.ideas?.elevator_pitch || "No pitch provided."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0 pb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Problem</span>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">{deal.ideas?.problem}</p>
              </div>
              {deal.ideas?.target_market ? (
                <p className="line-clamp-1 text-xs text-zinc-500"><span className="font-semibold text-zinc-700 dark:text-zinc-300">Market:</span> {deal.ideas.target_market}</p>
              ) : null}
            </CardContent>
            {deal.idea_id ? (
              <div className="px-4 pb-4 sm:px-6">
                <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                  <Link to={`/dashboard/pitch/${deal.idea_id}`}>View full pitch</Link>
                </Button>
              </div>
            ) : null}
            
            {(deal.status === 'submitted' || deal.status === 'reviewing') && (
              <CardFooter className="border-t bg-zinc-50 p-3 sm:p-4 dark:border-zinc-800 dark:bg-zinc-900/50 flex flex-col sm:flex-row gap-2">
                <Button size="sm" className="w-full sm:w-1/2 bg-emerald-600 hover:bg-emerald-700 text-xs" onClick={() => updateDealStatus(deal.id, 'interested')}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Interested
                </Button>
                <Button size="sm" variant="outline" className="w-full sm:w-1/2 text-red-600 text-xs" onClick={() => updateDealStatus(deal.id, 'passed')}>
                  <X className="h-4 w-4 mr-2" /> Pass
                </Button>
              </CardFooter>
            )}
            {deal.status === 'interested' && (
              <CardFooter className="border-t bg-emerald-50 p-3 sm:p-4 text-xs sm:text-sm text-emerald-700 font-medium">
                <CheckCircle2 className="h-4 w-4 mr-2 shrink-0" /> Private Chat Unlocked in Messages
              </CardFooter>
            )}
            {deal.status === 'passed' && (
              <CardFooter className="border-t bg-zinc-100 p-3 sm:p-4 text-xs sm:text-sm text-zinc-500 font-medium">
                <X className="h-4 w-4 mr-2 shrink-0" /> You passed on this deal.
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}