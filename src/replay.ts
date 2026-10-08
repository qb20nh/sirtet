import type { GameSnapshot, GameStartOptions, ReverseTetrisEngine } from './game';
import {
  createReplayLog,
  getReplayTime,
  type ReplayEventInput,
  type ReplayLog,
  recordReplayBoundary,
} from './session';

const CHUNK_SIZE = 1024;
const EXPORT_BATCH_SIZE = 256;
const BLOBS_PER_GROUP = 32;
const SMALL_EXPORT_LIMIT = 4096;
const EXPORT_BUDGET_MS = 6;
type RecordedEvent = ReplayLog['events'][number];

export class ReplayRecording {
  private readonly metadata: Omit<ReplayLog, 'events'>;
  private readonly clocks: Float64Array[] = [];
  private readonly nonTicks = new Map<number, RecordedEvent>();
  private readonly starts = new Map<number, RecordedEvent & { type: 'start' }>();
  private count = 0;

  constructor(
    seed: number | null = null,
    options: GameStartOptions = {},
    createdAt?: string,
    private readonly startedAt = 0,
  ) {
    const { events, ...metadata } = createReplayLog(seed, options, createdAt, startedAt);
    this.metadata = metadata;
    for (const event of events) this.append(event.clock, event);
  }

  get seed(): number | null {
    return this.metadata.seed;
  }

  record(event: ReplayEventInput, clock: number): void {
    this.append(
      clock,
      event.type === 'tick'
        ? undefined
        : { ...event, t: getReplayTime(clock, this.startedAt), clock },
    );
  }

  // Expand only one chunk at a time; the downloaded v3 event stream stays unchanged.
  buildParts(snapshot: GameSnapshot): string[] {
    const parts = [`${JSON.stringify(this.metadata).slice(0, -1)},"events":[`];
    for (let start = 0; start < this.count; start += CHUNK_SIZE) {
      parts.push(this.serializeEvents(start, Math.min(CHUNK_SIZE, this.count - start)));
    }
    parts.push(`],"snapshot":${JSON.stringify(snapshot)}}`);
    return parts;
  }

  async buildBlob(snapshot: GameSnapshot, signal?: AbortSignal): Promise<Blob> {
    signal?.throwIfAborted();
    if (this.count <= SMALL_EXPORT_LIMIT) {
      return new Blob(this.buildParts(snapshot), { type: 'application/json' });
    }

    // Freeze the click boundary before yielding. Existing clock/event slots are
    // append-only; only start options borrow mutable objects from callers.
    const count = this.count;
    const header = `${JSON.stringify(this.metadata).slice(0, -1)},"events":[`;
    const trailer = `],"snapshot":${JSON.stringify(snapshot)}}`;
    const starts = new Map<number, RecordedEvent>();
    for (const [index, event] of this.starts) {
      starts.set(index, { ...event, options: { ...event.options } });
    }

    const blobs: Blob[] = [];
    const group: Blob[] = [];
    const flush = () => {
      blobs.push(new Blob(group));
      group.length = 0;
    };
    const append = (text: string) => {
      group.push(new Blob([text]));
      if (group.length === BLOBS_PER_GROUP) flush();
    };
    append(header);
    let sliceStarted = performance.now();
    for (let start = 0; start < count; start += EXPORT_BATCH_SIZE) {
      append(this.serializeEvents(start, Math.min(EXPORT_BATCH_SIZE, count - start), starts));
      // This is a soft budget, not a device-independent task-duration guarantee.
      // Timer tasks give rendering/input a turn and also work in hidden tabs.
      if (
        start + EXPORT_BATCH_SIZE < count &&
        performance.now() - sliceStarted >= EXPORT_BUDGET_MS
      ) {
        await yieldReplayExport(signal);
        sliceStarted = performance.now();
      }
    }
    signal?.throwIfAborted();
    append(trailer);
    if (group.length) flush();
    const blob = new Blob(blobs, { type: 'application/json' });
    // Keep native download and UI work out of the final assembly task.
    await yieldReplayExport(signal);
    return blob;
  }

  private serializeEvents(
    start: number,
    length: number,
    starts?: Map<number, RecordedEvent>,
  ): string {
    const clocks = this.clocks[Math.floor(start / CHUNK_SIZE)];
    const events: RecordedEvent[] = [];
    for (let offset = 0; offset < length; offset++) {
      const index = start + offset;
      const clock = clocks[(start % CHUNK_SIZE) + offset];
      events.push(
        starts?.get(index) ??
          this.nonTicks.get(index) ?? {
            type: 'tick',
            t: getReplayTime(clock, this.startedAt),
            clock,
          },
      );
    }
    return `${start ? ',' : ''}${JSON.stringify(events).slice(1, -1)}`;
  }

  private append(clock: number, event?: RecordedEvent): void {
    const offset = this.count % CHUNK_SIZE;
    if (offset === 0) this.clocks.push(new Float64Array(CHUNK_SIZE));
    this.clocks[this.clocks.length - 1][offset] = clock;
    if (event) this.nonTicks.set(this.count, event);
    if (event?.type === 'start') this.starts.set(this.count, event);
    this.count++;
  }
}

function yieldReplayExport(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, 0);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function captureRecordedReplayDownload(
  engine: ReverseTetrisEngine,
  recording: ReplayRecording,
  record: (event: ReplayEventInput, timestamp?: number) => void,
): string[] {
  if (recording.seed !== null) recordReplayBoundary(engine, record);
  return recording.buildParts(engine.snapshot());
}

export function prepareRecordedReplayDownload(
  engine: ReverseTetrisEngine,
  recording: ReplayRecording,
  record: (event: ReplayEventInput, timestamp?: number) => void,
  signal: AbortSignal,
): Promise<Blob> {
  if (recording.seed !== null) recordReplayBoundary(engine, record);
  return recording.buildBlob(engine.snapshot(), signal);
}

export type ReplayDownloadStatus = 'idle' | 'preparing' | 'failed';

// Own one export at a time, including synchronous double clicks and a canceled
// export finishing after a restart has already launched a newer one.
export class ReplayDownloadController {
  private pending: AbortController | null = null;
  private disposed = false;

  constructor(
    private readonly prepare: (signal: AbortSignal) => Promise<Blob>,
    private readonly save: (blob: Blob) => void,
    private readonly onStatus: (status: ReplayDownloadStatus) => void,
  ) {}

  async start(): Promise<void> {
    if (this.pending || this.disposed) return;
    const job = new AbortController();
    this.pending = job;
    this.onStatus('preparing');
    let status: ReplayDownloadStatus = 'idle';
    try {
      const blob = await this.prepare(job.signal);
      if (this.pending === job) this.save(blob);
    } catch {
      status = 'failed';
    } finally {
      if (this.pending === job) {
        this.pending = null;
        this.onStatus(status);
      }
    }
  }

  cancel(): void {
    this.pending?.abort();
    this.pending = null;
    this.onStatus('idle');
  }

  dispose(): void {
    this.disposed = true;
    this.pending?.abort();
    this.pending = null;
  }
}
