import { prisma } from '../prisma/client';
import { IngestionService, defaultIngestionService } from './ingestion.service';
import { IngestionRunSummary } from '@parmanu/types';

export class IngestionScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isCycleActive: boolean = false;
  private lastCycleAt: Date | null = null;
  private cycleCount: number = 0;

  constructor(
    private ingestionService: IngestionService = defaultIngestionService,
    private intervalMs: number = 60000 // Check every minute
  ) {}

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`⏱️ [SCHEDULER] Ingestion scheduler started (polling check interval: ${this.intervalMs / 1000}s)`);

    // Run first check after brief delay
    setTimeout(() => this.runPollCycle(), 5000);

    this.timer = setInterval(() => {
      this.runPollCycle();
    }, this.intervalMs);
  }

  public stop(): void {
    if (!this.isRunning) return;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('⏱️ [SCHEDULER] Ingestion scheduler stopped');
  }

  /**
   * Identifies all sources whose configured polling interval has elapsed and ingests them
   */
  public async runPollCycle(): Promise<IngestionRunSummary[]> {
    if (this.isCycleActive) {
      console.log('⏱️ [SCHEDULER] Previous poll cycle still executing. Skipping duplicate trigger.');
      return [];
    }

    this.isCycleActive = true;
    this.lastCycleAt = new Date();
    this.cycleCount++;

    const results: IngestionRunSummary[] = [];

    try {
      const activeSources = await prisma.newsSource.findMany({
        where: { isActive: true },
      });

      const now = Date.now();
      const sourcesToPoll = activeSources.filter((source) => {
        if (!source.lastPolledAt) return true;
        const elapsedMinutes = (now - new Date(source.lastPolledAt).getTime()) / (1000 * 60);
        return elapsedMinutes >= (source.pollingIntervalMinutes || 15);
      });

      if (sourcesToPoll.length > 0) {
        console.log(
          `⏱️ [SCHEDULER] Poll cycle #${this.cycleCount}: Ingesting ${sourcesToPoll.length} due sources (out of ${activeSources.length} active)...`
        );

        for (const source of sourcesToPoll) {
          try {
            const summary = await this.ingestionService.ingestSource(source);
            results.push(summary);
          } catch (err: any) {
            console.error(`⏱️ [SCHEDULER] Error polling source "${source.name}":`, err.message);
          }
        }
      }
    } catch (dbErr: any) {
      console.error('⏱️ [SCHEDULER] Failed to query sources for scheduled poll cycle:', dbErr.message);
    } finally {
      this.isCycleActive = false;
    }

    return results;
  }

  public getStatus(): {
    isRunning: boolean;
    isCycleActive: boolean;
    lastCycleAt: Date | null;
    cycleCount: number;
    intervalMs: number;
  } {
    return {
      isRunning: this.isRunning,
      isCycleActive: this.isCycleActive,
      lastCycleAt: this.lastCycleAt,
      cycleCount: this.cycleCount,
      intervalMs: this.intervalMs,
    };
  }
}

export const defaultIngestionScheduler = new IngestionScheduler();
