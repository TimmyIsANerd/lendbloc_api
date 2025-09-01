import { nanoid } from 'nanoid';

type Processor<T> = (payload: T) => Promise<void>;

export class SimpleQueue<T> {
  private queue: { id: string; payload: T }[] = [];
  private processing = false;
  private processor: Processor<T> | null = null;

  constructor(private concurrency = 1) {}

  public setProcessor(proc: Processor<T>) {
    this.processor = proc;
    this.kick();
  }

  public enqueue(payload: T) {
    this.queue.push({ id: nanoid(), payload });
    this.kick();
  }

  private async kick() {
    if (this.processing) return;
    if (!this.processor) return;
    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift()!;
        try {
          await this.processor(job.payload);
        } catch (err) {
          // Basic: drop on error; could re-enqueue with backoff if needed
          console.error('Queue job failed:', err);
        }
      }
    } finally {
      this.processing = false;
    }
  }
}

// Singleton for deposit events
export interface TatumIncomingPayload {
  currency: string;
  address: string;
  blockNumber: number | string;
  counterAddress: string;
  txId: string;
  chain: string; // e.g., 'ethereum-sepolia'
  subscriptionType: 'INCOMING_NATIVE_TX' | 'INCOMING_FUNGIBLE_TX' | string;
  amount: string; // string numeric
  contractAddress?: string;
}

export const depositQueue = new SimpleQueue<TatumIncomingPayload>(1);

