# Weekly Menu - AI Project Log

Last updated: 2026-03-16 (Asia/Shanghai)
Scope: `apps/weekly-menu`

## 1) Technical Route (Current)

- Framework: Next.js App Router (`next@16.2.0-canary.10`) + React 19 + Tailwind CSS 4.
- Runtime data storage for business menus: PostgreSQL table `weekly_menus` (via `src/lib/db.ts` + `pg`).
- Frontend routes (current):
  - `/` -> generation setup landing page
  - `/planner` -> weekly menu generation, save, and overlap warning flow
  - `/history` -> history listing and delete
- API routes (business API):
  - `GET/POST /api/weekly-menus`
  - `GET/PUT/PATCH/DELETE /api/weekly-menus/:id`
- Admin route strategy (aligned with bubu-log): Payload CMS route group under `src/app/(payload)`:
  - `/admin/[[...segments]]`
  - `/api/[...slug]`
  - `/api/graphql`

## 2) Project Standards (Agreed in This Session)

- Date-week semantics: "week" means Monday-Sunday containing the selected day.
- Save-week flow: week range is decided before entering planner; save dialog cannot edit week date.
- Calendar colors:
  - Blue: currently selected week
  - Green: dates covered by existing saved menus
  - Red: overlap between selected week and covered history
- Overlap behavior: styled warning panel before final save confirmation (not plain browser confirm).
- Generation flow: when history reference is enabled, planner first performs reference step, then user explicitly clicks "生成本周菜单" to display generated content.
- Download/install commands: run by user terminal first when requested.

## 3) Session Change History (Chronological)

Note: entries include both active and reverted changes to preserve context.

### 2026-03-15 - Entry 01 - Initial repo reading
- Type: analysis
- Status: active
- What changed: mapped project structure and key modules (`page`, `history`, generator, dishes, API, db).

### 2026-03-15 - Entry 02 - Save dialog calendar coverage highlighting
- Type: feature
- Status: active
- Files:
  - `src/app/(frontend)/planner/page.tsx`
  - `src/app/api/weekly-menus/route.ts`
- What changed:
  - Added monthly calendar UI in save dialog.
  - Loaded history coverage dates and highlighted them.
  - Added `limit` query support for `GET /api/weekly-menus`.

### 2026-03-15 - Entry 03 - Font warning fix via `next/font/google`
- Type: fix
- Status: reverted
- Files impacted during attempt: `src/app/layout.tsx` (later moved to `src/app/(frontend)/layout.tsx`).

### 2026-03-15 - Entry 04 - Hydration mismatch attempts
- Type: fix
- Status: reverted
- Files impacted during attempt: planner page initialization strategy.
- Note: interim hydration fixes were rolled back per user request.

### 2026-03-15 - Entry 05 - Week range semantics corrected
- Type: feature
- Status: active
- Files: `src/app/(frontend)/planner/page.tsx`
- What changed:
  - Changed selected-week computation from "selected day + 6" to "Monday-Sunday containing selected day".
  - Save `menuPeriod` now uses selected week Monday.

### 2026-03-15 - Entry 06 - Overlap warning UX upgrade
- Type: UX
- Status: active
- Files: `src/app/(frontend)/planner/page.tsx`
- What changed:
  - Replaced native confirm with styled warning section listing overlap dates.

### 2026-03-15 - Entry 07 - New landing page and route split
- Type: feature
- Status: active
- Files:
  - `src/app/(frontend)/page.tsx`
  - `src/app/(frontend)/planner/page.tsx` (moved from old root page)
- What changed:
  - Added new main page with two actions:
    - 生成一周菜单
    - 查看往期数据

### 2026-03-15 - Entry 08 - Generation pre-setup modal
- Type: feature
- Status: active
- Files: `src/app/(frontend)/page.tsx`
- What changed:
  - On entering planner flow, user now chooses:
    - generation week date
    - whether to reference historical data

### 2026-03-15 - Entry 09 - Reference-first generation flow
- Type: feature
- Status: active
- Files: `src/app/(frontend)/planner/page.tsx`
- What changed:
  - Added states: preparing reference -> reference done -> user clicks generate.
  - Hidden menu content until explicit "生成本周菜单" click.
  - Added loading spinner icon in "正在参考以往数据" state.

### 2026-03-15 - Entry 10 - Save dialog simplification
- Type: UX
- Status: active
- Files: `src/app/(frontend)/planner/page.tsx`
- What changed:
  - Removed editable date controls in save dialog.
  - Kept readonly week range and overlap guard flow.
  - Removed extra helper line and removed redundant red/green legend block by request.

### 2026-03-15 - Entry 11 - Planner navigation improvement
- Type: UX
- Status: active
- Files: `src/app/(frontend)/planner/page.tsx`
- What changed: added "主页面" navigation action in planner quick menu (history page unchanged).

### 2026-03-15 - Entry 12 - API RESTful normalization
- Type: backend
- Status: active
- Files:
  - `src/app/api/weekly-menus/route.ts`
  - `src/app/api/weekly-menus/[id]/route.ts`
  - `src/lib/db.ts`
  - frontend consumers in `src/app/(frontend)/page.tsx`, `src/app/(frontend)/planner/page.tsx`, `src/app/(frontend)/history/page.tsx`
- What changed:
  - Added pagination (`limit`, `offset`) and validation.
  - Added consistent error envelope (`error.code`, `message`).
  - Added item-level methods: `GET`, `PUT`, `PATCH`, `DELETE` on `:id` route.
  - `DELETE` returns `204`.
  - Added DB helpers for list offset, get by id, update.

### 2026-03-15 - Entry 13 - Database admin approach change attempts
- Type: tooling
- Status: reverted
- What changed:
  - Attempted Adminer and pgAdmin local tooling.
  - Later reverted by request and replaced with Payload route alignment.

### 2026-03-15 - Entry 14 - Payload CMS integration (bubu-log aligned)
- Type: platform
- Status: active (in-progress initialization)
- Files:
  - `package.json`
  - `next.config.ts`
  - `tsconfig.json`
  - `payload.config.ts`
  - `src/payload/collections/CMSAdmins.ts`
  - `src/app/(payload)/layout.tsx`
  - `src/app/(payload)/admin/[[...segments]]/page.tsx`
  - `src/app/(payload)/admin/importMap.js`
  - `src/app/(payload)/api/[...slug]/route.ts`
  - `src/app/(payload)/api/graphql/route.ts`
  - `README.md`
- What changed:
  - Added Payload dependencies and Next integration (`withPayload`).
  - Added CMS admins collection and Payload route handlers.
  - Added fallback page for admin initialization status.

### 2026-03-15 - Entry 15 - Multi-root layout fix for admin hydration
- Type: fix
- Status: active
- Files moved:
  - `src/app/layout.tsx` -> `src/app/(frontend)/layout.tsx`
  - `src/app/page.tsx` -> `src/app/(frontend)/page.tsx`
  - `src/app/planner/page.tsx` -> `src/app/(frontend)/planner/page.tsx`
  - `src/app/history/page.tsx` -> `src/app/(frontend)/history/page.tsx`
- What changed:
  - Separated frontend and payload route groups to avoid nested `<html>/<body>` hydration conflicts.

### 2026-03-15 - Entry 16 - Payload table mapping conflict handling
- Type: fix
- Status: active decision
- What changed:
  - Removed experimental Payload `WeeklyMenus` collection mapping attempt (because of schema push conflicts with existing `weekly_menus` table naming and interactive rename prompts).
  - Current Payload config keeps `CMSAdmins` only.

### 2026-03-16 - Entry 17 - Payload user and recipe collections
- Type: feature
- Status: active
- Files:
  - `payload.config.ts`
  - `src/payload/collections/PlannerUsers.ts`
  - `src/payload/collections/PlannerRecipes.ts`
- What changed:
  - Added `planner-users` collection for user ID and profile information management in Payload Admin.
  - Added `planner-recipes` collection with category select options (`big-meat`, `small-meat`, `vegetable`) for recipe classification.
  - Registered the two new collections in `payload.config.ts` so they are persisted in PostgreSQL via Payload.
- Why:
  - Dashboard data model needs to include per-user identity/info and a categorized recipe library for meal planning.
  - Using Payload collections keeps admin CRUD and table lifecycle consistent with existing CMS integration.
- Verification:
  - `npm run lint` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx` about custom font usage)
  - `npm run build` (pass)

### 2026-03-16 - Entry 18 - Seed local dishes into payload recipes
- Type: tooling
- Status: active
- Files:
  - `scripts/seed-planner-recipes.mjs`
- What changed:
  - Added a local seed script that reads `src/lib/weekly-menu/dishes.ts` and inserts missing rows into `planner_recipes`.
  - Seeded existing local dishes into Payload DB: `77` recipes total (`37` big-meat, `20` small-meat, `20` vegetable).
- Why:
  - New `planner-recipes` collection had schema but no initial data, while local dish source already existed in code.
  - Seeding aligns dashboard data with existing meal generation dish library.
- Verification:
  - `node scripts/seed-planner-recipes.mjs` (pass)
  - `npm run lint` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx`)
  - `npm run build` (pass)

### 2026-03-16 - Entry 19 - Recipe category filter dashboard
- Type: ux
- Status: active
- Files:
  - `src/app/api/recipes/route.ts`
  - `src/lib/db.ts`
  - `src/app/(frontend)/recipes/page.tsx`
  - `src/app/(frontend)/page.tsx`
  - `src/app/(frontend)/planner/page.tsx`
  - `src/app/(frontend)/history/page.tsx`
- What changed:
  - Added `GET /api/recipes` with category filter support (`all|big-meat|small-meat|vegetable`) and optional keyword query.
  - Added DB query helper `listPlannerRecipes` and typed recipe category constants in `db.ts`.
  - Added new frontend route `/recipes` with category filter chips for 大荤/小荤/素菜 and list rendering.
  - Added entry links to recipe dashboard from home page and quick menus in planner/history pages.
- Why:
  - User needs an easy recipe filter by dish type in dashboard workflow.
  - Existing data already in `planner_recipes`; a dedicated filtered view makes browsing/editing preparation faster.
- Verification:
  - `npm run lint` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx`)
  - `npm run build` (pass)

### 2026-03-16 - Entry 20 - Payload admin recipe filter labels
- Type: ux
- Status: active
- Files:
  - `src/payload/collections/PlannerRecipes.ts`
- What changed:
  - Added Chinese collection labels for payload admin (`菜谱` / `菜谱库`).
  - Updated recipe category field label to `菜品种类` so admin filter UI directly maps to 大荤/小荤/素菜.
- Why:
  - User asked specifically for category filter visibility and wording inside Dashboard (Payload Admin).
  - Clear Chinese labels reduce confusion between frontend filters and admin filters.
- Verification:
  - `npm run lint` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx`)
  - `npm run build` (pass)

### 2026-03-16 - Entry 21 - Dashboard labels for users and recipe filter
- Type: ux
- Status: active
- Files:
  - `src/payload/collections/PlannerUsers.ts`
  - `src/payload/collections/PlannerRecipes.ts`
- What changed:
  - Updated `planner-users` collection labels to Chinese and set plural label to `用户列表`.
  - Updated recipe category field label in `planner-recipes` to `Filter` while keeping options as `大荤` / `小荤` / `素菜`.
- Why:
  - User requested Dashboard naming to show `用户列表` and explicit Filter options for recipe library.
- Verification:
  - `npm run lint` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx`)
  - `npm run build` (pass)

### 2026-03-16 - Entry 22 - Revert frontend filters and keep dashboard Add Filter only
- Type: ux
- Status: active
- Files:
  - `src/payload/collections/PlannerRecipes.ts`
  - `src/lib/db.ts`
  - `src/app/(frontend)/page.tsx`
  - `src/app/(frontend)/planner/page.tsx`
  - `src/app/(frontend)/history/page.tsx`
  - `src/app/(frontend)/recipes/page.tsx`
  - `src/app/api/recipes/route.ts`
- What changed:
  - Reverted previously added frontend recipe filter page and API route (`/recipes`, `/api/recipes`) plus related navigation entries.
  - Kept filter behavior in Payload Dashboard list view only by using `planner-recipes.category` select field (`Filter`) with options `大荤` / `小荤` / `素菜`.
  - Added `index: true` to `planner-recipes.category` so the field is available and performant in Admin `Add Filter` usage.
- Why:
  - User explicitly requested rollback of frontend-side filters and requested filter placement in Dashboard list filter area.
- Verification:
  - `npm run lint` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx`)
  - `npm run build` (pass)

### 2026-03-16 - Entry 23 - Home recipe library now reads Dashboard data
- Type: feature
- Status: active
- Files:
  - `src/payload/collections/PlannerRecipes.ts`
  - `src/app/(frontend)/recipes/page.tsx`
  - `src/app/(frontend)/page.tsx`
- What changed:
  - Restored home-page entry to `菜谱库` and re-added frontend route `/recipes`.
  - `/recipes` now fetches data directly from Payload collection endpoint `/api/planner-recipes` (Dashboard data source), including category filters (`大荤` / `小荤` / `素菜`).
  - Enabled public read access for `planner-recipes` collection so frontend can read uploaded Dashboard records without custom local data route.
- Why:
  - User requires recipe library on home page and wants frontend data to come from Dashboard uploads instead of local static data sources.
- Verification:
  - `curl http://localhost:1040/api/planner-recipes?limit=2&depth=0` (200, returns docs)
  - `curl http://localhost:1040/api/planner-recipes?...where[category][equals]=big-meat` (returns filtered docs)
  - `npm run lint` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx`)
  - `npm run build` (pass)

### 2026-03-16 - Entry 24 - Login system with admin/user roles
- Type: feature
- Status: active
- Files:
  - `package.json`
  - `package-lock.json`
  - `src/payload/collections/PlannerUsers.ts`
  - `src/lib/payload/client.ts`
  - `src/lib/auth/index.ts`
  - `src/lib/auth/require-user.ts`
  - `src/app/api/auth/[...nextauth]/route.ts`
  - `src/app/api/weekly-menus/route.ts`
  - `src/app/api/weekly-menus/[id]/route.ts`
  - `src/app/(frontend)/login/page.tsx`
  - `src/app/(frontend)/login/LoginContent.tsx`
  - `src/app/(frontend)/page.tsx`
  - `src/proxy.ts`
  - `src/payload/collections/PlannerRecipes.ts`
- What changed:
  - Added NextAuth credentials login for `planner-users`, with JWT session and custom session payload (`id`, `role`).
  - Extended `planner-users` collection to support login fields (`username`, password hashing via `passwordInput`, `password`, role select `ADMIN`/`USER`) and restricted collection management to Dashboard-authenticated admins.
  - Added frontend `/login` page and middleware proxy redirect for unauthenticated access to app pages.
  - Protected weekly menu APIs with auth checks (`requireLogin`) returning `401` for unauthenticated requests.
  - Kept recipe library data source on Payload Dashboard records and aligned access so frontend can still read recipe docs.
- Why:
  - User requested a login system aligned with bubu-log style and explicit account types: administrator and user.
  - Centralizing user credentials/roles in Payload allows admin-side user management and frontend/API auth consistency.
- Verification:
  - `curl http://localhost:1040/` (307 redirect to `/login` when not logged in)
  - `curl http://localhost:1040/login` (200)
  - `curl http://localhost:1040/api/auth/providers` (returns credentials provider)
  - `curl http://localhost:1040/api/weekly-menus?limit=1` (401 `UNAUTHORIZED` when not logged in)
  - `npm run lint` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx`)
  - `npm run build` (pass)

### 2026-03-16 - Entry 25 - User registration flow
- Type: feature
- Status: active
- Files:
  - `src/app/api/auth/register/route.ts`
  - `src/app/(frontend)/register/page.tsx`
  - `src/app/(frontend)/register/RegisterContent.tsx`
  - `src/app/(frontend)/login/LoginContent.tsx`
  - `src/proxy.ts`
  - `src/payload/collections/PlannerUsers.ts`
- What changed:
  - Added public `POST /api/auth/register` endpoint for creating `planner-users` with default role `USER`.
  - Added `/register` page and registration form (username, name, optional userId, password, confirm password), and auto-login after successful registration.
  - Added login-page link to registration page and allowed `/register` in proxy public routes.
  - Kept role model consistent with login system: `ADMIN` / `USER`.
- Why:
  - User requested explicit registration capability in addition to login.
- Verification:
  - `curl http://localhost:1040/register` (200)
  - `curl -X POST http://localhost:1040/api/auth/register ...` (201, returns created user)
  - `curl http://localhost:1040/` (307 to `/login` when unauthenticated)
  - `npm run lint` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx`)
  - `npm run build` (pass)

### 2026-03-16 - Entry 26 - Rename app to weekly-menu and unify naming
- Type: refactor
- Status: active
- Files:
  - `AGENTS.md`
  - `apps/weekly-menu/package.json`
  - `apps/weekly-menu/package-lock.json`
  - `apps/weekly-menu/README.md`
  - `apps/weekly-menu/AI_PROJECT_LOG.md`
  - `apps/weekly-menu/payload.config.ts`
  - `apps/weekly-menu/src/lib/auth/index.ts`
  - `apps/weekly-menu/src/lib/weekly-menu/generator.ts`
  - `apps/weekly-menu/src/app/(frontend)/planner/page.tsx`
  - `apps/weekly-menu/scripts/seed-planner-recipes.mjs`
  - directory rename: old app path -> `apps/weekly-menu`
  - module rename: old lib module path -> `apps/weekly-menu/src/lib/weekly-menu`
- What changed:
  - Renamed the app folder to `apps/weekly-menu` and unified naming across code, docs, configs, and secrets.
  - Updated internal import paths and script file references to `lib/weekly-menu`.
  - Updated repository agent rules to point to `apps/weekly-menu/AI_PROJECT_LOG.md`.
- Why:
  - User requested unified naming across the repository with `weekly-menu` as the canonical app name.
- Verification:
  - repository-wide naming search confirms canonical `weekly-menu` naming is applied
  - `npm run lint` in `apps/weekly-menu` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx`)
  - `npm run build` in `apps/weekly-menu` (pass)

### 2026-03-16 - Entry 27 - Registration stuck fix and auth path optimization
- Type: fix
- Status: active
- Files:
  - `src/app/(frontend)/register/RegisterContent.tsx`
  - `src/app/(frontend)/login/LoginContent.tsx`
  - `src/app/api/auth/register/route.ts`
  - `src/lib/auth/index.ts`
  - `src/lib/payload-db.ts`
- What changed:
  - Reworked registration UX to avoid indefinite pending state: added request timeout guard and changed post-register flow to redirect to login page (instead of immediate auto sign-in).
  - Replaced slow Payload-SDK based register/login DB lookups with direct PostgreSQL queries on `planner_users` for critical auth path.
  - Added payload DB pool helper (`payload-db.ts`) to use `PAYLOAD_DATABASE_URL` (fallback to existing DB envs).
- Why:
  - User observed registration page stuck at `注册中...` due very slow backend auth operations.
  - Direct SQL path avoids heavy Payload runtime overhead during register/login requests.
- Verification:
  - `curl -X POST http://localhost:1040/api/auth/register ...` (201, returns created user)
  - `npm run lint` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx`)
  - `npm run build` (pass)

### 2026-03-16 - Entry 28 - Per-user history isolation in database
- Type: feature
- Status: active
- Files:
  - `src/lib/db.ts`
  - `src/app/api/weekly-menus/route.ts`
  - `src/app/api/weekly-menus/[id]/route.ts`
- What changed:
  - Added `user_id` ownership to `weekly_menus` persistence path and created index for `(user_id, created_at)`.
  - Updated menu CRUD data-layer methods to require `userId` and scope all list/get/update/delete queries to current user.
  - Updated weekly menu API handlers to pass authenticated `user.id` into DB operations so each user only accesses their own history.
- Why:
  - User requested that history be stored in database per user instead of shared globally across frontend sessions.
- Verification:
  - SQL migration step run locally to ensure `weekly_menus.user_id` column and index exist.
  - `npm run lint` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx`)
  - `npm run build` (pass)

### 2026-03-16 - Entry 29 - Split AGENTS rules by project scope
- Type: docs
- Status: active
- Files:
  - `AGENTS.md`
  - `apps/weekly-menu/AGENTS.md`
- What changed:
  - Simplified root `AGENTS.md` to cross-project defaults only.
  - Moved weekly-menu specific instructions into `apps/weekly-menu/AGENTS.md`.
- Why:
  - Avoid rule conflicts as more projects add their own AGENTS files.
  - Keep project-specific automation and logging requirements isolated.
- Verification:
  - Confirmed root file now points to per-project rule locations.
  - Confirmed weekly-menu specific rules exist in `apps/weekly-menu/AGENTS.md`.

### 2026-03-16 - Entry 30 - Expose weekly history in Dashboard
- Type: feature
- Status: active
- Files:
  - `payload.config.ts`
  - `src/payload/collections/WeeklyHistory.ts`
- What changed:
  - Added Payload collection `weekly-history` mapped to existing `weekly_menus` table (`dbName: 'weekly_menus'`).
  - Added Dashboard labels/columns so past menu records are visible in Admin as `过往数据`.
  - Registered `WeeklyHistory` in Payload config collections list.
- Why:
  - User requested past data to be visible inside Dashboard instead of only API/database layer.
- Verification:
  - `npm run lint` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx`)
  - `npm run build` (pass)

### 2026-03-16 - Entry 31 - Remove weekly history from Dashboard
- Type: refactor
- Status: active
- Files:
  - `payload.config.ts`
  - `src/payload/collections/WeeklyHistory.ts`
- What changed:
  - Removed `weekly-history` collection registration from Payload config.
  - Deleted `WeeklyHistory` collection file so past menu data is no longer shown in Dashboard.
- Why:
  - User requested that Dashboard should not display past history data.
- Verification:
  - `npm run lint` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx`)
  - `npm run build` (pass)

### 2026-03-16 - Entry 32 - Shared navigation with recipes link
- Type: ux
- Status: active
- Files:
  - `src/app/(frontend)/FrontendNav.tsx`
  - `src/app/(frontend)/layout.tsx`
  - `src/app/(frontend)/planner/page.tsx`
  - `src/app/(frontend)/history/page.tsx`
- What changed:
  - Added a shared top navigation bar for frontend pages with links: 主页 / 菜单 / 过往 / 菜谱库.
  - Hidden shared navigation on `/login` and `/register` to keep auth pages focused.
  - Added `菜谱库` shortcut into planner and history quick navigation menus.
- Why:
  - User requested recipes library navigation to be available across pages.
- Verification:
  - `npm run lint` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx`)
  - `npm run build` (pass)

### 2026-03-16 - Entry 33 - Use existing quick-nav style for recipes page
- Type: ux
- Status: active
- Files:
  - `src/app/(frontend)/layout.tsx`
  - `src/app/(frontend)/FrontendNav.tsx`
  - `src/app/(frontend)/recipes/page.tsx`
- What changed:
  - Reverted newly added shared top navigation bar from frontend layout.
  - Removed `FrontendNav` component file.
  - Added planner/history-style quick navigation menu (hamburger dropdown) to recipes page with routes to 主页面 / 菜单制定 / 过往数据.
- Why:
  - User requested reusing the existing navigation style from menu-planner pages instead of introducing a new global nav pattern.
- Verification:
  - `npm run lint` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx`)
  - `npm run build` (pass)

### 2026-03-16 - Entry 34 - Restrict recipes page navigation options
- Type: ux
- Status: active
- Files:
  - `src/app/(frontend)/recipes/page.tsx`
- What changed:
  - Removed `菜单制定` entry from recipes quick navigation dropdown.
  - Removed recipes page top-right `返回主页` button.
- Why:
  - User requires menu planner entry to be accessible only from home page.
  - User requested removing standalone return-home button from recipes page.
- Verification:
  - `npm run lint` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx`)
  - `npm run build` (pass)

### 2026-03-16 - Entry 35 - User recipe upload and admin review publish flow
- Type: feature
- Status: active
- Files:
  - `payload.config.ts`
  - `src/lib/user-recipes-db.ts`
  - `src/app/api/user-recipes/route.ts`
  - `src/payload/collections/UserRecipeSubmissions.ts`
  - `src/app/(frontend)/recipes/page.tsx`
  - `src/lib/weekly-menu/generator.ts`
  - `src/app/(frontend)/planner/page.tsx`
- What changed:
  - Added per-user recipe submissions storage (`user_recipe_submissions`) with status workflow (`pending` / `approved` / `rejected`) and API endpoints for users to upload/list their own recipes.
  - Added Dashboard collection `user-recipe-submissions` for admin review, with hook-based auto publish: when admin marks submission as `approved`, recipe is inserted into `planner_recipes` public library (deduplicated by `name + category`).
  - Updated recipes page with upload form and merged listing of public recipes + current user's submissions (including review status badges and rejection note).
  - Updated planner generation/replacement logic to include current user's usable uploaded recipes (pending/approved) so users can self-use immediately before global approval.
- Why:
  - User requested a full user-upload -> admin-review -> public publish workflow while preserving private immediate usability.
- Verification:
  - `npm run lint` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx`)
  - `npm run build` (pass)
  - Route list includes new endpoint: `/api/user-recipes`

### 2026-03-16 - Entry 36 - Move upload to home and enforce duplicate-name rejection
- Type: feature
- Status: active
- Files:
  - `src/app/(frontend)/page.tsx`
  - `src/app/(frontend)/recipes/page.tsx`
  - `src/lib/user-recipes-db.ts`
  - `src/app/api/user-recipes/route.ts`
- What changed:
  - Moved "upload recipe" entry form from recipes page to home page.
  - Removed upload form logic from recipes page; recipes page remains browse/filter only.
  - Added duplicate-name guard when uploading: if recipe name already exists in public library or current user's self-use set (pending/approved uploads), request is rejected.
- Why:
  - User requested upload入口放在主页面.
  - User required duplicate names (public + self-use) to be disallowed.
- Verification:
  - `npm run lint` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx`)
  - `npm run build` (pass)

### 2026-03-16 - Entry 37 - Deployment setup aligned with bubu-log
- Type: platform
- Status: active
- Files:
  - `vercel.json`
  - `package.json`
  - `scripts/vercel-build.sh`
  - `scripts/bootstrap-db.mjs`
  - `payload.config.ts`
  - `README.md`
- What changed:
  - Added `vercel.json` with monorepo-safe `ignoreCommand` (same style as bubu-log).
  - Switched build script to `bash scripts/vercel-build.sh` and added optional pre-build DB bootstrap toggle (`RUN_DB_BOOTSTRAP_ON_BUILD=1`).
  - Added `db:bootstrap` script and SQL bootstrap file to ensure custom tables/indexes exist on deploy.
  - Added Postgres SSL mode normalization (`sslmode=require` -> `sslmode=verify-full`) in payload config, matching bubu-log deployment behavior.
  - Added production deployment runbook and required env vars to README.
- Why:
  - User requested moving from local-only usage to production deployment, and asked to align with bubu-log deployment approach.
- Verification:
  - `npm run lint` (pass with 1 existing warning in `src/app/(frontend)/layout.tsx`)
  - `npm run build` (pass via `scripts/vercel-build.sh`)

### 2026-03-16 - Entry 38 - Weekly-menu PR preview action with stable test links
- Type: ci
- Status: active
- Files:
  - `.github/workflows/weekly-menu-e2b-preview.yml`
  - `.github/workflows/e2b-preview.yml`
  - `.github/scripts/e2b-preview.mjs`
  - `README.md`
- What changed:
  - Added weekly-menu specific E2B PR preview workflow that comments preview test links on PRs.
  - Added path scoping + per-PR concurrency to reduce stale/outdated preview comments.
  - Updated preview script to support app-specific configuration via env vars (`E2B_PNPM_FILTERS`, commands, `E2B_PREVIEW_PURPOSE`) and force checkout by `PR_HEAD_SHA`.
  - Isolated sandbox metadata between bubu-log and weekly-menu workflows to prevent cross-workflow sandbox cleanup collisions.
  - Documented required secrets/variables for generating weekly-menu PR preview links.
- Why:
  - User requested same PR test-link style as referenced bubu-log comment and asked to update GitHub Action config accordingly.
  - Reliability fixes were required to avoid wrong-SHA previews and sandbox conflicts.
- Verification:
  - `node --check .github/scripts/e2b-preview.mjs` (pass)
  - Workflow grep checks confirm `paths`, `concurrency`, and `E2B_PREVIEW_PURPOSE` are present in weekly-menu preview workflow.

## 4) Current Known State / Open Items

- Frontend features and REST API are working and build successfully.
- Payload admin code path is integrated, but first-run schema initialization must complete against `PAYLOAD_DATABASE_URL`.
- Recommended setup: keep business data in `DATABASE_URL` and use separate DB for `PAYLOAD_DATABASE_URL`.
- During first schema push, choose `create table` (never rename `weekly_menus`).

## 5) Mandatory Update Rule for Future AI Sessions

After every functional/code change in `apps/weekly-menu`, AI must append one new entry to this file.

Required entry format:

```md
### YYYY-MM-DD - Entry NN - <short title>
- Type: feature|fix|refactor|ux|tooling|platform|docs
- Status: active|reverted|partial
- Files:
  - path/a
  - path/b
- What changed:
  - bullet
  - bullet
- Why:
  - bullet
- Verification:
  - npm run lint (result)
  - npm run build (result)
```

## 6) Quick Start for Next AI

- Read this file first: `apps/weekly-menu/AI_PROJECT_LOG.md`
- Then inspect:
  - `apps/weekly-menu/src/app/(frontend)/planner/page.tsx`
  - `apps/weekly-menu/src/app/api/weekly-menus/route.ts`
  - `apps/weekly-menu/src/app/api/weekly-menus/[id]/route.ts`
  - `apps/weekly-menu/payload.config.ts`
