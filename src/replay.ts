import type { GameSnapshot, GameStartOptions, ReverseTetrisEngine } from './game';
import {
  createReplayLog,
  getReplayTime,
  type ReplayEventInput,
  type ReplayLog,
  recordReplayBoundary,
} from './session';

const CHUNK_SIZE = 1024;
type RecordedEvent = ReplayLog['events'][number];

export class ReplayRecording {
  private readonly metadata: Omit<ReplayLog, 'events'>;
  private readonly clocks: Float64Array[] = [];
  private readonly nonTicks = new Map<number, RecordedEvent>();
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
      const clocks = this.clocks[start / CHUNK_SIZE];
      const events: RecordedEvent[] = [];
      for (let offset = 0; offset < Math.min(CHUNK_SIZE, this.count - start); offset++) {
        const clock = clocks[offset];
        events.push(
          this.nonTicks.get(start + offset) ?? {
            type: 'tick',
            t: getReplayTime(clock, this.startedAt),
            clock,
          },
        );
      }
      parts.push(`${start ? ',' : ''}${JSON.stringify(events).slice(1, -1)}`);
    }
    parts.push(`],"snapshot":${JSON.stringify(snapshot)}}`);
    return parts;
  }

  private append(clock: number, event?: RecordedEvent): void {
    const offset = this.count % CHUNK_SIZE;
    if (offset === 0) this.clocks.push(new Float64Array(CHUNK_SIZE));
    this.clocks[this.clocks.length - 1][offset] = clock;
    if (event) this.nonTicks.set(this.count, event);
    this.count++;
  }
}

export function captureRecordedReplayDownload(
  engine: ReverseTetrisEngine,
  recording: ReplayRecording,
  record: (event: ReplayEventInput, timestamp?: number) => void,
): string[] {
  if (recording.seed !== null) recordReplayBoundary(engine, record);
  return recording.buildParts(engine.snapshot());
}
