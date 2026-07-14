# First Engineer Onboarding — Week 1 Execution Checklist

**Onboarding Start Date:** [Monday, July 15, 2026]  
**Engineer Name:** [TBD]  
**Mentor:** [TBD]  
**Track:** [Full-Stack / Backend / Frontend / DevOps / Security]  
**12-Week Goal:** Practitioner-level autonomous contributor

---

## Welcome & Context

You're joining RealSyncDynamics.AI at an exciting time! We've just launched all production systems and now we're building the operational excellence framework for sustainable growth.

**Your 12-Week Path:**
- **Week 1-2:** Foundation (dev environment, first PR, project patterns)
- **Week 3-4:** Supervised features (guided implementation)
- **Week 5-8:** Independent features (2-3 features shipped)
- **Week 9-10:** Capstone project (design → delivery → mentoring)
- **Week 11-12:** Practitioner certification (assessment & autonomous contribution)

**Success Metric:** Ship your first complete feature to production by end of Week 12 as an independently-capable Practitioner.

---

## Day 1: Welcome & Development Setup

**Time Allocation:** 4-5 hours  
**Mentor Involvement:** 30 min (welcome) + 30 min (setup support)

### Morning: Welcome & Context (9 AM - 10 AM)

- [ ] **30-min meeting with Engineering Lead**
  - [ ] Company mission: EU-sovereign SaaS for creators and agencies
  - [ ] Team introduction (meet each team member briefly)
  - [ ] Your role and what you'll be working on
  - [ ] 12-week success metrics and expectations
  - [ ] Typical work hours and communication norms
  - [ ] Questions about role or company

### Mid-Morning: GitHub & SSH Setup (10 AM - 12 PM)

**Task: Get GitHub SSH access working**

- [ ] Request GitHub account creation from [Engineering Lead]
- [ ] Generate SSH key on your machine:
  ```bash
  ssh-keygen -t ed25519 -C "your.email@gmail.com"
  # Press enter for default location
  # Create a strong passphrase
  ```

- [ ] Add SSH key to GitHub:
  - [ ] Copy public key: `cat ~/.ssh/id_ed25519.pub`
  - [ ] GitHub → Settings → SSH and GPG keys → New SSH key
  - [ ] Paste and save

- [ ] Test SSH connection:
  ```bash
  ssh -T git@github.com
  # Should see: "Hi [username]! You've successfully authenticated..."
  ```

- [ ] Clone repository:
  ```bash
  git clone git@github.com:realsyncdynamics-spec/RealSyncDynamics.AI.git
  cd RealSyncDynamics.AI
  ```

- [ ] Configure git identity:
  ```bash
  git config user.name "Your Name"
  git config user.email "your.email@gmail.com"
  git config --list | grep user  # Verify
  ```

- [ ] GitHub notifications:
  - [ ] GitHub → Settings → Notifications
  - [ ] Enable "Participating and @mentions" in email
  - [ ] Subscribe to repository: Watch this repo

### Afternoon: Development Environment (12 PM - 5 PM)

**Task: Get localhost:3000 running**

- [ ] **Verify Node.js installed:**
  ```bash
  node --version  # Should be v20+
  npm --version   # Should be v10+
  ```
  
  If not installed: https://nodejs.org (download LTS)

- [ ] **Install project dependencies:**
  ```bash
  cd RealSyncDynamics.AI
  npm install
  # This will take 3-5 minutes
  # If errors: ask mentor for help
  ```

- [ ] **Start development server:**
  ```bash
  npm run dev
  # Should see: "VITE v... ready in 500ms"
  # Then: "➜  Local:   http://localhost:3000/"
  ```

- [ ] **Open browser to http://localhost:3000**
  - [ ] You should see the landing page
  - [ ] Click around a few pages
  - [ ] Check browser console (F12 → Console)
  - [ ] Should see no red errors (warnings OK)

- [ ] **Leave dev server running** (you'll need it all week)

### Late Afternoon: IDE & Tools Setup (3 PM - 5 PM)

**Task: Configure development tools**

- [ ] **Install VS Code extensions** (if using VS Code):
  - [ ] ESLint (dbaeumer.vscode-eslint)
  - [ ] Prettier (esbenp.prettier-vscode)
  - [ ] TypeScript Vue Plugin (Vue.volar)
  - [ ] REST Client (humao.rest-client)

- [ ] **Enable format on save:**
  - [ ] VS Code → Settings
  - [ ] Search: "Format on Save"
  - [ ] Enable it
  - [ ] Your code will auto-format when you save

- [ ] **Verify TypeScript strict mode:**
  - [ ] Open `tsconfig.json` in project root
  - [ ] Should see: `"strict": true`
  - [ ] This catches type errors before runtime

- [ ] **Git configuration:**
  - [ ] Install git hooks: `npm install`
  - [ ] Verify pre-commit hooks working

### End of Day Check-In

- [ ] **30-min sync with Mentor (5 PM - 5:30 PM)**
  - [ ] Demo: Show localhost:3000 running
  - [ ] Ask: Any setup issues?
  - [ ] Celebrate: First day complete! 🎉
  - [ ] Tomorrow: Project tour and documentation

**Day 1 Success Criteria:**
✅ GitHub SSH working  
✅ Repository cloned locally  
✅ npm install completed  
✅ localhost:3000 running in browser  
✅ No console errors  
✅ IDE configured  
✅ Ready for Day 2

---

## Day 2: Project Tour & Documentation

**Time Allocation:** 4-5 hours  
**Mentor Involvement:** 60 min (architecture walkthrough) + 30 min (Q&A)

### Morning: CLAUDE.md Deep Dive (9 AM - 12 PM)

**Task: Read and understand project conventions**

- [ ] **Read docs/CLAUDE.md completely** (takes ~30 min)
  - [ ] Stack overview (React, TypeScript, Tailwind, Supabase)
  - [ ] Important folders and their purpose
  - [ ] Centralized config pattern
  - [ ] Component patterns
  - [ ] Routing structure
  - [ ] Testing approach
  - [ ] Deployment process
  - [ ] Database and RLS concepts

- [ ] **Take notes on:**
  - [ ] Stack: Frontend, backend, AI, database, monitoring
  - [ ] Key folders: src/pages, src/features, src/components, supabase/
  - [ ] Commands: npm run dev, npm test, npm run lint
  - [ ] Routing: How are pages structured?
  - [ ] Config: Where does data live (src/config/)?

- [ ] **Questions to ask mentor:**
  - [ ] Why is RLS (Row Level Security) important?
  - [ ] How does multi-tenancy work?
  - [ ] What's the difference between public pages and features?
  - [ ] What does "lazy loading" mean?

### Midday: 60-Minute Architecture Walkthrough (12 PM - 1 PM)

**Mentor leads: System overview, data flow, key concepts**

- [ ] **Frontend Architecture (15 min)**
  - [ ] React 19 + TypeScript + Tailwind
  - [ ] Public pages (eager) vs. features (lazy)
  - [ ] Routing: react-router-dom 7
  - [ ] How auth-gated features work
  - [ ] Component organization

- [ ] **Backend Architecture (15 min)**
  - [ ] Supabase: Auth, Postgres database, Edge Functions
  - [ ] Database: RLS policies, multi-tenant isolation
  - [ ] Edge Functions: Deno runtime, AI invocation, webhooks
  - [ ] Storage: File uploads and C2PA provenance

- [ ] **Infrastructure (15 min)**
  - [ ] Cloudflare Pages: CDN, deployment, SSL
  - [ ] Monitoring: Sentry for errors and performance
  - [ ] Analytics: What metrics do we track?
  - [ ] Deployment: How does code get to production?

- [ ] **Data Flow Example (15 min)**
  - [ ] User signs up → Supabase Auth
  - [ ] User creates resource → Postgres (with RLS)
  - [ ] User runs AI feature → Edge Function invokes API
  - [ ] Results logged in Sentry and analytics
  - [ ] Follow an actual feature end-to-end

### Afternoon: Environment Configuration (1 PM - 3 PM)

**Task: Get local development environment fully working**

- [ ] **Copy environment file:**
  ```bash
  cp .env.example .env.local
  ```

- [ ] **Obtain Supabase credentials from mentor:**
  - [ ] Ask mentor for `.env.local` secrets (NOT checked into git)
  - [ ] Secrets include:
    - [ ] `VITE_SUPABASE_URL` (e.g., https://xxx.supabase.co)
    - [ ] `VITE_SUPABASE_ANON_KEY` (public key, safe to have locally)
  - [ ] Update `.env.local` with these values

- [ ] **Test database connection:**
  ```bash
  npm run test:db
  # Should run database-specific tests
  # If all pass: ✅ database connection working
  ```

- [ ] **Verify entire app loads:**
  - [ ] `npm run dev` should still be running
  - [ ] Open http://localhost:3000
  - [ ] Try signing in with test account (if available)
  - [ ] Navigate through app
  - [ ] Check console (F12) for errors

### Late Afternoon: Wrap-Up (3 PM - 5 PM)

- [ ] **Review CLAUDE.md key sections** one more time
- [ ] **Document your questions** for mentor
- [ ] **Prepare for Day 3:** Git and first PR

**Day 2 Success Criteria:**
✅ Read and understood CLAUDE.md  
✅ Architecture walkthrough completed  
✅ Supabase credentials configured  
✅ Database tests passing  
✅ App loads locally without errors  
✅ Understand how system is organized

---

## Day 3: Git & First Pull Request

**Time Allocation:** 4 hours  
**Mentor Involvement:** 60 min (PR walkthrough) + async review

### Morning: Git Fundamentals (9 AM - 11 AM)

**Task: Understand git workflow**

- [ ] **Git configuration review:**
  ```bash
  git config user.name "Your Name"
  git config user.email "your.email@example.com"
  git config --list | grep user
  ```

- [ ] **Understand git commands:**
  ```bash
  git status       # What files changed?
  git add .        # Stage changes
  git commit -m "message"  # Create commit
  git push origin branch-name  # Send to GitHub
  ```

- [ ] **Branch strategy:**
  - [ ] Never work on `main` branch
  - [ ] Always create feature branch: `git checkout -b feature-name`
  - [ ] Branch naming: `docs/description`, `feat/feature`, `fix/bug`
  - [ ] When done: Push and create PR for review

### Mid-Morning: First PR Walkthrough with Mentor (11 AM - 12:15 PM)

**Mentor walks through: How to create PR, what review looks like**

- [ ] **Create small feature branch:**
  ```bash
  git checkout -b docs/first-pr-onboarding
  # You're now on new branch (not main)
  git branch  # Verify with asterisk on current branch
  ```

- [ ] **Make a small change:**
  - [ ] Option 1: Fix typo in README or docs
  - [ ] Option 2: Add your name to TEAM_MEMBERS or similar
  - [ ] Option 3: Add comment explaining a code section
  - [ ] Something simple (not code logic)

- [ ] **Review your change:**
  ```bash
  git status          # See changed files
  git diff filename   # See exact changes
  ```

- [ ] **Commit your change:**
  ```bash
  git add filename
  git commit -m "docs: fix typo in [file] or add [description]"
  # Commit message format: "type: short description"
  ```

- [ ] **Push to GitHub:**
  ```bash
  git push origin docs/first-pr-onboarding
  # GitHub will suggest creating a PR
  ```

### Afternoon: Create & Submit First PR (12:15 PM - 4 PM)

**Task: Submit PR for mentor review**

- [ ] **Create PR on GitHub:**
  - [ ] Go to https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI
  - [ ] Should see yellow banner: "Compare & pull request"
  - [ ] Click it
  - [ ] Title: "docs: [brief description of change]"
  - [ ] Description: "This PR [briefly explains what changed and why]"
  - [ ] Click "Create Pull Request"

- [ ] **Request review from mentor:**
  - [ ] PR page → "Reviewers" section
  - [ ] Add your mentor
  - [ ] Leave comment: "Ready for review @mentor-name"

- [ ] **Understand PR process:**
  - [ ] Mentor will review (usually within 24 hours)
  - [ ] Mentor may request changes (that's normal!)
  - [ ] You'll make updates and push again
  - [ ] Once approved, mentor will merge

- [ ] **Wait for feedback** (mentor will review by tomorrow)

**Day 3 Success Criteria:**
✅ Git workflow understood  
✅ Feature branch created  
✅ Change made and committed  
✅ PR created and submitted  
✅ Mentor assigned as reviewer  
✅ First PR live on GitHub

---

## Day 4: Testing & Code Quality

**Time Allocation:** 3 hours  
**Mentor Involvement:** 30 min (walkthrough) + async feedback

### Morning: Run Test Suite (9 AM - 11 AM)

**Task: Execute and understand tests**

- [ ] **Run full test suite:**
  ```bash
  npm test
  # Should see: "Test Files  X passed (X)"
  # Expected: 2069 passing tests
  # If failures: ask mentor
  ```

- [ ] **Understand test output:**
  - [ ] Passed (green) vs. failed (red)
  - [ ] Test coverage percentage
  - [ ] Individual test names
  - [ ] Error messages (if any failures)

- [ ] **Run tests for specific file:**
  ```bash
  npm test -- src/lib/auth.test.ts
  # Runs only auth tests
  ```

- [ ] **Watch mode for development:**
  ```bash
  npm run test:watch
  # Re-runs tests when you change files
  # Great for development
  ```

### Mid-Morning: TypeScript & Linting (11 AM - 12 PM)

**Task: Understand code quality checks**

- [ ] **Run type checker:**
  ```bash
  npm run lint
  # Should see: "Found 0 errors"
  # Checks for TypeScript type safety
  ```

- [ ] **Understand strict mode:**
  - [ ] TypeScript `strict: true` is enabled
  - [ ] All variables must have types
  - [ ] No implicit `any`
  - [ ] Catches type errors before runtime

- [ ] **Format your first PR with Prettier:**
  - [ ] In VS Code, right-click on file
  - [ ] Select "Format Document"
  - [ ] Code should auto-format
  - [ ] Commit: `git add . && git commit -m "style: format"`

### Afternoon: Smoke Tests (12 PM - 3 PM)

**Task: Run system-wide health checks**

- [ ] **Run smoke tests:**
  ```bash
  npm run qa:smoke
  # Tests critical paths through app
  # Should see all tests passing
  # Takes ~2 minutes
  ```

- [ ] **Understand smoke tests:**
  - [ ] Quick sanity checks
  - [ ] Tests that app can load, basic features work
  - [ ] Catch regressions before production
  - [ ] Run before committing critical changes

- [ ] **Run E2E tests (optional):**
  ```bash
  npm run e2e
  # Full browser-based end-to-end tests
  # Takes longer (5-10 min)
  # Good to see at least once
  ```

**Day 4 Success Criteria:**
✅ Full test suite runs (2069 passing)  
✅ Linting passes (0 errors)  
✅ Smoke tests pass  
✅ TypeScript strict mode understood  
✅ Code formatting working

---

## Day 5: Wrap-Up & Celebration

**Time Allocation:** 2 hours  
**Mentor Involvement:** 30 min (1:1 sync)

### Morning: Reflect on Week 1 (9 AM - 10 AM)

- [ ] **Review what you learned:**
  - [ ] Technology stack
  - [ ] Project structure
  - [ ] Git workflow
  - [ ] How to run and test code

- [ ] **Document key takeaways:**
  - [ ] Write 3-5 bullet points: "This week I learned..."
  - [ ] Save for future reference

### Mid-Morning: 1:1 with Mentor (10 AM - 10:30 AM)

**Mentor check-in: Progress, blockers, celebration**

- [ ] **What went well?**
  - [ ] Dev environment setup
  - [ ] First PR submitted
  - [ ] Understanding of project

- [ ] **Any blockers or challenges?**
  - [ ] What was hard?
  - [ ] What confused you?
  - [ ] What would help?

- [ ] **Celebrate! 🎉**
  - [ ] You've completed Week 1!
  - [ ] You've made your first PR
  - [ ] You understand the project structure
  - [ ] You're on track for Week 2

### Late Morning: Introduce Yourself to Team (10:30 AM - 11 AM)

- [ ] **Post in #engineering Slack channel:**
  ```
  👋 Hey team! I'm [Your Name], joining as a [role] engineer.

  This week I:
  - Set up my dev environment
  - Read CLAUDE.md and learned about our tech stack
  - Made my first PR (fixing [what you fixed])
  - Ran the test suite (2069 tests passing!)

  One thing that impressed me: [honest reflection]

  Looking forward to shipping great features with you! 🚀
  ```

- [ ] **Attend daily standup** (if scheduled today)

### Preparation for Week 2 (11 AM - 12 PM)

- [ ] **Mentor assigns Week 2 role-specific material:**
  - [ ] For Full-Stack: [React patterns doc]
  - [ ] For Backend: [Database & RLS doc]
  - [ ] For Frontend: [Component architecture doc]
  - [ ] For DevOps: [Infrastructure guide]
  - [ ] For Security: [Security architecture]

- [ ] **Read assigned material** over the weekend (optional, but recommended)

**Day 5 Success Criteria:**
✅ Week 1 reflection complete  
✅ 1:1 sync completed with mentor  
✅ Team introduction posted  
✅ First PR merged (or close)  
✅ Ready for Week 2 deep dive  
✅ Confident in basics

---

## Week 1 Success Metrics

**By End of Friday (July 19, 2026):**

✅ Development environment fully functional  
✅ Can run `npm run dev` and see localhost:3000  
✅ GitHub SSH working, repo cloned  
✅ CLAUDE.md read and understood  
✅ Architecture walkthrough completed  
✅ First PR created and submitted for review  
✅ Test suite runs successfully (2069/2069 passing)  
✅ TypeScript linting passes (0 errors)  
✅ Can use git workflow confidently  
✅ Introduced self to team  
✅ Understand project structure and conventions  

---

## Week 2 Preview

**Next Week:**
- Deep dive into your role-specific technology
- 2-hour pair programming session with mentor
- Implement small guided feature
- First code review feedback iteration
- Understand patterns and best practices in your track

**By End of Week 2:**
- Role-specific fundamentals understood
- Small feature implemented and deployed
- Code review feedback incorporated
- Comfortable asking questions
- Ready for supervised features (Week 3-4)

---

**Mentor Notes:**
- Check in daily (5-10 min)
- Be available for blocker questions
- Celebrate wins (even small ones)
- Remember: this is their first week! Be patient and encouraging.

**Engineer: You've got this! 🚀**
