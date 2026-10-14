-- Apply to production Turso once, after 2026-10-14-add-events.sql:
-- turso db shell bzfitness < prisma/turso/2026-10-14-add-event-is-public.sql
ALTER TABLE "Event" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;
