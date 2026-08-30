-- CreateTable
CREATE TABLE "PatientProfile" (
    "userId" INTEGER NOT NULL PRIMARY KEY,
    "age" INTEGER,
    "gender" TEXT,
    "diagnosis" TEXT,
    "caseNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PatientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
