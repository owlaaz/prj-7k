-- CreateTable
CREATE TABLE "Planning" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL DEFAULT 'Untitled plan',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "parentId" INTEGER,
    "data" TEXT NOT NULL,
    "result" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Planning_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Planning" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
