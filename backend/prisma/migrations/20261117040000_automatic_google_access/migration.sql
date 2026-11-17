-- Google verification is the only admission step. Preserve existing teams and projects.
INSERT OR IGNORE INTO "Organization" ("id", "name")
SELECT 'personal-' || u."id", 'Espacio de ' || u."displayName"
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "OrganizationMembership" m WHERE m."userId" = u."id");

INSERT OR IGNORE INTO "OrganizationMembership" ("id", "userId", "organizationId", "status")
SELECT 'membership-' || u."id", u."id", 'personal-' || u."id", 'approved'
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "OrganizationMembership" m WHERE m."userId" = u."id");

-- Kept for storage/API compatibility; this field no longer controls access.
UPDATE "OrganizationMembership" SET "status" = 'approved';
