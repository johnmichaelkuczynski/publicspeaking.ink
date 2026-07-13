import {
  db,
  speakingTopicsTable,
  speakingLecturesTable,
  speakingAssignmentsTable,
  speakingPromptsTable,
} from "@workspace/db";
import { logger } from "./logger";

interface TopicSeed {
  code: string;
  title: string;
  unitNumber: number;
  blurb: string;
  lectureTitle: string;
  body: string;
}

interface PromptSeed {
  mode: "spoken" | "written";
  prompt: string;
  targetSeconds?: number;
  rubric?: string;
  guidance?: string;
  topicCode?: string;
}

interface AssignmentSeed {
  kind: "homework" | "test" | "capstone";
  title: string;
  unitNumber: number;
  instructions: string;
  prompts: PromptSeed[];
}

const TOPICS: TopicSeed[] = [
  // ----- Unit 1 -----
  {
    code: "1.1",
    title: "Why public speaking matters — and why it scares us",
    unitNumber: 1,
    blurb: "What you gain from speaking well, and why fear is normal.",
    lectureTitle: "1.1 Why public speaking matters — and why it scares us",
    body: `# Why public speaking matters — and why it scares us

Public speaking is the act of organizing your thinking and delivering it to other people so that it changes what they know, feel, or do. It is one of the highest-leverage skills you can own: the same idea, spoken clearly and confidently, travels further than a brilliant idea mumbled at the floor.

## Why it feels terrifying

Fear of speaking is not a character flaw — it is wiring. Standing in front of a group triggers the same threat response our ancestors felt when exposed to a watching crowd. Your heart rate climbs, your mouth dries, your thoughts scatter. **This is your body preparing you, not betraying you.**

## The reframe

Skilled speakers are not fearless. They have simply learned to *channel* the adrenaline into energy and focus. Across this course you will build that skill deliberately: managing nerves, controlling your breath and voice, structuring a message, and delivering it with presence.

The goal is not perfection. It is to speak so that people actually listen — and to feel steady while you do it.`,
  },
  {
    code: "1.2",
    title: "Managing speaking anxiety",
    unitNumber: 1,
    blurb: "Concrete techniques to calm nerves before and during a talk.",
    lectureTitle: "1.2 Managing speaking anxiety",
    body: `# Managing speaking anxiety

Anxiety peaks in the minutes before you speak and in the first 30 seconds after you begin. If you can ride out that window, your nervous system settles on its own.

## Before you speak

- **Box breathing:** inhale four counts, hold four, exhale four, hold four. Three rounds lowers your heart rate.
- **Reframe the sensation:** the physical signs of fear and excitement are nearly identical. Tell yourself "I'm excited," not "I'm scared." Studies show this measurably improves performance.
- **Prepare an opening you can say on autopilot.** Certainty about your first two sentences buys your brain time to catch up.

## While you speak

- **Slow down.** Anxiety speeds you up; deliberately pacing yourself signals calm to your own body.
- **Find friendly faces.** Anchor your eye contact on people who are nodding.
- **Let pauses happen.** Silence feels longer to you than to the audience.

Anxiety never disappears entirely — and it shouldn't. A little keeps you sharp. The aim is to make it your engine, not your brakes.`,
  },
  {
    code: "1.3",
    title: "Breath, projection, and vocal warm-ups",
    unitNumber: 1,
    blurb: "Use breath as the foundation of a strong, steady voice.",
    lectureTitle: "1.3 Breath, projection, and vocal warm-ups",
    body: `# Breath, projection, and vocal warm-ups

Your voice runs on air. Shallow, chest-high breathing produces a thin, shaky voice; deep, low breathing produces a full, steady one.

## Breathe from the diaphragm

Put a hand on your stomach. When you inhale, your hand should move out, not your shoulders up. This **diaphragmatic breathing** gives you a reservoir of air to support sustained, controlled speech.

## Projection is support, not shouting

Projecting means sending your voice to the back of the room using breath support and open resonance — never by straining your throat. Imagine speaking *to* the far wall, not *at* the front row.

## A 2-minute warm-up

1. **Sigh** on a long "ahh" to release tension.
2. **Hum** up and down your range to wake up resonance.
3. **Lip trills** (a motorboat "brrr") to connect breath and sound.
4. **Tongue twisters** ("red leather, yellow leather") for crisp articulation.

Warming up before a talk is not optional polish — it is what lets your voice carry without cracking when the pressure hits.`,
  },
  {
    code: "1.4",
    title: "Posture, stance, and stage presence",
    unitNumber: 1,
    blurb: "How you stand shapes how you sound and how you're seen.",
    lectureTitle: "1.4 Posture, stance, and stage presence",
    body: `# Posture, stance, and stage presence

Before you say a word, your body has already spoken. Presence is the impression of being grounded, open, and in command of the space.

## The grounded stance

- Feet about shoulder-width apart, weight evenly balanced.
- Knees soft, not locked.
- Shoulders back and down, chest open so your breath can flow.
- Hands ready at your sides or gesturing — not in pockets, not gripping the podium.

This stance does double duty: it looks confident *and* it lets you breathe and project freely.

## Own the space

Presence grows when you stop shrinking. Plant yourself, take up room, and move with intention — step toward the audience to emphasize a point, not to pace nervously.

## Stillness is powerful

Constant swaying and fidgeting leak anxiety. Learning to stand still and calm, especially during a pause, reads as authority. Practice finding a "home base" stance you can return to between movements.`,
  },
  {
    code: "1.5",
    title: "Finding your authentic voice",
    unitNumber: 1,
    blurb: "Speak like yourself — only clearer and more intentional.",
    lectureTitle: "1.5 Finding your authentic voice",
    body: `# Finding your authentic voice

The most common piece of bad advice is to imitate a famous speaker. Audiences are remarkably good at detecting performance that isn't yours. **Authenticity is more persuasive than polish.**

## What authentic delivery means

It does not mean "unprepared" or "casual." It means your natural personality, conviction, and rhythm come through — amplified and organized, not replaced.

## How to find it

- **Talk, then write.** Say your idea out loud to a friend first; capture the phrasing that came naturally. That is your real voice on the page.
- **Speak from conviction.** Choose angles you actually believe. Genuine belief carries an energy no technique can fake.
- **Keep your quirks.** Your humor, your pauses, your way of building to a point — these make you memorable.

## Authentic, then refined

Authenticity is the foundation; technique is the refinement on top. As you learn breath, structure, and delivery, apply them in service of sounding *more* like you — never less.`,
  },
  {
    code: "1.6",
    title: "Knowing your audience",
    unitNumber: 1,
    blurb: "Analyze who you're speaking to before deciding what to say.",
    lectureTitle: "1.6 Knowing your audience (audience analysis)",
    body: `# Knowing your audience

A speech is not about you — it is about the change you create in the people listening. So the first question is never "What do I want to say?" but **"Who are they, and what do they need?"**

## Three things to map

1. **Knowledge:** What do they already know? Talking over people loses them; talking down to them insults them.
2. **Motivation:** Why are they here? What do they care about, fear, or want? Connect your message to their existing concerns.
3. **Disposition:** Are they friendly, neutral, or skeptical toward your idea? A skeptical room needs evidence and acknowledgment of objections; a friendly room needs energy and a call to action.

## Adapt, don't pander

Audience analysis is not about telling people what they want to hear. It is about choosing the framing, examples, and level of detail that will actually land *with these particular people*.

## The empathy habit

Before every talk, picture one real audience member and ask: "What would make this worth their time?" Build the speech to answer that.`,
  },
  {
    code: "1.7",
    title: "Setting a goal for every talk",
    unitNumber: 1,
    blurb: "Define the one change you want before you build the speech.",
    lectureTitle: "1.7 Setting a goal for every talk",
    body: `# Setting a goal for every talk

Every effective talk has a single, clear purpose. If you cannot state it in one sentence, your audience will not be able to either.

## The one-sentence goal

Finish this sentence before you write anything else:

> "After this talk, my audience will **\\_\\_\\_**."

Will they *know* a fact, *feel* a certain way, or *do* something specific? Naming the verb — know, feel, do — focuses every later choice.

## Why it matters

- It tells you what to cut. Anything that doesn't serve the goal is noise.
- It gives the talk a destination, so the structure has somewhere to go.
- It lets you measure success: did they actually leave knowing, feeling, or doing that?

## One goal, not five

The temptation is to cram in everything you know. Resist it. A talk that tries to do five things does none of them. **Pick one change and drive it home.**`,
  },

  // ----- Unit 2 -----
  {
    code: "2.1",
    title: "The anatomy of a speech: open, body, close",
    unitNumber: 2,
    blurb: "The reliable three-part skeleton every talk can hang on.",
    lectureTitle: "2.1 The anatomy of a speech: open, body, close",
    body: `# The anatomy of a speech: open, body, close

Almost every effective talk shares the same skeleton. Master it and you will never again stare at a blank page.

## The three parts

1. **Opening (≈10%):** Earn attention and signal where you're going. Hook them, then preview your point.
2. **Body (≈80%):** Deliver the substance in a few clear chunks — usually two to four main points, each with support.
3. **Closing (≈10%):** Land the message. Reinforce the core idea and end with something memorable or a call to action.

## The classic advice

"Tell them what you're going to tell them, tell them, then tell them what you told them." It sounds repetitive on paper, but listeners — unlike readers — cannot scroll back. **Strategic repetition is how speech compensates for being heard once.**

## Build the body first

Counterintuitively, draft your main points before your opening. You can't hook someone toward a destination you haven't chosen yet.`,
  },
  {
    code: "2.2",
    title: "Openings that hook",
    unitNumber: 2,
    blurb: "Win the first thirty seconds or lose the room.",
    lectureTitle: "2.2 Openings that hook",
    body: `# Openings that hook

The audience decides within seconds whether to lean in or check out. A weak opening — "Um, so today I'm going to talk about..." — wastes your most valuable moment.

## Hooks that work

- **A vivid story or scene:** drop the listener into a moment.
- **A surprising fact or statistic:** disrupt their assumptions.
- **A provocative question:** make them answer in their heads.
- **A bold claim:** stake a position they'll want to test.

## Then orient them

After the hook, give a quick sense of where you're headed so curiosity doesn't curdle into confusion. One sentence of preview is usually enough.

## What to avoid

- Apologizing ("I'm not really prepared...").
- Throat-clearing throat-clearers ("Before I begin...").
- Reciting your own bio when no one asked.

Write your opening last, but rehearse it most. The first thirty seconds set the audience's expectation for everything that follows.`,
  },
  {
    code: "2.3",
    title: "Building a clear throughline",
    unitNumber: 2,
    blurb: "One central idea that every part of the talk serves.",
    lectureTitle: "2.3 Building a clear throughline",
    body: `# Building a clear throughline

A **throughline** is the single connecting idea that runs through your entire talk — the thread that ties every point back to one core message.

## Why it matters

Audiences remember structure, not sentences. If your points feel like a random list, they evaporate. If they all visibly serve one idea, the talk becomes coherent and memorable.

## Find yours

Ask: "If the audience forgets everything except one sentence, what should it be?" That sentence is your throughline. Every main point should be a pillar holding it up.

## Test each point

For every chunk of your talk, ask: *Does this advance the throughline?* If not, cut it or rework it. This is the discipline that separates a tight talk from a rambling one.

## Signal it

State your throughline early, return to it at each transition, and restate it at the close. The audience should be able to feel the thread even as the examples change.`,
  },
  {
    code: "2.4",
    title: "Evidence, examples, and data",
    unitNumber: 2,
    blurb: "Make claims believable with the right support.",
    lectureTitle: "2.4 Evidence, examples, and data",
    body: `# Evidence, examples, and data

A claim without support is just an opinion said loudly. Evidence is what turns "trust me" into "here's why."

## Types of support

- **Examples:** concrete instances that make an abstraction real.
- **Data:** numbers that show scale, trend, or proportion.
- **Expert testimony:** credible voices that back your point.
- **Analogy:** connecting the unfamiliar to something the audience already understands.

## Use data humanely

Numbers persuade only when the audience can feel them. "Five million" is abstract; "enough people to fill this stadium sixty times" is vivid. Translate statistics into human scale.

## One strong example beats five weak ones

Listeners can't absorb a flood of evidence. Choose the most vivid, relevant support and develop it fully rather than rattling off a list.

## Cite, briefly

A quick source ("a 2023 Stanford study found...") builds credibility without bogging you down. Honesty about where your evidence comes from is part of speaking ethically.`,
  },
  {
    code: "2.5",
    title: "Storytelling for speakers",
    unitNumber: 2,
    blurb: "Use narrative to make ideas stick and feelings move.",
    lectureTitle: "2.5 Storytelling for speakers",
    body: `# Storytelling for speakers

Humans are wired for story. We forget bullet points but remember a tense, well-told moment for years. Story is the most powerful delivery vehicle a speaker has.

## The basic shape

A story needs a **character** the audience cares about, a **challenge or tension**, and a **resolution** that carries your point. Without tension, it's just a sequence of events.

## Make it sensory

Specific, concrete details — a sound, a smell, a line of dialogue — pull the audience into the scene. "It was hard" tells; "my hands were shaking as I opened the email" shows.

## Tie it to the message

A story for its own sake is a digression. End by connecting it explicitly to your throughline: "And that's why..." The story earns the emotion; the link earns the meaning.

## Keep it tight

A speech story is not a novel. Cut every detail that doesn't build tension or serve the point. Rehearse it until the timing of the turn lands cleanly.`,
  },
  {
    code: "2.6",
    title: "Transitions and signposting",
    unitNumber: 2,
    blurb: "Guide listeners between ideas so no one gets lost.",
    lectureTitle: "2.6 Transitions and signposting",
    body: `# Transitions and signposting

Readers have paragraphs and headings; listeners have only your voice. **Transitions and signposts** are the verbal cues that tell the audience where they are in your talk.

## Signposting

Phrases like "There are three reasons...", "First...", "Now that we've seen the problem, let's look at the solution" act as road signs. They let the audience track your structure without effort.

## Transitions

A good transition does two things: it closes one idea and opens the next. "So fear is natural — but it's also manageable, which brings us to technique." The bridge keeps momentum and shows the logical link.

## Why this matters

Without signposts, even strong content feels like a blur. With them, the audience always knows the shape of where they are — and a clear shape is what makes a talk feel confident and easy to follow.

## Don't overdo it

Signpost the major joints of the talk, not every sentence. The goal is clarity, not a numbered checklist read aloud.`,
  },
  {
    code: "2.7",
    title: "Closings that stick",
    unitNumber: 2,
    blurb: "End with intention so your message outlasts the applause.",
    lectureTitle: "2.7 Closings that stick",
    body: `# Closings that stick

The ending is the last thing the audience hears and the first thing they remember. A talk that fizzles out — "Yeah, so... that's it, I guess" — throws away its most powerful moment.

## Elements of a strong close

- **Reinforce the throughline:** restate your core idea in fresh words.
- **Signal the end:** "Let me leave you with this..." prepares the audience to listen hard.
- **Deliver a memorable final line:** a call to action, a callback to your opening, a vivid image, or a challenge.

## The callback

Returning to the story or image you opened with creates a satisfying sense of completion — the talk feels designed, not assembled.

## Stick the landing

Rehearse your final sentence until you can deliver it cleanly, then *stop*. Resist the urge to add "um, yeah" afterward. End on the line, hold a beat, and let the silence do the work.`,
  },

  // ----- Unit 3 -----
  {
    code: "3.1",
    title: "Pace and the power of the pause",
    unitNumber: 3,
    blurb: "Control speed and silence to command attention.",
    lectureTitle: "3.1 Pace and the power of the pause",
    body: `# Pace and the power of the pause

How fast you speak — and when you stop — shapes how much the audience absorbs and how confident you seem.

## Find the right pace

Nervous speakers rush; conversational delivery usually lands around **110–160 words per minute**. Faster than that and meaning blurs; much slower and energy drains. The fix for rushing is not "talk slowly" but "breathe and pause."

## The pause is your most underused tool

A deliberate pause:

- **Emphasizes** the point right before or after it.
- **Gives the audience time** to absorb a big idea.
- **Signals confidence** — only someone in control is comfortable with silence.
- **Replaces filler.** The space where "um" would go becomes a powerful beat instead.

## Vary it

Monotone pacing is hypnotic in the bad way. Speed up through familiar setup, slow down for your key points, and pause before a punchline. **Silence, used on purpose, is the opposite of dead air — it's spotlight.**`,
  },
  {
    code: "3.2",
    title: "Vocal variety: pitch, volume, emphasis",
    unitNumber: 3,
    blurb: "Use the full range of your voice to keep listeners engaged.",
    lectureTitle: "3.2 Vocal variety: pitch, volume, emphasis",
    body: `# Vocal variety: pitch, volume, emphasis

A monotone voice flattens even great content. **Vocal variety** — changing pitch, volume, and emphasis — is what keeps an audience awake and signals what matters.

## The three levers

- **Pitch:** the highness or lowness of your voice. Letting it rise and fall conveys emotion and prevents drone. Rising pitch can signal a question or excitement; lower pitch conveys gravity.
- **Volume:** getting louder adds energy and urgency; dropping to near-whisper can draw the audience in and make them lean forward.
- **Emphasis:** stressing key words tells the audience what's important. "*I* never said she took the money" means something different from "I never said she took *the money*."

## Match sound to meaning

Vocal variety isn't random theatrics — it should track the content. Let your voice do what the words mean: soften for tenderness, sharpen for conviction, slow for weight.

## Practice out loud

You cannot develop variety silently. Record yourself, listen for flat stretches, and exaggerate in rehearsal — it will sound natural at performance.`,
  },
  {
    code: "3.3",
    title: "Eliminating filler words",
    unitNumber: 3,
    blurb: "Replace um, uh, and like with confident silence.",
    lectureTitle: "3.3 Eliminating filler words",
    body: `# Eliminating filler words

"Um," "uh," "like," "you know," "so" — fillers are the sounds we make while our mouth waits for our brain. A few are human; a steady stream erodes authority and distracts listeners.

## Why we use them

Fillers fill silence. When we fear a pause, we plug it with noise. The cure, therefore, is to **make peace with the pause.**

## How to cut them

1. **Embrace silence.** Train yourself to pause — silently — where a filler would go. The audience hears poise, not a gap.
2. **Slow down.** Fillers spike when you outrun your own thinking. A calmer pace gives your brain time to find the next word.
3. **Record and count.** Awareness is most of the battle. Listen back, tally your fillers, and watch the number drop as you notice them.
4. **End sentences cleanly.** Many fillers live in the seam between sentences. Finish a thought, stop, breathe, begin.

You will never hit zero, and you don't need to. The goal is for fillers to fade into the background instead of running the show.`,
  },
  {
    code: "3.4",
    title: "Body language and gesture",
    unitNumber: 3,
    blurb: "Let your hands and movement reinforce your words.",
    lectureTitle: "3.4 Body language and gesture",
    body: `# Body language and gesture

Your body is part of your message. Gestures and movement, used well, reinforce meaning and burn off nervous energy; used poorly, they distract.

## Purposeful gesture

The best gestures are **illustrative** — they show what the words describe. Sketch a size, count on your fingers, push away an idea you're rejecting. Avoid the repetitive nervous gesture (the constant chop, the wringing hands) that adds nothing.

## Open and visible

Keep your hands in the "strike zone" between your waist and chest where the audience can see them. Open palms read as honest and welcoming; crossed arms and pockets read as closed off.

## Move with intention

Walking can mark a transition or close distance for emphasis. Aimless pacing just leaks anxiety. Move deliberately, then plant and be still.

## Let it be natural

Don't choreograph every gesture — that looks robotic. Instead, free your hands by getting them out of your pockets and off the podium, and let genuine conviction drive natural movement.`,
  },
  {
    code: "3.5",
    title: "Eye contact and connection",
    unitNumber: 3,
    blurb: "Turn a presentation into a conversation with the room.",
    lectureTitle: "3.5 Eye contact and connection",
    body: `# Eye contact and connection

Eye contact is the single fastest way to turn a monologue into a connection. It tells each listener "I'm talking to *you*," and it gives you real-time feedback on whether you're landing.

## How to do it

- **One thought, one person.** Hold a gaze for a full sentence or idea, then move to someone else. Darting eyes look anxious.
- **Cover the room.** Include the sides and back, not just the friendly center.
- **Use it to read the room.** Confused faces mean slow down or clarify; nods mean push on.

## When you're nervous

If direct eye contact feels overwhelming, look at foreheads or just over people's heads to start — but build toward genuine contact, because that's where connection lives.

## On camera

Speaking to a webcam, "eye contact" means looking *into the lens*, not at the faces on your screen. It feels unnatural but reads as direct and present to your viewers.

Connection is the goal; eye contact is the mechanism. Speak *with* the audience, not *at* them.`,
  },
  {
    code: "3.6",
    title: "Handling Q&A and the unexpected",
    unitNumber: 3,
    blurb: "Stay composed when the script ends and questions begin.",
    lectureTitle: "3.6 Handling Q&A and the unexpected",
    body: `# Handling Q&A and the unexpected

The unscripted moments — questions, tech failures, a lost train of thought — are where composure shows. Audiences forgive almost anything if you stay calm.

## Fielding questions

- **Listen fully** before answering; don't interrupt.
- **Repeat or paraphrase** the question so everyone hears it and you confirm you understood.
- **Pause to think.** A two-second silence before answering reads as thoughtful, not stumped.
- **It's fine to say "I don't know."** Offer to follow up rather than bluffing — bluffing destroys credibility.

## Hostile or off-topic questions

Acknowledge the point, answer the part you can, and steer back to your message. You don't have to win an argument; you have to stay gracious and in control.

## When things go wrong

If you lose your place, pause, breathe, and glance at your notes — the audience barely notices. If tech fails, narrate calmly and keep going. **Your steadiness is more persuasive than any slide.**`,
  },
  {
    code: "3.7",
    title: "Rehearsal that works",
    unitNumber: 3,
    blurb: "Practice methods that actually build fluency and calm.",
    lectureTitle: "3.7 Rehearsal that works",
    body: `# Rehearsal that works

Talent is rarely the difference between a smooth talk and a shaky one — rehearsal is. But *how* you practice matters as much as how much.

## Practice out loud, on your feet

Reading silently is not rehearsal. Stand, speak at full volume, and use your gestures. You are training your body and voice, not just your memory.

## Don't memorize word-for-word

Memorizing a script makes you brittle — one forgotten line and you're lost. Instead, **internalize the structure and key phrases**, then speak it slightly differently each time. This keeps you flexible and natural.

## Simulate the real thing

Rehearse with a timer, in front of a friend or a camera, in conditions close to the real event. Watching a recording is uncomfortable but the fastest way to catch fillers, pacing, and habits.

## Iterate deliberately

After each run, pick one thing to improve — fewer fillers, a stronger close, slower pace — and focus the next run on that. **Targeted repetition beats mindless repetition.**`,
  },

  // ----- Unit 4 -----
  {
    code: "4.1",
    title: "Ethos, pathos, logos",
    unitNumber: 4,
    blurb: "The three classical appeals at the heart of persuasion.",
    lectureTitle: "4.1 Ethos, pathos, logos",
    body: `# Ethos, pathos, logos

Over two thousand years ago Aristotle named the three ways a speaker persuades. They still describe every convincing talk today.

## The three appeals

- **Ethos (credibility):** Why should they trust *you*? Built through expertise, honesty, preparation, and goodwill toward the audience.
- **Pathos (emotion):** What should they *feel*? Built through story, vivid language, and connecting to the audience's values and stakes.
- **Logos (logic):** Why does it make *sense*? Built through clear reasoning, evidence, and sound structure.

## Use all three

A talk that leans only on logic is dry; only on emotion, manipulative; only on credentials, hollow. **The most persuasive speeches braid all three** — a trustworthy speaker, making a reasoned case, that the audience feels in their gut.

## Balance for the room

A skeptical, analytical audience may need more logos; a disengaged one may need more pathos to care at all. Read the room and adjust the mix.`,
  },
  {
    code: "4.2",
    title: "Speaking to persuade",
    unitNumber: 4,
    blurb: "Move an audience from belief to action.",
    lectureTitle: "4.2 Speaking to persuade",
    body: `# Speaking to persuade

Persuasion asks the audience to change a belief or take an action. That's a higher bar than informing, and it requires meeting people where they are.

## Start from their position

People don't adopt new views because you proved them wrong; they adopt them when the new view feels like *their* idea. Acknowledge their current beliefs and concerns honestly before offering yours.

## Address objections

A persuasive talk anticipates the strongest counterargument and answers it. Ignoring obvious objections makes the audience distrust you; naming and addressing them builds credibility.

## Make the action concrete

"We should care about this" rarely changes behavior. "Here is the one specific thing I'm asking you to do this week" does. The clearer and smaller the ask, the more likely they act.

## End on the stakes

Close by reconnecting to *why it matters* — the benefit of acting or the cost of not. Persuasion lives in the gap between the world as it is and the world as it could be.`,
  },
  {
    code: "4.3",
    title: "Speaking to inform and explain",
    unitNumber: 4,
    blurb: "Make complex ideas clear without dumbing them down.",
    lectureTitle: "4.3 Speaking to inform and explain",
    body: `# Speaking to inform and explain

The informative speech teaches. Success is measured by one thing: did the audience actually understand?

## Start where they are

Connect the new idea to something the audience already knows. Analogy is the bridge: "DNA is like a recipe book the cell reads from." Begin familiar, then extend into the unfamiliar.

## Chunk and sequence

Break the topic into a few digestible parts and order them logically — simple to complex, or step by step. Trying to convey everything at once guarantees nothing lands.

## Fight the curse of knowledge

Once you understand something, it's hard to remember what confusion felt like. Define jargon, slow down on hard parts, and check for the glazed-over look. **What's obvious to you is new to them.**

## Show, don't just tell

Examples, demonstrations, and visuals make abstractions concrete. One clear example often teaches more than three paragraphs of definition.

End by summarizing the key takeaways so the structure is reinforced one last time.`,
  },
  {
    code: "4.4",
    title: "Adapting to the occasion and format",
    unitNumber: 4,
    blurb: "Tailor your speaking to the setting, time, and medium.",
    lectureTitle: "4.4 Adapting to the occasion and format",
    body: `# Adapting to the occasion and format

The same message must be delivered differently at a wedding toast, a job interview, a conference keynote, and a video call. Skilled speakers read the occasion and adapt.

## Match tone to setting

A celebration wants warmth and brevity; a business pitch wants clarity and confidence; a eulogy wants sincerity and calm. Misreading the tone is more damaging than any small stumble.

## Respect the time

The length expected at a toast (one minute) is not the length expected at a keynote (twenty). Going long is one of the most common and least forgivable speaking mistakes. **Prepare to your time limit, and rehearse with a clock.**

## Adapt to the medium

- **In person:** use the whole room, full gestures, eye contact across the audience.
- **On video:** look at the lens, keep gestures in frame, and expect lower energy to read as flat — so dial it up.
- **With a microphone:** let the mic do the work; project less, articulate more.

Every format has its own rules. Learning them is part of speaking well anywhere.`,
  },
  {
    code: "4.5",
    title: "Impromptu speaking",
    unitNumber: 4,
    blurb: "Sound organized even when you had no time to prepare.",
    lectureTitle: "4.5 Impromptu speaking",
    body: `# Impromptu speaking

Often you'll have to speak with no warning — a meeting question, a toast, a "say a few words." Impromptu skill is just structure applied fast.

## Buy a moment

Repeat or rephrase the question, or simply pause and breathe. A two-second silence to gather your thought is invisible to the audience and invaluable to you.

## Use a quick framework

Reach for a simple structure so you're not improvising form *and* content:

- **PREP:** Point, Reason, Example, Point again.
- **Past–Present–Future:** how it was, how it is, where it's going.
- **Three reasons:** "There are a few things to consider. First... second... finally..."

Any skeleton beats rambling.

## Make one point well

The impromptu trap is trying to say everything. Pick a single clear point, support it with one example, and stop. **A short, focused answer beats a long, scattered one.**

## Land and stop

Finish with a clean closing line and resist the urge to keep talking. Brevity reads as confidence.`,
  },
  {
    code: "4.6",
    title: "Using slides and visual aids well",
    unitNumber: 4,
    blurb: "Make visuals support you instead of replacing you.",
    lectureTitle: "4.6 Using slides and visual aids well",
    body: `# Using slides and visual aids well

Visual aids can clarify or sabotage. The rule: **you are the presentation; slides are support.** If a slide could replace you, you don't need to be there.

## Design for the eye, not the reader

- **Minimal text.** No paragraphs. Keywords, not scripts. The audience can read or listen, not both.
- **One idea per slide.** Crowded slides overwhelm.
- **Strong visuals.** A single powerful image or simple chart beats a wall of bullets.

## Don't read your slides

Reading text aloud while it's on screen is the fastest way to lose a room. Slides should show; you explain. They are the illustration, you are the story.

## Manage attention

When a slide appears, the audience reads it — so pause and let them, then bring focus back to you. Use a blank or black slide when you want all attention on what you're saying.

## Always have a backup

Tech fails. Know your talk well enough to deliver it if the screen dies. The strongest speakers could give the whole thing with no slides at all.`,
  },
  {
    code: "4.7",
    title: "Putting it all together: the full speech",
    unitNumber: 4,
    blurb: "Integrate structure, delivery, and persuasion into one talk.",
    lectureTitle: "4.7 Putting it all together: the full speech",
    body: `# Putting it all together: the full speech

By now you've built the pieces — managing nerves, breath and voice, structure, delivery, and persuasion. A full speech is where they fuse into one performance.

## The integration checklist

- **Goal:** one clear purpose driving everything.
- **Structure:** a hook, a throughline, two to four supported points, a sticky close.
- **Support:** vivid examples, honest evidence, at least one story.
- **Delivery:** varied pace with deliberate pauses, vocal variety, minimal fillers, genuine eye contact, purposeful gesture.
- **Adaptation:** tuned to this audience, occasion, and time limit.

## Rehearse the whole

Practicing parts isn't enough — run the entire speech, on your feet, on the clock, ideally recorded. Smooth the transitions between sections, where talks most often wobble.

## Prepare to be present

The paradox of preparation: you rehearse thoroughly so that on the day you can let go of the script and be *with* the audience. Deep preparation is what frees you to be natural.

This is the work of your capstone — one complete, integrated speech that shows everything you've learned.`,
  },
  {
    code: "4.8",
    title: "Capstone speech",
    unitNumber: 4,
    blurb: "Your final, complete speech bringing the whole course together.",
    lectureTitle: "4.8 Capstone speech",
    body: `# Capstone speech

The capstone is your chance to deliver one complete, polished speech that demonstrates the full arc of this course.

## The assignment

Prepare and deliver a **2.5–3 minute speech** on a topic you genuinely care about. It can inform or persuade — your choice — but it must have a clear goal, a real structure, and deliberate delivery.

## What success looks like

- **A hook** that earns attention in the first fifteen seconds.
- **A clear throughline** the audience could repeat back.
- **Two or three supported points**, including at least one concrete example or story.
- **Controlled delivery:** measured pace, intentional pauses, vocal variety, few fillers.
- **A closing** that lands the message and ends cleanly.

## How to approach it

Choose your topic early. Draft the body first, then the open and close. Rehearse out loud, on your feet, on the clock — and record yourself at least once. Refine one weakness per run.

This is not a test of perfection. It's a demonstration of how far your speaking has come. Step up to the mic and show it.`,
  },
];

const ASSIGNMENTS: AssignmentSeed[] = [
  {
    kind: "homework",
    title: "Unit 1 Homework — Step up to the mic",
    unitNumber: 1,
    instructions:
      "Your first spoken assignment plus a short written audience analysis. Speak naturally — this is about showing up and being yourself, not being perfect.",
    prompts: [
      {
        mode: "spoken",
        prompt:
          "Record a 60-second self-introduction. Tell us who you are, one thing you genuinely care about, and what you hope to get better at as a speaker. Focus on speaking calmly and being yourself.",
        targetSeconds: 60,
        topicCode: "1.5",
        rubric:
          "Reward authenticity, a calm and audible voice, and a clear simple structure (who you are, what you care about, your goal). Don't penalize minor nerves.",
        guidance:
          "Breathe before you start. Aim for a steady pace and let yourself pause instead of rushing.",
      },
      {
        mode: "written",
        prompt:
          "Pick a talk you might give soon (a class presentation, a toast, a pitch). In a short paragraph, analyze your audience: What do they already know? What do they care about? Are they friendly, neutral, or skeptical — and how would that change what you say?",
        topicCode: "1.6",
        rubric:
          "Reward specific, concrete analysis of knowledge, motivation, and disposition, and a clear link from that analysis to a speaking choice.",
      },
    ],
  },
  {
    kind: "test",
    title: "Unit 1 Test — Presence under pressure",
    unitNumber: 1,
    instructions:
      "One graded spoken response. Show that you can stand grounded and speak with a steady, confident presence.",
    prompts: [
      {
        mode: "spoken",
        prompt:
          "Record a 90-second talk explaining something you love and why. Stand up if you can. The focus of this test is presence and composure: grounded posture, steady breath, calm pace, and a warm connection to your listener.",
        targetSeconds: 90,
        topicCode: "1.4",
        rubric:
          "Score content on clarity and a simple arc; score delivery on calm pacing, audible projection, minimal rushing, and steady presence.",
        guidance:
          "Plant your feet, open your chest so you can breathe, and resist the urge to speed up.",
      },
    ],
  },
  {
    kind: "homework",
    title: "Unit 2 Homework — Build the skeleton",
    unitNumber: 2,
    instructions:
      "Practice structuring a message: a strong opening, then a short talk with a clear throughline.",
    prompts: [
      {
        mode: "spoken",
        prompt:
          "Record just an opening — about 30 seconds — that hooks the audience for a talk on any topic you choose. Use a story, a surprising fact, a question, or a bold claim, then preview where you're going.",
        targetSeconds: 35,
        topicCode: "2.2",
        rubric:
          "Reward an attention-earning hook in the first sentences and a quick orienting preview. Penalize apologizing or throat-clearing openings.",
        guidance: "Write the hook last but rehearse it most. Avoid 'Um, today I'll talk about...'.",
      },
      {
        mode: "spoken",
        prompt:
          "Record a 90-second mini-speech with a clear open, body, and close on a topic you care about. Make sure one central idea (your throughline) runs through the whole thing.",
        targetSeconds: 90,
        topicCode: "2.3",
        rubric:
          "Score content on a visible three-part structure and a single clear throughline every point serves; score delivery on pace and clarity.",
      },
    ],
  },
  {
    kind: "test",
    title: "Unit 2 Test — A structured message",
    unitNumber: 2,
    instructions:
      "One graded spoken response demonstrating full structure, support, and a sticky close.",
    prompts: [
      {
        mode: "spoken",
        prompt:
          "Record a 2-minute speech that argues for one idea you believe. Open with a hook, make two or three points with at least one concrete example or short story, use transitions between them, and finish with a memorable closing line.",
        targetSeconds: 120,
        topicCode: "2.7",
        rubric:
          "Score content on hook, throughline, supported points, clear transitions, and a strong close; score delivery on pace, pauses, and clarity.",
        guidance: "Draft the body first, then the open and close. Rehearse the final line until you can stop clean.",
      },
    ],
  },
  {
    kind: "homework",
    title: "Unit 3 Homework — Delivery lab",
    unitNumber: 3,
    instructions:
      "Focus on how you say it: pace and pauses in a spoken drill, plus a written reflection on your rehearsal process.",
    prompts: [
      {
        mode: "spoken",
        prompt:
          "Record a 75-second talk on any topic, focusing entirely on pace and the pause. Deliberately slow down, and use at least two intentional pauses to emphasize key points instead of filling the silence.",
        targetSeconds: 75,
        topicCode: "3.1",
        rubric:
          "Reward a controlled, unhurried pace (roughly 110-160 wpm), deliberate pauses around key points, and low filler usage. Score content lightly.",
        guidance: "Where you'd normally say 'um', pause silently instead. Let the silence work.",
      },
      {
        mode: "written",
        prompt:
          "Describe how you rehearsed for your recordings so far. Did you practice out loud and on your feet? Did you record yourself? What is one specific habit (fillers, pace, eye contact) you want to target next, and how will you practice it?",
        topicCode: "3.7",
        rubric:
          "Reward honest, specific reflection on rehearsal method and a concrete, targeted plan for one improvement.",
      },
    ],
  },
  {
    kind: "test",
    title: "Unit 3 Test — Command of delivery",
    unitNumber: 3,
    instructions:
      "One graded spoken response judged primarily on delivery: pace, vocal variety, and minimal fillers.",
    prompts: [
      {
        mode: "spoken",
        prompt:
          "Record a 2-minute speech on a topic of your choice, demonstrating strong delivery: varied pace and pitch, deliberate pauses, vocal emphasis on key words, and as few filler words as you can manage.",
        targetSeconds: 120,
        topicCode: "3.2",
        rubric:
          "Weight delivery heavily: vocal variety, controlled pace, purposeful pauses, low filler rate, and emphasis on key words. Score content on basic clarity and structure.",
        guidance: "Let your voice do what the words mean. Soften, sharpen, slow down for weight.",
      },
    ],
  },
  {
    kind: "homework",
    title: "Unit 4 Homework — Persuade and improvise",
    unitNumber: 4,
    instructions:
      "Two spoken drills: a prepared persuasive pitch and a true impromptu response.",
    prompts: [
      {
        mode: "spoken",
        prompt:
          "Record a 90-second persuasive pitch asking your audience to take one specific action. Use all three appeals: establish your credibility (ethos), connect to their values or emotions (pathos), and give a clear reason or evidence (logos). End with a concrete ask.",
        targetSeconds: 90,
        topicCode: "4.2",
        rubric:
          "Reward a clear persuasive goal, visible use of ethos, pathos, and logos, handling of at least an implied objection, and a concrete call to action.",
      },
      {
        mode: "spoken",
        prompt:
          "Impromptu: without writing a script, hit record and speak for about 60 seconds answering 'What is something you changed your mind about, and why?' Use a quick framework (Point, Reason, Example, Point) to stay organized.",
        targetSeconds: 60,
        topicCode: "4.5",
        rubric:
          "Reward organized impromptu structure (a clear point with one example), composure, and a clean ending. Be lenient on polish; reward focus over rambling.",
        guidance: "Pause and breathe before you start. Make one point well rather than saying everything.",
      },
    ],
  },
  {
    kind: "test",
    title: "Unit 4 Test — The persuasive speech",
    unitNumber: 4,
    instructions:
      "One graded persuasive speech integrating structure, support, delivery, and the three appeals.",
    prompts: [
      {
        mode: "spoken",
        prompt:
          "Record a 2-minute persuasive speech on an issue you care about. Open with a hook, build a reasoned case with evidence and at least one story, address the strongest counterargument, and close with a clear call to action. Deliver it with controlled pace and vocal variety.",
        targetSeconds: 120,
        topicCode: "4.1",
        rubric:
          "Score content on persuasive structure, balanced ethos/pathos/logos, evidence, and handling an objection; score delivery on pace, variety, pauses, and low fillers.",
        guidance: "Meet the audience where they are before asking them to move.",
      },
    ],
  },
  {
    kind: "capstone",
    title: "Capstone — Your complete speech",
    unitNumber: 4,
    instructions:
      "The final assignment: one complete, polished speech that brings together everything from the course.",
    prompts: [
      {
        mode: "spoken",
        prompt:
          "Record a 2.5–3 minute speech on a topic you genuinely care about. It can inform or persuade. Bring everything together: a hook that earns attention, a clear throughline, two or three supported points with at least one concrete example or story, controlled delivery (measured pace, intentional pauses, vocal variety, few fillers), and a closing that lands the message cleanly.",
        targetSeconds: 165,
        topicCode: "4.8",
        rubric:
          "Hold this to the highest standard of the course. Score content on goal, hook, throughline, supported points, story, and close; score delivery on pace, pauses, vocal variety, filler control, and overall presence. Give specific, encouraging, actionable feedback.",
        guidance:
          "Choose your topic early, draft the body first, rehearse out loud on the clock, and record at least one practice run before submitting.",
      },
    ],
  },
];

export async function seedSpeakingIfEmpty(): Promise<void> {
  const existing = await db
    .select({ id: speakingTopicsTable.id })
    .from(speakingTopicsTable)
    .limit(1);
  if (existing.length > 0) return;

  logger.info("Seeding speaking course content");

  const topicIdByCode = new Map<string, number>();

  for (let i = 0; i < TOPICS.length; i += 1) {
    const t = TOPICS[i]!;
    const [topic] = await db
      .insert(speakingTopicsTable)
      .values({
        code: t.code,
        title: t.title,
        unitNumber: t.unitNumber,
        blurb: t.blurb,
        position: i,
      })
      .returning();
    topicIdByCode.set(t.code, topic!.id);

    await db.insert(speakingLecturesTable).values({
      topicId: topic!.id,
      unitNumber: t.unitNumber,
      code: t.code,
      title: t.lectureTitle,
      body: t.body,
      position: i,
    });
  }

  for (let i = 0; i < ASSIGNMENTS.length; i += 1) {
    const a = ASSIGNMENTS[i]!;
    const [assignment] = await db
      .insert(speakingAssignmentsTable)
      .values({
        kind: a.kind,
        title: a.title,
        unitNumber: a.unitNumber,
        position: i,
        instructions: a.instructions,
      })
      .returning();

    for (let p = 0; p < a.prompts.length; p += 1) {
      const prompt = a.prompts[p]!;
      await db.insert(speakingPromptsTable).values({
        assignmentId: assignment!.id,
        topicId: prompt.topicCode
          ? (topicIdByCode.get(prompt.topicCode) ?? null)
          : null,
        position: p,
        mode: prompt.mode,
        prompt: prompt.prompt,
        targetSeconds: prompt.targetSeconds ?? null,
        rubric: prompt.rubric ?? null,
        guidance: prompt.guidance ?? null,
      });
    }
  }

  logger.info("Speaking course content seeded");
}
