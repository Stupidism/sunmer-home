# Wedding Invite v2 Architecture Notes

## Decisions

- Replace custom admin UI with Payload CMS admin (`/admin` route group).
- Replace custom SQL RSVP persistence with Payload collections + Local API.
- Keep public invitation page UX and RSVP confirmation flow.
- Keep deployment direction aligned to E2B preview workflow (not Vercel preview).

## Core Collections

- `cms-admins`: Payload admin auth users.
- `guests`: Guest profile and relationship metadata.
- `invitations`: Per-guest invitation metadata (`inviteCode`, `maxGuestCount`, custom opening).
- `rsvps`: RSVP submissions linked to `guest` and `invitation`.

## Guest Relationship Fields

- `relationshipCategory`: friend, classmate, junior/high school classmate, relative, colleague, other.
- `relationshipSide`: bride, groom, groom_father, groom_mother, bride_father, bride_mother, groom_family, bride_family, both, other.
- `relationshipNote`: free-text clarification.
- `memorySnippet`: short memory paragraph for personalized invitation copy.

## Migration Surface

- Removed legacy admin page and SQL helper module.
- Added Payload route group:
  - `src/app/(payload)/admin/[[...segments]]/page.tsx`
  - `src/app/(payload)/api/[...slug]/route.ts`
  - `src/app/(payload)/api/graphql/route.ts`
  - `src/app/(payload)/layout.tsx`
- `src/app/api/rsvp/route.ts` now writes and reads through Payload Local API.

## Remaining Follow-ups

- Add invitation token verification and rate limiting for public RSVP endpoint.
- Add media collection/upload strategy to replace Vercel Blob-specific flow.
- Add migration scripts and seed data for initial admin/guest bootstrap.

## Security Notes (Implemented)

- Public `GET /api/rsvp` disabled to avoid leaking RSVP PII.
- Public RSVP submit now requires valid `inviteCode` and enforces `maxGuestCount`.
- Duplicate RSVP on same invitation now updates existing response instead of creating unlimited records.
- Payload GraphQL playground (`GET /api/graphql`) disabled in production.
- Upload endpoint now requires `x-upload-token` matching `UPLOAD_API_TOKEN`.
- First CMS admin bootstrap is gated by `ALLOW_ADMIN_BOOTSTRAP=true`.
