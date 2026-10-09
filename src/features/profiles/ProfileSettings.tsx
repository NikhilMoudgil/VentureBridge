import { useEffect, useState } from "react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Save, User, Briefcase, Award, Rocket, TrendingUp } from "lucide-react"

const supabase = createClient()

export function ProfileSettings() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState<'founder' | 'mentor' | 'investor' | null>(null)

  const [formData, setFormData] = useState({
    full_name: "",
    industry: "",
    startup_stage: "",
    funding_goal: "",
    skills: "", 
    experience_years: "", 
    firm_name: "",
    investment_stage: "",
    thesis: ""
  })

  useEffect(() => {
    async function loadProfile() {
      if (!user) return

      const { data: baseUser } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
      
      if (baseUser) {
        const userRole = baseUser.role as 'founder' | 'mentor' | 'investor'
        setRole(userRole)

        if (userRole === 'founder') {
          const { data } = await supabase.from('founders').select('*').eq('id', user.id).maybeSingle()
          if (data) {
            setFormData(prev => ({
              ...prev,
              full_name: data.full_name || "",
              industry: data.industry || "",
              startup_stage: data.startup_stage || "",
              funding_goal: data.funding_goal || "",
              skills: data.skills || "",
            }))
          }
        } else if (userRole === 'mentor') {
          const { data } = await supabase.from('mentors').select('*').eq('id', user.id).maybeSingle()
          if (data) {
            setFormData(prev => ({
              ...prev,
              full_name: data.full_name || "",
              industry: data.industry || "",
              skills: data.skills || "",
              experience_years: data.experience_years ? data.experience_years.toString() : ""
            }))
          }
        } else if (userRole === 'investor') {
          const { data } = await supabase.from('investors').select('*').eq('id', user.id).maybeSingle()
          if (data) {
            setFormData(prev => ({
              ...prev,
              full_name: data.full_name || "",
              firm_name: data.firm_name || "",
              investment_stage: data.investment_stage || "",
              thesis: data.thesis || ""
            }))
          }
        }
      }
      setLoading(false)
    }
    loadProfile()
  }, [user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !role) return
    setSaving(true)

    try {
      if (role === 'founder') {
        const { error } = await supabase.from('founders').update({
          full_name: formData.full_name,
          industry: formData.industry,
          startup_stage: formData.startup_stage,
          funding_goal: formData.funding_goal,
          skills: formData.skills,
        }).eq('id', user.id)
        if (error) throw error
      } else if (role === 'mentor') {
        const { error } = await supabase.from('mentors').update({
          full_name: formData.full_name,
          industry: formData.industry,
          experience_years: parseInt(formData.experience_years) || 0,
          skills: formData.skills,
        }).eq('id', user.id)
        if (error) throw error
      } else if (role === 'investor') {
        const { error } = await supabase.from('investors').update({
          full_name: formData.full_name,
          firm_name: formData.firm_name,
          investment_stage: formData.investment_stage,
          thesis: formData.thesis,
        }).eq('id', user.id)
        if (error) throw error
      }
      
      toast.success("Profile updated successfully!")
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading profile data...</div>

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-8 sm:gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">Profile Settings</h1>
        <p className="mt-1 text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">
          Manage your account details and matching parameters.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4 sm:space-y-6">
        <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <User className="h-5 w-5" /> Personal Information
              </CardTitle>
              <Badge variant="outline" className="uppercase text-[10px]">{role}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-xs sm:text-sm">Full Name</Label>
                <Input 
                  id="full_name" name="full_name" 
                  value={formData.full_name} onChange={handleChange} 
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">Email Address (Read Only)</Label>
                <Input value={user?.email || ""} disabled className="bg-zinc-50 dark:bg-zinc-900 text-sm" />
              </div>
            </div>

            {role === 'investor' && (
              <div className="space-y-2 pt-2">
                <Label htmlFor="firm_name" className="text-xs sm:text-sm">Venture Firm / Syndicate Name (Optional)</Label>
                <Input 
                  id="firm_name" name="firm_name" 
                  placeholder="e.g. Sequoia, AngelList Syndicate, Independent"
                  value={formData.firm_name} onChange={handleChange} 
                  className="text-sm"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              {role === 'founder' && <Rocket className="h-5 w-5" />}
              {role === 'mentor' && <Award className="h-5 w-5" />}
              {role === 'investor' && <TrendingUp className="h-5 w-5" />}
              
              {role === 'founder' && "Venture & Matching Parameters"}
              {role === 'mentor' && "Professional Background"}
              {role === 'investor' && "Investment Mandate"}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              This data powers the algorithm to pair you accurately across the platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            {role !== 'investor' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="industry" className="flex items-center gap-2 text-xs sm:text-sm"><Briefcase className="h-3 w-3"/> Primary Industry</Label>
                  <Input 
                    id="industry" name="industry" 
                    placeholder="e.g. FinTech, EdTech, SaaS"
                    value={formData.industry} onChange={handleChange} 
                    className="text-sm"
                  />
                </div>

                {role === 'mentor' ? (
                  <div className="space-y-2">
                    <Label htmlFor="experience_years" className="text-xs sm:text-sm">Years of Experience</Label>
                    <Input 
                      id="experience_years" name="experience_years" type="number" min="0"
                      placeholder="e.g. 5, 10, 15"
                      value={formData.experience_years} onChange={handleChange} 
                      className="text-sm"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="startup_stage" className="text-xs sm:text-sm">Startup Stage</Label>
                    <Input 
                      id="startup_stage" name="startup_stage" 
                      placeholder="e.g. Idea, MVP, Pre-Seed, Seed"
                      value={formData.startup_stage} onChange={handleChange} 
                      className="text-sm"
                    />
                  </div>
                )}
              </div>
            )}

            {role === 'founder' && (
              <div className="space-y-2">
                <Label htmlFor="funding_goal" className="text-xs sm:text-sm">Funding Goal / Status</Label>
                <Input 
                  id="funding_goal" name="funding_goal" 
                  placeholder="e.g. Bootstrapped, Raising Pre-Seed ($500k)"
                  value={formData.funding_goal} onChange={handleChange} 
                  className="text-sm"
                />
              </div>
            )}

            {role === 'investor' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="investment_stage" className="text-xs sm:text-sm">Target Investment Stage</Label>
                  <Input 
                    id="investment_stage" name="investment_stage" 
                    placeholder="e.g. Pre-Seed, Seed, Series A"
                    value={formData.investment_stage} onChange={handleChange} 
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor={role === 'investor' ? 'thesis' : 'skills'} className="text-xs sm:text-sm">
                {role === 'founder' && "Tech Stack / Mentorship Needs (Comma separated)"}
                {role === 'mentor' && "Core Skills & Tech Stack"}
                {role === 'investor' && "Investment Thesis & Focus Areas"}
              </Label>
              <Textarea 
                id={role === 'investor' ? 'thesis' : 'skills'} 
                name={role === 'investor' ? 'thesis' : 'skills'} 
                placeholder={
                  role === 'founder' ? "e.g. React, Fundraising, Go-To-Market" : 
                  role === 'mentor' ? "e.g. React Architecture, B2B Sales" : 
                  "e.g. Climate Tech, B2B SaaS, targeting $100k checks..."
                }
                value={role === 'investor' ? formData.thesis : formData.skills} 
                onChange={handleChange} 
                className="min-h-[100px] text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} size="sm" className="w-full sm:w-auto gap-2 sm:size-default">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  )
}