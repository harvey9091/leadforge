-- CreateTable
CREATE TABLE "FreeLLMConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "apiKeyEnc" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT 'default',
    "temperature" REAL NOT NULL DEFAULT 0.3,
    "maxTokens" INTEGER NOT NULL DEFAULT 4000,
    "timeout" INTEGER NOT NULL DEFAULT 60000,
    "streaming" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("id")
);
