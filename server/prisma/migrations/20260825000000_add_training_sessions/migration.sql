-- Keep authentication sessions separate from durable training records.
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "metadataJson" TEXT,
    "metricsJson" TEXT,
    "nextGameRunSequence" INTEGER NOT NULL DEFAULT 1,
    "nextConversationSequence" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "GameRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "gameCode" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "configSnapshotJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GameRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "GameRunQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameRunId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "sourceQuestionId" INTEGER,
    "questionType" TEXT NOT NULL,
    "clientPayloadJson" TEXT NOT NULL,
    "answerJson" TEXT NOT NULL,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameRunQuestion_gameRunId_fkey" FOREIGN KEY ("gameRunId") REFERENCES "GameRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "GameAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameRunQuestionId" TEXT NOT NULL,
    "answerJson" TEXT,
    "outcome" TEXT NOT NULL,
    "responseTimeMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameAttempt_gameRunQuestionId_fkey" FOREIGN KEY ("gameRunQuestionId") REFERENCES "GameRunQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "InteractionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "gameRunId" TEXT,
    "clientEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "dataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InteractionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InteractionEvent_gameRunId_fkey" FOREIGN KEY ("gameRunId") REFERENCES "GameRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ConversationTurn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT 'CHAT',
    "content" TEXT NOT NULL,
    "inputMethod" TEXT,
    "responseLatencyMs" INTEGER,
    "isUserInitiated" BOOLEAN NOT NULL DEFAULT false,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SessionSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "promptVersion" TEXT,
    "inputJson" TEXT,
    "resultJson" TEXT,
    "errorMessage" TEXT,
    "generatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SessionSummary_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CareAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicianId" INTEGER NOT NULL,
    "patientId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CareAssignment_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CareAssignment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "TrainingSession_userId_startedAt_idx" ON "TrainingSession"("userId", "startedAt");
CREATE INDEX "TrainingSession_status_startedAt_idx" ON "TrainingSession"("status", "startedAt");
CREATE UNIQUE INDEX "GameRun_sessionId_sequence_key" ON "GameRun"("sessionId", "sequence");
CREATE INDEX "GameRun_sessionId_gameCode_idx" ON "GameRun"("sessionId", "gameCode");
CREATE UNIQUE INDEX "GameRunQuestion_gameRunId_position_key" ON "GameRunQuestion"("gameRunId", "position");
CREATE INDEX "GameRunQuestion_gameRunId_sourceQuestionId_idx" ON "GameRunQuestion"("gameRunId", "sourceQuestionId");
CREATE INDEX "GameAttempt_gameRunQuestionId_createdAt_idx" ON "GameAttempt"("gameRunQuestionId", "createdAt");
CREATE UNIQUE INDEX "InteractionEvent_sessionId_clientEventId_key" ON "InteractionEvent"("sessionId", "clientEventId");
CREATE INDEX "InteractionEvent_sessionId_occurredAt_idx" ON "InteractionEvent"("sessionId", "occurredAt");
CREATE INDEX "InteractionEvent_gameRunId_occurredAt_idx" ON "InteractionEvent"("gameRunId", "occurredAt");
CREATE UNIQUE INDEX "ConversationTurn_sessionId_sequence_key" ON "ConversationTurn"("sessionId", "sequence");
CREATE INDEX "ConversationTurn_sessionId_createdAt_idx" ON "ConversationTurn"("sessionId", "createdAt");
CREATE UNIQUE INDEX "SessionSummary_sessionId_key" ON "SessionSummary"("sessionId");
CREATE INDEX "SessionSummary_status_createdAt_idx" ON "SessionSummary"("status", "createdAt");
CREATE UNIQUE INDEX "CareAssignment_clinicianId_patientId_key" ON "CareAssignment"("clinicianId", "patientId");
CREATE INDEX "CareAssignment_patientId_status_idx" ON "CareAssignment"("patientId", "status");
