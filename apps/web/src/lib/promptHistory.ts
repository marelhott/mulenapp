export class PromptHistory {
  private history: string[] = [];
  private currentIndex = -1;
  private maxHistory = 20;

  add(prompt: string): void {
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    if (this.history[this.history.length - 1] !== prompt) {
      this.history.push(prompt);

      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }

      this.currentIndex = this.history.length - 1;
    }
  }

  undo(): string | null {
    if (this.canUndo()) {
      this.currentIndex -= 1;
      return this.history[this.currentIndex];
    }
    return null;
  }

  redo(): string | null {
    if (this.canRedo()) {
      this.currentIndex += 1;
      return this.history[this.currentIndex];
    }
    return null;
  }

  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  getAll(): string[] {
    return [...this.history];
  }
}
