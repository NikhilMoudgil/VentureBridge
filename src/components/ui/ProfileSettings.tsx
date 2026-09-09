import { useEffect, useState } from "react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/components/ui/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { toast } from "sonner"

const supabase = createClient()

export function ProfileSettings() {
  const { user } = useAuth()
  const [role, setRole] = useState<'founder' | 'mentor' | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    fullName: "",
    companyName: "",
    industry: "",
    stage: "idea", 
    pitchSummary: "",
    expertiseAreas: "", 
    yearsExperience: 0,
    linkedinUrl: "",
  })

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return

      const { data: userData } = await supabase.from('users').select('role, full_name').eq('id', user.id).maybeSingle()
      
      if (userData) {
        setRole(userData.role)
        setFormData(prev => ({ ...prev, fullName: userData.full_name || "" }))

        if (userData.role === 'founder') {
          const { data: founderData } = await supabase.from('founders').select('*').eq('id', user.id).maybeSingle()
          if (founderData) {
            setFormData(prev => ({
              ...prev,
              companyName: founderData.company_name || "",
              industry: founderData.industry || "",
              stage: founderData.stage || "idea",
              pitchSummary: founderData.pitch_summary || "",
            }))
          }
        } else if (userData.role === 'mentor') {
          const { data: mentorData } = await supabase.from('mentors').select('*').eq('id', user.id).maybeSingle()
          if (mentorData) {
            setFormData(prev => ({
              ...prev,
              expertiseAreas: mentorData.expertise_areas?.join(", ") || "",
              yearsExperience: mentorData.years_experience || 0,
              linkedinUrl: mentorData.linkedin_url || "",
            }))
          }
        }
      }
      setLoading(false)
    }
    fetchProfile()
  }, [user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      await supabase.from('users').update({ full_name: formData.fullName }).eq('id', user?.id)

      if (role === 'founder') {
        const { error } = await supabase.from('founders').update({
          company_name: formData.companyName,
          industry: formData.industry,
          stage: formData.stage,
          pitch_summary: formData.pitchSummary,
        }).eq('id', user?.id)
        if (error) throw error
      } else if (role === 'mentor') {
        const { error } = await supabase.from('mentors').update({
          expertise_areas: formData.expertiseAreas.split(',').map(s => s.trim()),
          years_experience: Number(formData.yearsExperience),
          linkedin_url: formData.linkedinUrl,
        }).eq('id', user?.id)
        if (error) throw error
      }
      
      toast.success("Profile updated successfully!")
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading profile data...</div>

  return (
    <Card className="mx-auto max-w-2xl shadow-sm">
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>Update your personal and professional details.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" name="fullName" value={formData.fullName} onChange={handleChange} placeholder="Jane Doe" required />
          </div>

          {/* --- FOUNDER FIELDS --- */}
          {role === 'founder' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="companyName">Startup Name</Label>
                <Input id="companyName" name="companyName" value={formData.companyName} onChange={handleChange} placeholder="Acme Corp" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input id="industry" name="industry" value={formData.industry} onChange={handleChange} placeholder="e.g. FinTech, AI" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stage">Startup Stage</Label>
                  <select 
                    id="stage" name="stage" value={formData.stage} onChange={handleChange}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="idea">Idea Stage</option>
                    <option value="mvp">MVP</option>
                    <option value="seed">Seed</option>
                    <option value="growth">Growth</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pitchSummary">Elevator Pitch</Label>
                <Textarea id="pitchSummary" name="pitchSummary" value={formData.pitchSummary} onChange={handleChange} placeholder="Describe what you are building in 1-2 sentences..." />
              </div>
            </>
          )}

          {/* --- MENTOR FIELDS --- */}
          {role === 'mentor' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="expertiseAreas">Expertise Areas (comma separated)</Label>
                <Input id="expertiseAreas" name="expertiseAreas" value={formData.expertiseAreas} onChange={handleChange} placeholder="e.g. Marketing, B2B Sales, Fundraising" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="yearsExperience">Years of Experience</Label>
                  <Input id="yearsExperience" name="yearsExperience" type="number" value={formData.yearsExperience} onChange={handleChange} min="0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedinUrl">LinkedIn Profile URL</Label>
                  <Input id="linkedinUrl" name="linkedinUrl" type="url" value={formData.linkedinUrl} onChange={handleChange} placeholder="https://linkedin.com/in/yourprofile" />
                </div>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving Changes..." : "Save Profile"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}