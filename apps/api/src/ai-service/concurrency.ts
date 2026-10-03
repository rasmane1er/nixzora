/**
 * At most `limit` tasks run at once; the rest wait their turn (first come, first served). A queue
 * longer than `maxQueue` is refused at once, so a burst fails fast instead of piling up timeouts.
 */
export class ConcurrencyLimit {
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(
    private readonly limit: number,
    private readonly maxQueue = limit * 8,
  ) {}

  get active(): number {
    return this.running;
  }

  get queued(): number {
    return this.waiting.length;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.limit) {
      if (this.waiting.length >= this.maxQueue) throw new QueueFullError();
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.running += 1;
    try {
      return await task();
    } finally {
      this.running -= 1;
      this.waiting.shift()?.();
    }
  }
}

export class QueueFullError extends Error {
  constructor() {
    super('The AI service is at capacity. Try again shortly.');
  }
}
