type SyntheticQueryJobOutput = {
    answer: string;
    sources: string[];
};

type SyntheticIngestJobOutput = {
    ingested: number;
    source?: string;
};

type SyntheticJobEntry =
    | { kind: "query"; createdAt: number; output: SyntheticQueryJobOutput }
    | { kind: "ingest"; createdAt: number; output: SyntheticIngestJobOutput };

const QUERY_JOB_PREFIX = "mgwq_";
const INGEST_JOB_PREFIX = "mgwi_";
const JOB_TTL_MS = 10 * 60 * 1000;
const syntheticJobs = new Map<string, SyntheticJobEntry>();

function cleanupExpiredJobs(now: number): void {
    for (const [id, entry] of syntheticJobs.entries()) {
        if (now - entry.createdAt > JOB_TTL_MS) {
            syntheticJobs.delete(id);
        }
    }
}

export function createSyntheticQueryJob(output: SyntheticQueryJobOutput): string {
    const now = Date.now();
    cleanupExpiredJobs(now);
    const jobId = `${QUERY_JOB_PREFIX}${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    syntheticJobs.set(jobId, { kind: "query", createdAt: now, output });
    return jobId;
}

export function createSyntheticIngestJob(output: SyntheticIngestJobOutput): string {
    const now = Date.now();
    cleanupExpiredJobs(now);
    const jobId = `${INGEST_JOB_PREFIX}${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    syntheticJobs.set(jobId, { kind: "ingest", createdAt: now, output });
    return jobId;
}

export function getSyntheticQueryJob(jobId: string): SyntheticQueryJobOutput | null {
    const now = Date.now();
    cleanupExpiredJobs(now);
    const entry = syntheticJobs.get(jobId);
    if (!entry || entry.kind !== "query") return null;
    return entry.output;
}

export function getSyntheticIngestJob(jobId: string): SyntheticIngestJobOutput | null {
    const now = Date.now();
    cleanupExpiredJobs(now);
    const entry = syntheticJobs.get(jobId);
    if (!entry || entry.kind !== "ingest") return null;
    return entry.output;
}

export function isSyntheticQueryJobId(jobId: string): boolean {
    return jobId.startsWith(QUERY_JOB_PREFIX);
}

export function isSyntheticIngestJobId(jobId: string): boolean {
    return jobId.startsWith(INGEST_JOB_PREFIX);
}

export function isSyntheticJobId(jobId: string): boolean {
    return isSyntheticQueryJobId(jobId) || isSyntheticIngestJobId(jobId);
}
