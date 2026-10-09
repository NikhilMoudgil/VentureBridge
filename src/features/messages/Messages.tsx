import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Send, Sparkles, Calendar, HelpCircle, TrendingUp, Compass, Clock, Trash2, ArrowLeft, Video } from "lucide-react"
import { toast } from "sonner"
import { VideoCall } from "@/components/VideoCall"

const supabase = createClient()

type Contact = {
  id: string
  full_name: string
  role: 'Founder' | 'Mentor' | 'Investor' | string
  industry?: string
}

type Message = { id: string; sender_id: string; receiver_id: string; content: string; created_at: string }
type PromptTemplate = { id: string, label: string, icon: React.ReactNode, text: string }

const FOUNDER_PROMPTS: PromptTemplate[] = [
  { id: "intro_call", label: "Request Intro Call", icon: <Calendar className="h-3 w-3" />, text: "Thanks for connecting! Do you have 15 minutes this week for a brief introductory call to discuss our venture roadmap?" },
  { id: "pitch_feedback", label: "Pitch Feedback", icon: <Sparkles className="h-3 w-3" />, text: "I'd love to get your thoughts on our latest pitch deck. When would be a good time to share it?" },
  { id: "growth_advice", label: "Growth Advice", icon: <TrendingUp className="h-3 w-3" />, text: "We are currently navigating some growth challenges. Do you have any advice or frameworks that worked well for your portfolio?" }
]

const MENTOR_PROMPTS: PromptTemplate[] = [
  { id: "review_request", label: "Ready to Review", icon: <Compass className="h-3 w-3" />, text: "I've reviewed your initial profile. Could you share your most recent traction metrics?" },
  { id: "scheduling", label: "Schedule Sync", icon: <Clock className="h-3 w-3" />, text: "Let's schedule a 30-minute sync this week. What days work best for you?" },
  { id: "clarification", label: "Need Clarification", icon: <HelpCircle className="h-3 w-3" />, text: "Could you clarify the primary customer acquisition channel you are targeting?" }
]

const INVESTOR_PROMPTS: PromptTemplate[] = [
  { id: "data_room", label: "Request Data Room", icon: <Compass className="h-3 w-3" />, text: "Thanks for reaching out. Please share a link to your data room when you have a moment." },
  { id: "thesis_fit", label: "Thesis Fit", icon: <Sparkles className="h-3 w-3" />, text: "Your venture aligns with our current thesis. Let's set up a call to dive deeper into your tech stack." },
  { id: "pass", label: "Pass for Now", icon: <Trash2 className="h-3 w-3" />, text: "Thank you for sharing. We are going to pass at this stage, but please keep us updated on your next round." }
]

export function Messages() {
  const { user, role } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [activeContact, setActiveContact] = useState<Contact | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [isInCall, setIsInCall] = useState(false)
  const [unreadContactIds, setUnreadContactIds] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    fetchContacts()
  }, [user])

  useEffect(() => {
    setIsInCall(false)
  }, [activeContact])

  // Helper to re-order contact list so active sender/receiver is moved to the top
  const bumpContactToTop = (contactId: string) => {
    setContacts((prevContacts) => {
      const existingIdx = prevContacts.findIndex((c) => c.id === contactId)
      if (existingIdx <= 0) return prevContacts
      const targetContact = prevContacts[existingIdx]
      const remaining = prevContacts.filter((c) => c.id !== contactId)
      return [targetContact, ...remaining]
    })
  }

  // Load active messages
  useEffect(() => {
    if (!user || !activeContact) return
    fetchMessages()

    // Clear unread indicator for active contact
    setUnreadContactIds((prev) => {
      const next = new Set(prev)
      next.delete(activeContact.id)
      return next
    })
  }, [user, activeContact])

  // Global Realtime listener for incoming messages to manage ordering & live updates
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`global_messages_${user.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages'
      }, (payload) => {
        const newMsg = payload.new as Message
        const isSender = newMsg.sender_id === user.id
        const isReceiver = newMsg.receiver_id === user.id

        if (!isSender && !isReceiver) return

        const otherId = isSender ? newMsg.receiver_id : newMsg.sender_id
        bumpContactToTop(otherId)

        if (activeContact && otherId === activeContact.id) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          scrollToBottom()
        } else if (!isSender) {
          setUnreadContactIds((prev) => new Set(prev).add(otherId))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, activeContact])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const fetchContacts = async () => {
    if (!user) return
    setLoading(true)

    try {
      const { data: connections, error: connErr } = await supabase
        .from('connections')
        .select('founder_id, mentor_id, investor_id')
        .eq('status', 'accepted')
        .or(`founder_id.eq.${user.id},mentor_id.eq.${user.id},investor_id.eq.${user.id}`)

      if (connErr) console.error("Connections error:", connErr)

      const { data: deals, error: dealErr } = await supabase
        .from('deal_flow')
        .select('founder_id, investor_id')
        .eq('status', 'interested')
        .or(`founder_id.eq.${user.id},investor_id.eq.${user.id}`)

      if (dealErr) console.error("Deals error:", dealErr)

      const contactIds = new Set<string>()
      connections?.forEach(c => {
        if (c.founder_id && c.founder_id !== user.id) contactIds.add(c.founder_id)
        if (c.mentor_id && c.mentor_id !== user.id) contactIds.add(c.mentor_id)
        if (c.investor_id && c.investor_id !== user.id) contactIds.add(c.investor_id)
      })
      deals?.forEach(d => {
        if (d.founder_id && d.founder_id !== user.id) contactIds.add(d.founder_id)
        if (d.investor_id && d.investor_id !== user.id) contactIds.add(d.investor_id)
      })

      const idsArray = Array.from(contactIds)

      if (idsArray.length > 0) {
        const { data: usersData, error: usersErr } = await supabase
          .from('users')
          .select('id, full_name, role')
          .in('id', idsArray)

        if (usersErr) {
          console.error("Users error:", usersErr)
          setLoading(false)
          return
        }

        const [foundersRes, mentorsRes, investorsRes] = await Promise.all([
          supabase.from('founders').select('id, industry').in('id', idsArray),
          supabase.from('mentors').select('id, industry').in('id', idsArray),
          supabase.from('investors').select('id, firm_name').in('id', idsArray)
        ])

        const detailsMap = new Map<string, string>()
        foundersRes.data?.forEach(f => { if (f.industry) detailsMap.set(f.id, f.industry) })
        mentorsRes.data?.forEach(m => { if (m.industry) detailsMap.set(m.id, m.industry) })
        investorsRes.data?.forEach(i => { if (i.firm_name) detailsMap.set(i.id, i.firm_name) })

        if (usersData) {
          const formattedContacts = usersData.map(u => ({
            id: u.id,
            full_name: u.full_name || 'Anonymous User',
            role: (u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : 'User') as any,
            industry: detailsMap.get(u.id) || 'General'
          }))
          setContacts(formattedContacts)
        }
      } else {
        setContacts([])
      }
    } catch (err) {
      console.error("Fetch contacts error:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async () => {
    if (!user || !activeContact) return
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${activeContact.id}),and(sender_id.eq.${activeContact.id},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })

    if (error) {
      console.error("Fetch messages error:", error)
      return
    }

    if (data) {
      setMessages(data)
      scrollToBottom()
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !activeContact || !newMessage.trim()) return

    const msgText = newMessage.trim()
    setNewMessage("")

    bumpContactToTop(activeContact.id)

    const { data: insertedMsg, error } = await supabase
      .from('messages')
      .insert([{
        sender_id: user.id,
        receiver_id: activeContact.id,
        content: msgText,
      }])
      .select()
      .single()

    if (error) {
      toast.error("Failed to send message")
      fetchMessages()
    } else if (insertedMsg) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === insertedMsg.id)) return prev
        return [...prev, insertedMsg as Message]
      })
      scrollToBottom()
    }
  }

  const handleSelectContact = (contact: Contact) => {
    setActiveContact(contact)
    setUnreadContactIds((prev) => {
      const next = new Set(prev)
      next.delete(contact.id)
      return next
    })
  }

  const activePrompts = role === 'founder' ? FOUNDER_PROMPTS : role === 'mentor' ? MENTOR_PROMPTS : INVESTOR_PROMPTS

  return (
    <div className="flex h-[calc(100vh-6rem)] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      
      {/* Sidebar - Contacts List */}
      <div 
        className={`flex-col border-r border-zinc-200 dark:border-zinc-800 ${
          activeContact ? 'hidden md:flex md:w-80' : 'flex w-full md:w-80'
        }`}
      >
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="font-semibold text-lg">Messages</h2>
          <p className="text-xs text-zinc-500 mt-1">Your active connections and deals.</p>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-zinc-500">Loading contacts...</div>
          ) : contacts.length === 0 ? (
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-3">
                <Send className="h-5 w-5 text-zinc-400" />
              </div>
              <p className="text-sm text-zinc-500">No active conversations yet. Connect with mentors or investors to start chatting.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {contacts.map((contact) => {
                const hasUnread = unreadContactIds.has(contact.id)
                return (
                  <li key={contact.id}>
                    <button
                      onClick={() => handleSelectContact(contact)}
                      className={`w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900 ${activeContact?.id === contact.id ? 'bg-zinc-50 dark:bg-zinc-900' : ''}`}
                    >
                      <div className="relative">
                        <Avatar className="h-10 w-10 border dark:border-zinc-800">
                          <AvatarFallback className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                            {contact.full_name?.substring(0, 2).toUpperCase() || 'UN'}
                          </AvatarFallback>
                        </Avatar>
                        {hasUnread && (
                          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-indigo-600 ring-2 ring-white dark:ring-zinc-950" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`font-medium text-sm truncate ${hasUnread ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-zinc-900 dark:text-zinc-100'}`}>
                            {contact.full_name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal h-4">
                            {contact.role}
                          </Badge>
                          <span className="text-xs text-zinc-500 truncate">{contact.industry}</span>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div 
        className={`flex-col bg-zinc-50 dark:bg-zinc-900 ${
          !activeContact ? 'hidden md:flex md:flex-1' : 'flex flex-1 w-full'
        }`}
      >
        {activeContact ? (
          <>
            <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 md:px-6 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden -ml-2 mr-1" 
                  onClick={() => setActiveContact(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                
                <Avatar className="h-9 w-9 border dark:border-zinc-800">
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                    {activeContact.full_name?.substring(0, 2).toUpperCase() || 'UN'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium text-sm">{activeContact.full_name}</h3>
                  <p className="text-xs text-zinc-500 capitalize">{activeContact.role} • {activeContact.industry}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsInCall(true)}
                  title="Start Video Call"
                >
                  <Video className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                </Button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-60">
                  <Sparkles className="h-8 w-8 text-zinc-400" />
                  <p className="text-sm text-zinc-500 max-w-xs">This is the start of your secure conversation with {activeContact.full_name}.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${isMine ? 'bg-indigo-600 text-white rounded-br-none dark:bg-indigo-500' : 'bg-white rounded-bl-none dark:bg-zinc-800 border dark:border-zinc-700 shadow-sm'}`}>
                        {msg.content}
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-4 py-2 border-t border-zinc-200 bg-white/50 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/50">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {activePrompts.map((prompt) => (
                  <Button 
                    key={prompt.id} 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setNewMessage(prompt.text)} 
                    className="h-8 rounded-full text-xs shrink-0 bg-white dark:bg-zinc-900"
                  >
                    <span className="mr-1.5 text-zinc-500">{prompt.icon}</span>{prompt.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="p-4 bg-white border-t border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input 
                  value={newMessage} 
                  onChange={(e) => setNewMessage(e.target.value)} 
                  placeholder={`Message ${activeContact.full_name}...`} 
                  className="rounded-full bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 h-11 px-4 text-sm" 
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  disabled={!newMessage.trim()} 
                  className="rounded-full h-11 w-11 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="hidden md:flex h-full flex-col items-center justify-center text-zinc-500">
            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                <Send className="h-6 w-6 text-zinc-400" />
            </div>
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>

      {/* Video Call Modal Overlay */}
      {isInCall && activeContact && (
        <VideoCall 
          roomId={activeContact.id} 
          onEndCall={() => setIsInCall(false)} 
        />
      )}
    </div>
  )
}