-- AlterTable
ALTER TABLE "users" ALTER COLUMN "theme_key" SET DEFAULT 'boring-grey';

-- Data backfill for existing default theme
UPDATE "users"
SET "theme_key" = 'boring-grey'
WHERE "theme_key" = 'sunset';
