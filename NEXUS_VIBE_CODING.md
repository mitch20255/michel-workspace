# NEXUS — APP FOR VIBE CODING

## USE THIS STACK

**BEST FOR THIS PROJECT:** Bolt.new OR Lovable

Why:
- Supabase integration built-in
- Good for full-stack Next.js apps
- Fast iteration
- Both can handle the complexity

**ALTERNATIVE:** Replit
- Slightly more complex setup
- Better for teams

**AVOID:** Cursor for this one
- Better for code modification than full generation
- You want generation speed here

---

## COPY PASTE PROMPT FOR BOLT/LOVABLE

Copy everything below this line:

---

# NEXUS — SECOND BRAIN APP

## THE CONCEPT
AI-powered second brain that captures everything, connects it intelligently, and surfaces the right info at the right time — without you searching.

## DESIGN SYSTEM

### Colors (dark mode primary)
- Background: #0A0A0F
- Surface: #12121A
- Border: #1E1E2E
- Text Primary: #F1F5F9
- Text Secondary: #94A3B8
- Accent: #6366F1 (indigo)
- Success: #10B981
- Warning: #F59E0B

### Font
- Inter (Google Fonts)

### Spacing
- Base: 4px
- Components: 8px, 16px, 24px, 32px

### Radius
- Cards: 12px
- Buttons: 8px
- Inputs: 8px

---

## PAGES TO BUILD

### 1. LANDING PAGE
- Hero: "Your brain can't hold it all. Nexus remembers."
- Features grid (3 columns):
  - Universal Capture
  - AI-Powered Organization
  - Always There When You Need It
- How it works (3 steps with icons)
- Pricing section: Free / Pro ($15/mo) / Team
- CTA: "Start Free"

### 2. AUTH PAGE
- Email + Google sign in
- Clean, minimal form
- Dark mode

### 3. DASHBOARD (HOME)
- Left sidebar (collapsible):
  - Logo: NEXUS
  - Search bar (⌘K)
  - Quick capture button (+)
  - Projects list
  - Tags list
  - Settings
- Main area:
  - Today's Digest section (cards)
  - Quick capture input (sticky top)
  - Recent notes feed
  - Active projects row

### 4. PROJECTS PAGE
- Grid of project cards
- Each card shows:
  - Project name
  - Color dot
  - Note count
  - Status (active/archived)
- Create new project button (+)
- Filter: All / Active / Archived

### 5. PROJECT DETAIL PAGE
- Header: Project name + status + edit button
- Tabs: Notes / Decisions / Tasks / Timeline
- Notes tab: List of note cards
- Decisions tab: List of decisions with date + status
- Tasks tab: Checklist with checkboxes
- Timeline tab: Chronological feed

### 6. ALL NOTES PAGE
- Search bar (top)
- Filter pills: All / Links / Voice / Screenshots
- Notes feed (reverse chronological)
- Each note card shows:
  - Type icon (link/voice/text/screenshot)
  - Title
  - Summary (2 lines max)
  - Tags
  - Source URL (if link)
  - Created date
  - Linked projects

### 7. NOTE DETAIL PAGE
- Full note content
- Metadata sidebar:
  - Created at
  - Source URL
  - Tags
  - Linked projects
- "Connected Notes" section (knowledge graph mini view)
- AI Chat bubble (bottom right, collapsible)
- Edit / Delete actions

### 8. SEARCH MODAL (⌘K)
- Full screen overlay
- Big search input
- Results appear as you type
- Categories: Recent / Notes / Projects / Tasks
- Keyboard navigation (up/down/enter)
- Semantic search label

### 9. AI COACH MODULE
- Chat-like interface
- Prompt input at bottom
- Messages from AI on left, user on right
- Context: AI has access to user's notes and projects
- Suggested prompts as chips

### 10. DAILY DIGEST PAGE
- Header: "Good morning. Here's what matters."
- Digest cards:
  - Reminder cards (spaced repetition)
  - Pending tasks for active projects
  - "You saved this 3 months ago" resurfacing
  - Meeting coming up today
- Quick actions on each card

### 11. SETTINGS PAGE
- Profile: name, email, avatar
- Integrations: Google Calendar (connect button)
- Preferences:
  - Daily digest time (dropdown)
  - Voice enabled (toggle)
  - Dark/Light mode (toggle)
- Data: Export / Delete account

### 12. ONBOARDING (3 steps)
- Step 1: "What brings you here?" (3 options as cards)
- Step 2: "Connect your tools" (Google Calendar, Browser extension)
- Step 3: "Save your first thought" (quick capture input)
- Progress dots at bottom

---

## COMPONENTS TO BUILD

### NOTE CARD
```
States: default, hover, selected
- Type icon (left)
- Title (bold, truncate 1 line)
- Summary (truncate 2 lines)
- Tags row (colored pills)
- Footer: source link + date
- Border-left: 3px color by type
```

### PROJECT CARD
```
States: default, hover
- Color dot + name
- Note count
- Status badge
- Hover: slight scale + border glow
```

### DIGEST CARD
```
- Icon (left)
- Title + description
- Action button (right)
- Background: gradient or surface
```

### QUICK CAPTURE INPUT
```
- Sticky at top of dashboard
- Placeholder: "Save a thought... or press ⌘K"
- Expand on focus
- Voice button (microphone icon)
```

### CHAT BUBBLE
```
User: right-aligned, accent bg
AI: left-aligned, surface bg
Timestamp below each
```

### TAG PILL
```
Small rounded pill
Background: accent at 10%
Text: accent color
Size: small font
```

### SIDEBAR
```
Fixed left, 240px wide
Collapsible to 64px (icons only)
Background: surface
Border-right: 1px border color
```

---

## DATABASE SCHEMA (SUPABASE)

```sql
-- Users (handled by Supabase Auth)

-- Notes
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  type TEXT DEFAULT 'text', -- 'text', 'link', 'voice', 'screenshot', 'file'
  title TEXT,
  content TEXT,
  source_url TEXT,
  summary TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  color TEXT DEFAULT '#6366F1',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Note-Project linking
CREATE TABLE note_projects (
  note_id UUID REFERENCES notes ON DELETE CASCADE,
  project_id UUID REFERENCES projects ON DELETE CASCADE,
  PRIMARY KEY (note_id, project_id)
);

-- Tags
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366F1'
);

-- Note-Tag linking
CREATE TABLE note_tags (
  note_id UUID REFERENCES notes ON DELETE CASCADE,
  tag_id UUID REFERENCES tags ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  project_id UUID REFERENCES projects ON DELETE SET NULL,
  note_id UUID REFERENCES notes ON DELETE SET NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'done'
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Decisions
CREATE TABLE decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  project_id UUID REFERENCES projects ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

-- Policies: users can only see their own data
CREATE POLICY "Users own notes" ON notes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own projects" ON projects FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own tasks" ON tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own decisions" ON decisions FOR ALL USING (auth.uid() = user_id);
```

---

## API ROUTES TO BUILD

```
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/google

GET /api/notes
POST /api/notes
GET /api/notes/[id]
PATCH /api/notes/[id]
DELETE /api/notes/[id]

GET /api/projects
POST /api/projects
GET /api/projects/[id]
PATCH /api/projects/[id]
DELETE /api/projects/[id]

GET /api/tasks
POST /api/tasks
PATCH /api/tasks/[id]
DELETE /api/tasks/[id]

GET /api/decisions
POST /api/decisions
DELETE /api/decisions/[id]

POST /api/capture/url
POST /api/capture/voice

POST /api/summarize
POST /api/search
```

---

## FEATURES TO BUILD IN ORDER

### MVP (this prompt)
1. Auth (email + Google)
2. Dashboard with sidebar
3. Quick note capture
4. Project creation
5. Note list + note detail
6. Project pages
7. Search modal
8. Basic settings

### PHASE 2 (later)
- Voice capture + transcription
- Semantic search (pgvector)
- Knowledge graph visualization
- Daily digest
- AI chat with notes
- Spaced repetition
- Meeting integration

### PHASE 3 (later)
- AI coaching mode
- Proactive surfacing
- Synthesis reports
- Browser extension
- Team features

---

## PRICING UI

```
Free
- 100 captures/month
- 3 projects
- Basic search
---
Pro ($15/month or $120/year)
- Unlimited captures
- Unlimited projects
- Semantic search
- Daily digest
- Voice capture
- AI coaching
---
Team ($30/user/month)
- Everything in Pro
- Shared team brain
- SSO
```

---

## VOICE COMMANDS (future)

- "Nexus, save this thought: [text]"
- "Nexus, what do I know about [topic]?"
- "Nexus, summarize my week"
- "Nexus, create a task"
- "Nexus, ask me questions about [project]"

---

## DESIGN NOTES

- Dark mode ONLY for now
- Inter font from Google Fonts
- Smooth animations (150-200ms)
- Keyboard shortcuts: ⌘K for search, ⌘N for new note
- Responsive: mobile-first, then desktop
- No modals except search and confirmations

---

## COPY FOR HERO SECTION

Headline: "Your brain can't hold it all. Nexus remembers."

Subheadline: "The AI-powered second brain that captures everything you consume, connects it intelligently, and surfaces the right information at the right time — without you having to search."

CTA: "Start for free"

---

## COMMON ERRORS TO AVOID

1. Don't overengineer the graph visualization in MVP
2. Don't build voice capture until text flow works
3. Don't add team features until solo is solid
4. Keep the UI simple — this is a utility app
5. Focus on speed — search must be <3 seconds
6. Mobile experience must be as good as desktop

---

## SUCCESS CRITERIA FOR MVP

1. User can sign up and log in
2. User can capture a text note in <5 seconds
3. User can create a project and link a note
4. User can search and find a note
5. User sees their recent notes on dashboard
6. The app feels fast and responsive
7. Dark mode looks great
