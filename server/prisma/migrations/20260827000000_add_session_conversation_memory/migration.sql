-- Persist a patient-facing continuity summary for each completed training session.
ALTER TABLE "TrainingSession" ADD COLUMN "previousConversationMemoryJson" TEXT;

CREATE TABLE "SessionConversationMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "model" TEXT,
    "promptVersion" TEXT,
    "inputJson" TEXT,
    "resultJson" TEXT,
    "errorMessage" TEXT,
    "generatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SessionConversationMemory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SessionConversationMemory_sessionId_key" ON "SessionConversationMemory"("sessionId");
CREATE INDEX "SessionConversationMemory_status_createdAt_idx" ON "SessionConversationMemory"("status", "createdAt");
