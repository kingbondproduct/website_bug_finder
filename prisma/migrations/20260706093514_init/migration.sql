-- CreateTable
CREATE TABLE "CrawlJobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "rootDomain" TEXT NOT NULL,
    "seedUrls" TEXT NOT NULL,
    "maxDepth" INTEGER NOT NULL DEFAULT 1,
    "maxPages" INTEGER NOT NULL DEFAULT 60,
    "pagesDiscovered" INTEGER NOT NULL DEFAULT 0,
    "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
    "bugsFound" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME
);

-- CreateTable
CREATE TABLE "PagesDiscovered" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "crawlJobId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "discoveredFrom" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "httpStatus" INTEGER,
    "loadTimeMs" INTEGER,
    "desktopScreenshot" TEXT,
    "mobileScreenshot" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PagesDiscovered_crawlJobId_fkey" FOREIGN KEY ("crawlJobId") REFERENCES "CrawlJobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BugsFound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "crawlJobId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "viewport" TEXT NOT NULL,
    "evidence" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BugsFound_crawlJobId_fkey" FOREIGN KEY ("crawlJobId") REFERENCES "CrawlJobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BugsFound_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "PagesDiscovered" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PagesDiscovered_crawlJobId_status_idx" ON "PagesDiscovered"("crawlJobId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PagesDiscovered_crawlJobId_url_key" ON "PagesDiscovered"("crawlJobId", "url");

-- CreateIndex
CREATE INDEX "BugsFound_crawlJobId_category_severity_idx" ON "BugsFound"("crawlJobId", "category", "severity");
