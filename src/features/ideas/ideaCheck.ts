/**
 * Rule-based "Idea Check". It scores how COMPLETE and SPECIFIC an idea draft is.
 * It cannot judge whether a market wants the idea (only customers can), and the UI says so.
 *
 * It's a pure function with no network calls, so it works offline, costs nothing, and can be
 * swapped for an LLM-backed analysis later without touching the UI (same IdeaCheck shape).
 */

export type IdeaDraft = { problem: string; solution: string; market: string; techStack: string }

export type IdeaCheck = {
  hasContent: boolean
  /** 0-100: how complete and specific the draft is */
  score: number
  verdict: string
  strengths: string[]
  risks: string[]
  audience: string
  questions: string[]
  mvpSteps: string[]
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

const PAIN =
  /\b(struggl\w*|waste\w*|cost\w*|costly|slow|hard|difficult|expensive|lack\w*|unable|frustrat\w*|pain\w*|manual\w*|time[- ]consuming|miss\w*|lose|losing|risk\w*|confus\w*|unreliable)\b/i
const NUMBER = /(\d|%|\b(hours?|minutes?|days?|weeks?|per|every|daily|weekly|monthly)\b)/i
const DIFFERENT =
  /\b(unlike|instead of|compared|only|first|better than|faster|cheaper|simpler|without|alternative)\b/i
const BROAD = /\b(everyone|everybody|anyone|all people|all businesses|all users|general public|the world|any business)\b/i
const MONEY =
  /\b(subscription|commission|fee|fees|pricing|price|revenue|paid|pay|monetiz\w*|sell|sales|license|freemium|margin)\b/i
const BUZZ = /\b(ai|artificial intelligence|machine learning|blockchain|web3|metaverse)\b/i

export function checkIdea(d: IdeaDraft): IdeaCheck {
  const problem = d.problem.trim()
  const solution = d.solution.trim()
  const market = d.market.trim()
  const tech = d.techStack.trim()
  const hasContent = problem.length > 0 || solution.length > 0

  const strengths: string[] = []
  const risks: string[] = []
  let score = 0

  // Problem: 40 points
  const pw = words(problem)
  if (pw >= 40) score += 20
  else if (pw >= 15) score += 12
  else {
    score += pw > 0 ? 4 : 0
    risks.push(
      pw === 0
        ? "The problem statement is empty."
        : "The problem statement is very short. Say who has the problem, what it costs them and how often it happens."
    )
  }
  if (PAIN.test(problem)) {
    score += 10
    strengths.push("Names a concrete pain point.")
  } else if (pw > 0) {
    risks.push("The problem doesn't describe a clear pain: what goes wrong and what it costs.")
  }
  if (NUMBER.test(problem)) {
    score += 10
    strengths.push("Puts a number or a frequency on the problem.")
  } else if (pw > 0) {
    risks.push("The problem isn't quantified. Add how often it happens or what it costs.")
  }

  // Solution: 35 points
  const sw = words(solution)
  if (sw >= 40) score += 20
  else if (sw >= 15) score += 12
  else {
    score += sw > 0 ? 4 : 0
    risks.push(
      sw === 0
        ? "The solution is empty."
        : "The solution is very short. Explain what the product does and how it removes the pain."
    )
  }
  if (DIFFERENT.test(solution)) {
    score += 15
    strengths.push("States how it differs from what customers use today.")
  } else if (sw > 0) {
    risks.push("No stated difference from what customers already use today.")
  }

  // Market: 15 points
  const mw = words(market)
  if (mw === 0) {
    risks.push("No target market is given.")
  } else if (BROAD.test(market) || mw < 2) {
    score += 4
    risks.push("The target market is broad. Narrow it to one group you can reach personally.")
  } else {
    score += 15
    strengths.push("The target market is specific.")
  }

  // Money: 5 points, tech: 5 points
  const mentionsMoney = MONEY.test(`${problem} ${solution} ${market}`)
  if (mentionsMoney) {
    score += 5
    strengths.push("Mentions how it could earn money.")
  }
  if (tech) score += 5

  // Verdict
  let verdict: string
  if (!hasContent) verdict = "Fill in the Problem and Solution tabs to see feedback."
  else if (score >= 80) verdict = "Your draft is detailed and specific. The next step is testing it with real customers."
  else if (score >= 55) verdict = "A solid start. Closing the gaps below will make it much easier to validate."
  else if (score >= 30) verdict = "The idea is taking shape, but the draft needs more detail before it can be tested."
  else verdict = "Very early draft. Start with who has the problem and what it costs them."

  // Audience
  const shortMarket = market.length > 60 ? `${market.slice(0, 57)}...` : market
  let audience: string
  if (mw === 0) {
    audience = "Pick one specific group (a college, a city, a job role) as your first customers, then add it to the Market tab."
  } else if (BROAD.test(market) || mw < 2) {
    audience = `"${shortMarket}" is too wide to reach at the start. Choose one slice of it you can talk to this month, such as one college, city or role.`
  } else {
    audience = `Start with the narrowest slice of "${shortMarket}" you can reach personally, and talk to five of them before you build anything.`
  }

  // Questions to answer with real customers
  const questions = [
    "What do your target customers use today instead, and why would they switch?",
    "Who is the first person who would pay for this, and what did they last do about the problem?",
  ]
  if (!mentionsMoney) questions.push("How will this make money, and what would a customer pay?")
  if (BUZZ.test(solution)) questions.push("What does the AI or blockchain part do that a simpler approach couldn't?")

  const mvpSteps = [
    "Write your riskiest assumption as one sentence and add it to the Validation Lab as a hypothesis.",
    `Interview five people from ${market ? `"${shortMarket}"` : "your target group"}: ask what they do today and what it costs them.`,
    "Build the smallest test (a landing page, a form or a manual service) and measure one number, such as sign-ups or replies.",
  ]

  return {
    hasContent,
    score: Math.min(100, score),
    verdict,
    strengths: strengths.slice(0, 4),
    risks: risks.slice(0, 4),
    audience,
    questions: questions.slice(0, 4),
    mvpSteps,
  }
}
