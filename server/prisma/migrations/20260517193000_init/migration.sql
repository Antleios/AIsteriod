-- CreateTable
CREATE TABLE "ObjectNamingQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "prompt" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "hint" TEXT,
    "assetType" TEXT NOT NULL DEFAULT 'emoji',
    "assetValue" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmojiMatchQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "prompt" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "assetType" TEXT NOT NULL DEFAULT 'emoji',
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "optionsJson" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ColorLineConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL DEFAULT 'default',
    "title" TEXT NOT NULL,
    "dailyGoal" INTEGER NOT NULL,
    "description" TEXT,
    "totalPairs" INTEGER NOT NULL DEFAULT 5,
    "paletteJson" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ColorLineConfig_key_key" ON "ColorLineConfig"("key");
