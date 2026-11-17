ALTER TABLE "Pin" ADD COLUMN "pageRoute" TEXT NOT NULL DEFAULT '/';
ALTER TABLE "Pin" ADD COLUMN "pinNumber" INTEGER NOT NULL DEFAULT 0;

WITH RECURSIVE
  tails("id", "tail") AS (
    SELECT "id",
      CASE
        WHEN instr("reviewedUrl", '://') > 0
          THEN substr("reviewedUrl", instr("reviewedUrl", '://') + 3)
        ELSE "reviewedUrl"
      END
    FROM "Pin"
  ),
  paths("id", "path") AS (
    SELECT "id",
      CASE WHEN instr("tail", '/') = 0 THEN '/'
        ELSE substr("tail", instr("tail", '/'))
      END
    FROM tails
  ),
  collapsed("id", "path") AS (
    SELECT "id", "path" FROM paths
    UNION ALL
    SELECT "id", replace("path", '//', '/')
    FROM collapsed WHERE instr("path", '//') > 0
  ),
  canonical("id", "route") AS (
    SELECT "id",
      CASE
        WHEN rtrim(substr("path", 1, min(
          coalesce(nullif(instr("path", '?'), 0), length("path") + 1),
          coalesce(nullif(instr("path", '#'), 0), length("path") + 1)
        ) - 1), '/') = '' THEN '/'
        ELSE rtrim(substr("path", 1, min(
          coalesce(nullif(instr("path", '?'), 0), length("path") + 1),
          coalesce(nullif(instr("path", '#'), 0), length("path") + 1)
        ) - 1), '/')
      END
    FROM collapsed WHERE instr("path", '//') = 0
  )
UPDATE "Pin"
SET "pageRoute" = (
  SELECT "route" FROM canonical WHERE canonical."id" = "Pin"."id"
);

WITH numbered("id", "number") AS (
  SELECT "id", row_number() OVER (PARTITION BY "canvasId" ORDER BY "createdAt", "id")
  FROM "Pin"
)
UPDATE "Pin"
SET "pinNumber" = (SELECT "number" FROM numbered WHERE numbered."id" = "Pin"."id");

DROP INDEX IF EXISTS "Pin_canvasId_status_createdAt_idx";
CREATE UNIQUE INDEX "Pin_canvasId_pinNumber_key" ON "Pin"("canvasId", "pinNumber");
CREATE INDEX "Pin_canvasId_pageRoute_status_pinNumber_idx"
  ON "Pin"("canvasId", "pageRoute", "status", "pinNumber");
