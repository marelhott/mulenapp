export type PromptHistoryEntry = {
  id: string;
  prompt: string;
  createdAt: string;
};

type PromptHistorySnapshot = {
  entries: PromptHistoryEntry[];
  currentIndex: number;
};

export class PromptHistory {
  private entries: PromptHistoryEntry[] = [];
  private currentIndex = -1;
  private maxHistory = 20;
  private mergeWindowMs = 1500;

  add(prompt: string): void {
    if (this.currentIndex < this.entries.length - 1) {
      this.entries = this.entries.slice(0, this.currentIndex + 1);
    }

    const normalized = prompt.trim();
    const lastEntry = this.entries[this.entries.length - 1];
    if (lastEntry?.prompt === normalized) {
      this.currentIndex = this.entries.length - 1;
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();

    if (lastEntry) {
      const lastCreatedAt = Date.parse(lastEntry.createdAt);
      if (Number.isFinite(lastCreatedAt) && now.getTime() - lastCreatedAt <= this.mergeWindowMs) {
        this.entries[this.entries.length - 1] = {
          ...lastEntry,
          prompt: normalized,
          createdAt: nowIso,
        };
        this.currentIndex = this.entries.length - 1;
        return;
      }
    }

    this.entries.push({
      id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      prompt: normalized,
      createdAt: nowIso,
    });

    if (this.entries.length > this.maxHistory) {
      this.entries.shift();
    }

    this.currentIndex = this.entries.length - 1;
  }

  undo(): string | null {
    if (!this.canUndo()) return null;
    this.currentIndex -= 1;
    return this.entries[this.currentIndex]?.prompt ?? null;
  }

  redo(): string | null {
    if (!this.canRedo()) return null;
    this.currentIndex += 1;
    return this.entries[this.currentIndex]?.prompt ?? null;
  }

  jumpTo(entryId: string): string | null {
    const nextIndex = this.entries.findIndex((entry) => entry.id === entryId);
    if (nextIndex < 0) return null;
    this.currentIndex = nextIndex;
    return this.entries[this.currentIndex]?.prompt ?? null;
  }

  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  canRedo(): boolean {
    return this.currentIndex >= 0 && this.currentIndex < this.entries.length - 1;
  }

  getEntries(): PromptHistoryEntry[] {
    return [...this.entries];
  }

  getCurrentEntryId(): string | null {
    return this.entries[this.currentIndex]?.id ?? null;
  }

  hasEntries(): boolean {
    return this.entries.length > 0;
  }

  serialize(): PromptHistorySnapshot {
    return {
      entries: this.getEntries(),
      currentIndex: this.currentIndex,
    };
  }

  restore(snapshot: PromptHistorySnapshot | null | undefined): void {
    if (!snapshot || !Array.isArray(snapshot.entries)) {
      this.entries = [];
      this.currentIndex = -1;
      return;
    }

    this.entries = snapshot.entries
      .filter(
        (entry): entry is PromptHistoryEntry =>
          Boolean(entry) &&
          typeof entry.id === 'string' &&
          typeof entry.prompt === 'string' &&
          typeof entry.createdAt === 'string' &&
          entry.prompt.trim().length > 0,
      )
      .slice(-this.maxHistory);

    if (!this.entries.length) {
      this.currentIndex = -1;
      return;
    }

    const maxIndex = this.entries.length - 1;
    const requestedIndex = typeof snapshot.currentIndex === 'number' ? snapshot.currentIndex : maxIndex;
    this.currentIndex = Math.min(Math.max(requestedIndex, 0), maxIndex);
  }
}
