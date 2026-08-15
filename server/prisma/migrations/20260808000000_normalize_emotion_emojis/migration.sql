-- CreateTable
CREATE TABLE "EmotionEmoji" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "displayValue" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Preserve the current emoji bank as individually stored records.
INSERT INTO "EmotionEmoji"
    ("code", "label", "displayValue", "difficulty", "isActive", "updatedAt")
VALUES
    ('happy', '开心', '😊', 1, true, CURRENT_TIMESTAMP),
    ('sad', '悲伤', '😢', 1, true, CURRENT_TIMESTAMP),
    ('angry', '愤怒', '😡', 1, true, CURRENT_TIMESTAMP),
    ('afraid', '害怕', '😨', 1, true, CURRENT_TIMESTAMP),
    ('sleepy', '困倦', '😴', 1, true, CURRENT_TIMESTAMP),
    ('anxious', '焦虑', '😰', 1, true, CURRENT_TIMESTAMP),
    ('crying', '大哭', '😭', 1, true, CURRENT_TIMESTAMP),
    ('thinking', '思考', '🤔', 1, true, CURRENT_TIMESTAMP),
    ('laughing', '大笑', '😂', 1, true, CURRENT_TIMESTAMP),
    ('bored', '无聊', '😑', 1, true, CURRENT_TIMESTAMP),
    ('surprised', '惊讶', '😲', 1, true, CURRENT_TIMESTAMP);

-- DropTable
DROP TABLE "EmojiMatchQuestion";

-- CreateIndex
CREATE UNIQUE INDEX "EmotionEmoji_code_key" ON "EmotionEmoji"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EmotionEmoji_displayValue_key" ON "EmotionEmoji"("displayValue");

-- CreateIndex
CREATE INDEX "EmotionEmoji_isActive_difficulty_idx" ON "EmotionEmoji"("isActive", "difficulty");
