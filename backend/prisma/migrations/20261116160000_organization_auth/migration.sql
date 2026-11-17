CREATE TABLE "Organization" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL);
CREATE TABLE "User" ("id" TEXT NOT NULL PRIMARY KEY, "googleSub" TEXT NOT NULL, "email" TEXT NOT NULL, "displayName" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");
CREATE TABLE "OrganizationMembership" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending', CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE UNIQUE INDEX "OrganizationMembership_userId_key" ON "OrganizationMembership"("userId");
CREATE INDEX "OrganizationMembership_organizationId_status_idx" ON "OrganizationMembership"("organizationId", "status");
ALTER TABLE "Canvas" ADD COLUMN "organizationId" TEXT REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Canvas_organizationId_idx" ON "Canvas"("organizationId");
