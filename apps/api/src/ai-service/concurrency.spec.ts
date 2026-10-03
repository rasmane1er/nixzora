import { ConcurrencyLimit, QueueFullError } from './concurrency';

const later = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};

describe('ConcurrencyLimit', () => {
  it('runs at most the limit at once, then the next in line', async () => {
    const limit = new ConcurrencyLimit(2, 5);
    const gates = [later(), later(), later()];
    const started: number[] = [];
    const runs = gates.map((gate, i) =>
      limit.run(async () => {
        started.push(i);
        await gate.promise;
        return i;
      }),
    );
    await Promise.resolve();
    expect(started).toEqual([0, 1]);
    expect(limit.queued).toBe(1);
    gates[0]!.resolve();
    await runs[0];
    await new Promise((r) => setImmediate(r));
    expect(started).toEqual([0, 1, 2]);
    gates[1]!.resolve();
    gates[2]!.resolve();
    await expect(Promise.all(runs)).resolves.toEqual([0, 1, 2]);
    expect(limit.active).toBe(0);
  });

  it('refuses work when the queue is full, and frees the slot after a failure', async () => {
    const limit = new ConcurrencyLimit(1, 1);
    const gate = later();
    const first = limit.run(() => gate.promise);
    const second = limit.run(() => Promise.reject(new Error('provider down')));
    await expect(limit.run(() => Promise.resolve(3))).rejects.toBeInstanceOf(QueueFullError);
    gate.resolve();
    await first;
    await expect(second).rejects.toThrow('provider down');
    await expect(limit.run(() => Promise.resolve(4))).resolves.toBe(4);
  });
});
