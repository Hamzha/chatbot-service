type SyntheticIngestJobOutput = {
  ingested: number;
  source: string;
};

type SyntheticIngestJobEntry = {
  createdAt: number;
  output: SyntheticIngestJobOutput;
};

const JOB_PREFIX = "mgwi_";
const JOB_TTL_MS = 10 * 60 * 1000;
const syntheticIngestJobs = new Map<string, SyntheticIngestJobEntry>();

function cleanupExpiredJobs(now: number): void {
  for (const [id, entry] of syntheticIngestJobs.entries()) {
    if (now - entry.createdAt > JOB_TTL_MS) {
      syntheticIngestJobs.delete(id);
    }
  }
}

export function createSyntheticIngestJob(output: SyntheticIngestJobOutput): string {
  const now = Date.now();
  cleanupExpiredJobs(now);
  const jobId = `${JOB_PREFIX}${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  syntheticIngestJobs.set(jobId, { createdAt: now, output });
  return jobId;
}

export function getSyntheticIngestJob(jobId: string): SyntheticIngestJobOutput | null {
  const now = Date.now();
  cleanupExpiredJobs(now);
  const entry = syntheticIngestJobs.get(jobId);
  if (!entry) return null;
  return entry.output;
}

export function isSyntheticIngestJobId(jobId: string): boolean {
  return jobId.startsWith(JOB_PREFIX);
}
