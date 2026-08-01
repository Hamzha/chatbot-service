/**
 * Integration tests for `crawlJobRepo` against an in-memory MongoDB.
 *
 * Covers the full lifecycle of a crawl job: create → running → visiting →
 * done/failed urls → ingested pages → terminal state; plus stale-job
 * reconciliation and user-scoping.
 */
import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { setupMongoTestEnv } from "@/lib/testing/mongo";
import {
    appendIngestedPage,
    appendVisitingUrl,
    createCrawlJob,
    CrawlJobModel,
    getCrawlJob,
    listCrawlJobsForUser,
    markCrawlJobCompleted,
    markCrawlJobFailed,
    markCrawlJobRunning,
    markStaleRunningJobsFailed,
    markUrlDone,
    markUrlFailed,
} from "@/lib/db/crawlJobRepo";

setupMongoTestEnv();

function newUserId(): string {
    return new Types.ObjectId().toString();
}

const BASE_INPUT = {
    startUrl: "https://example.com/",
    mode: "auto",
    maxPages: 10,
    maxDepth: 2,
};

describe("crawlJobRepo — createCrawlJob", () => {
    it("creates a queued job with a valid ObjectId and default counters", async () => {
        const userId = newUserId();
        const job = await createCrawlJob(userId, BASE_INPUT);

        expect(Types.ObjectId.isValid(job.id)).toBe(true);
        expect(job.userId).toBe(userId);
        expect(job.state).toBe("queued");
        expect(job.doneCount).toBe(0);
        expect(job.failedCount).toBe(0);
        expect(job.urls).toEqual([]);
        expect(job.ingestedPages).toEqual([]);
        expect(job.startedAt).toBeUndefined();
        expect(job.finishedAt).toBeUndefined();
    });

    it("trims startUrl", async () => {
        const userId = newUserId();
        const job = await createCrawlJob(userId, {
            ...BASE_INPUT,
            startUrl: "   https://trim.me/   ",
        });
        expect(job.startUrl).toBe("https://trim.me/");
    });
});

describe("crawlJobRepo — getCrawlJob", () => {
    it("returns null for an invalid jobId (not a hex ObjectId)", async () => {
        const userId = newUserId();
        const job = await getCrawlJob(userId, "not-an-object-id");
        expect(job).toBeNull();
    });

    it("returns null when job belongs to a different user", async () => {
        const ownerId = newUserId();
        const strangerId = newUserId();
        const job = await createCrawlJob(ownerId, BASE_INPUT);

        const fetched = await getCrawlJob(strangerId, job.id);
        expect(fetched).toBeNull();
    });

    it("returns the job when queried by its owner", async () => {
        const userId = newUserId();
        const job = await createCrawlJob(userId, BASE_INPUT);

        const fetched = await getCrawlJob(userId, job.id);
        expect(fetched).not.toBeNull();
        expect(fetched!.id).toBe(job.id);
    });
});

describe("crawlJobRepo — listCrawlJobsForUser", () => {
    it("returns an empty list when the user has no jobs", async () => {
        const userId = newUserId();
        const jobs = await listCrawlJobsForUser(userId);
        expect(jobs).toEqual([]);
    });

    it("returns jobs in reverse-chronological order, scoped to the user", async () => {
        const userA = newUserId();
        const userB = newUserId();
        const first = await createCrawlJob(userA, { ...BASE_INPUT, startUrl: "https://a.com/1" });
        // Small pause to guarantee a distinct createdAt timestamp.
        await new Promise((r) => setTimeout(r, 10));
        const second = await createCrawlJob(userA, { ...BASE_INPUT, startUrl: "https://a.com/2" });
        await createCrawlJob(userB, BASE_INPUT);

        const jobs = await listCrawlJobsForUser(userA);
        expect(jobs.map((j) => j.id)).toEqual([second.id, first.id]);
    });

    it("clamps the limit argument between 1 and 100", async () => {
        const userId = newUserId();
        for (let i = 0; i < 3; i++) {
            await createCrawlJob(userId, { ...BASE_INPUT, startUrl: `https://x.com/${i}` });
        }
        const jobs = await listCrawlJobsForUser(userId, 0); // should clamp to 1
        expect(jobs.length).toBe(1);
    });
});

describe("crawlJobRepo — state transitions", () => {
    it("markCrawlJobRunning flips queued → running and sets startedAt", async () => {
        const userId = newUserId();
        const job = await createCrawlJob(userId, BASE_INPUT);

        await markCrawlJobRunning(job.id);
        const after = await getCrawlJob(userId, job.id);

        expect(after!.state).toBe("running");
        expect(after!.startedAt).toBeDefined();
    });

    it("markCrawlJobRunning is a no-op when the job is not queued", async () => {
        const userId = newUserId();
        const job = await createCrawlJob(userId, BASE_INPUT);
        await markCrawlJobCompleted(job.id);

        await markCrawlJobRunning(job.id); // should not overwrite `completed`
        const after = await getCrawlJob(userId, job.id);

        expect(after!.state).toBe("completed");
    });

    it("markCrawlJobCompleted sets finishedAt and state", async () => {
        const userId = newUserId();
        const job = await createCrawlJob(userId, BASE_INPUT);

        await markCrawlJobCompleted(job.id);
        const after = await getCrawlJob(userId, job.id);

        expect(after!.state).toBe("completed");
        expect(after!.finishedAt).toBeDefined();
    });

    it("markCrawlJobFailed records the error and sets finishedAt", async () => {
        const userId = newUserId();
        const job = await createCrawlJob(userId, BASE_INPUT);

        await markCrawlJobFailed(job.id, "boom");
        const after = await getCrawlJob(userId, job.id);

        expect(after!.state).toBe("failed");
        expect(after!.error).toBe("boom");
        expect(after!.finishedAt).toBeDefined();
    });

    it("silently no-ops on invalid jobId (no throw)", async () => {
        await expect(markCrawlJobRunning("not-valid")).resolves.toBeUndefined();
        await expect(markCrawlJobCompleted("not-valid")).resolves.toBeUndefined();
        await expect(markCrawlJobFailed("not-valid", "e")).resolves.toBeUndefined();
    });
});

describe("crawlJobRepo — url rows", () => {
    it("appendVisitingUrl adds a new visiting row on first call", async () => {
        const userId = newUserId();
        const job = await createCrawlJob(userId, BASE_INPUT);

        await appendVisitingUrl(job.id, "https://example.com/a", 1);
        const after = await getCrawlJob(userId, job.id);

        expect(after!.urls).toHaveLength(1);
        expect(after!.urls[0]).toMatchObject({
            url: "https://example.com/a",
            depth: 1,
            status: "visiting",
        });
    });

    it("markUrlDone updates the row in-place and increments doneCount", async () => {
        const userId = newUserId();
        const job = await createCrawlJob(userId, BASE_INPUT);

        await appendVisitingUrl(job.id, "https://example.com/a", 1);
        await markUrlDone(job.id, "https://example.com/a", 1, 3);
        const after = await getCrawlJob(userId, job.id);

        expect(after!.urls).toHaveLength(1);
        expect(after!.urls[0].status).toBe("done");
        expect(after!.urls[0].chunks).toBe(3);
        expect(after!.doneCount).toBe(1);
    });

    it("markUrlFailed records the error and increments failedCount", async () => {
        const userId = newUserId();
        const job = await createCrawlJob(userId, BASE_INPUT);

        await appendVisitingUrl(job.id, "https://example.com/a", 1);
        await markUrlFailed(job.id, "https://example.com/a", "timeout");
        const after = await getCrawlJob(userId, job.id);

        expect(after!.urls[0].status).toBe("failed");
        expect(after!.urls[0].error).toBe("timeout");
        expect(after!.failedCount).toBe(1);
    });

    it("markUrlDone adds a new row when the url wasn't previously visited", async () => {
        const userId = newUserId();
        const job = await createCrawlJob(userId, BASE_INPUT);

        await markUrlDone(job.id, "https://example.com/orphan", 2, 5);
        const after = await getCrawlJob(userId, job.id);

        expect(after!.urls).toHaveLength(1);
        expect(after!.urls[0]).toMatchObject({
            url: "https://example.com/orphan",
            depth: 2,
            status: "done",
            chunks: 5,
        });
        expect(after!.doneCount).toBe(1);
    });

    it("markUrlFailed adds a new row when the url wasn't previously visited", async () => {
        const userId = newUserId();
        const job = await createCrawlJob(userId, BASE_INPUT);

        await markUrlFailed(job.id, "https://example.com/ghost", "404");
        const after = await getCrawlJob(userId, job.id);

        expect(after!.urls).toHaveLength(1);
        expect(after!.urls[0].status).toBe("failed");
        expect(after!.failedCount).toBe(1);
    });
});

describe("crawlJobRepo — ingested pages", () => {
    it("appendIngestedPage pushes a full page record", async () => {
        const userId = newUserId();
        const job = await createCrawlJob(userId, BASE_INPUT);

        await appendIngestedPage(job.id, {
            url: "https://example.com/a",
            displaySource: "example.com/a",
            ragSourceKey: "rag-1",
            ingested: 4,
        });

        const after = await getCrawlJob(userId, job.id);
        expect(after!.ingestedPages).toEqual([
            {
                url: "https://example.com/a",
                displaySource: "example.com/a",
                ragSourceKey: "rag-1",
                ingested: 4,
            },
        ]);
    });
});

describe("crawlJobRepo — markStaleRunningJobsFailed", () => {
    it("flips running jobs whose updatedAt is older than the cutoff", async () => {
        const userId = newUserId();
        const job = await createCrawlJob(userId, BASE_INPUT);
        await markCrawlJobRunning(job.id);

        // Manually backdate the job so it looks abandoned.
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        await CrawlJobModel.updateOne(
            { _id: new Types.ObjectId(job.id) },
            { $set: { updatedAt: tenMinutesAgo } },
            { timestamps: false },
        );

        const modified = await markStaleRunningJobsFailed(5 * 60 * 1000);
        expect(modified).toBe(1);

        const after = await getCrawlJob(userId, job.id);
        expect(after!.state).toBe("failed");
        expect(after!.error).toMatch(/Worker terminated/i);
    });

    it("leaves fresh running jobs alone", async () => {
        const userId = newUserId();
        const job = await createCrawlJob(userId, BASE_INPUT);
        await markCrawlJobRunning(job.id);

        const modified = await markStaleRunningJobsFailed(5 * 60 * 1000);
        expect(modified).toBe(0);

        const after = await getCrawlJob(userId, job.id);
        expect(after!.state).toBe("running");
    });
});
