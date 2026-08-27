-- Durable audit and idempotency records for patient-facing LLM interactions.
CREATE TABLE "AiInteraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "gameRunId" TEXT,
    "trigger" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "requestJson" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "promptVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resultJson" TEXT,
    "errorMessage" TEXT,
    "userTurnId" TEXT,
    "assistantTurnId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiInteraction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AiInteraction_sessionId_clientRequestId_key" ON "AiInteraction"("sessionId", "clientRequestId");
CREATE INDEX "AiInteraction_sessionId_createdAt_idx" ON "AiInteraction"("sessionId", "createdAt");
CREATE INDEX "AiInteraction_status_createdAt_idx" ON "AiInteraction"("status", "createdAt");
