type SyntheticJobOutput = {
    answer: string;
    sources: string[];
};

type SyntheticJobEntry = {
    createdAt: number;
    output: SyntheticJobOutput;
};

const JOB_PREFIX = "mgwq_";
const JOB_TTL_MS = 10 * 60 * 1000;
const syntheticJobs = new Map<string, SyntheticJobEntry>();

function cleanupExpiredJobs(now: number): void {
    for (const [id, entry] of syntheticJobs.entries()) {
        if (now - entry.createdAt > JOB_TTL_MS) {
            syntheticJobs.delete(id);
        }
    }
}

export function createSyntheticQueryJob(output: SyntheticJobOutput): string {
    const now = Date.now();
    cleanupExpiredJobs(now);
    const jobId = `${JOB_PREFIX}${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    syntheticJobs.set(jobId, { createdAt: now, output });
    return jobId;
}

export function getSyntheticQueryJob(jobId: string): SyntheticJobOutput | null {
    const now = Date.now();
    cleanupExpiredJobs(now);
    const entry = syntheticJobs.get(jobId);
    if (!entry) return null;
    return entry.output;
}

export function isSyntheticQueryJobId(jobId: string): boolean {
    return jobId.startsWith(JOB_PREFIX);
}
