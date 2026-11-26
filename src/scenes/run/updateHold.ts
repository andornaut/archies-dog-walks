interface UpdatePause {
  isClosed(): boolean;
  open(): void;
  close(): void;
}

interface HeldUpdate {
  readonly opened: boolean;
  release(): void;
}

// The update prompt takes Back and owns a menu only when it opens one for the walk.
export class UpdateHold {
  private readonly menu: UpdatePause;
  private active = false;

  constructor(menu: UpdatePause) {
    this.menu = menu;
  }

  get takesBack(): boolean {
    return this.active;
  }

  reset(): void {
    this.active = false;
  }

  hold(): HeldUpdate {
    const closed = this.menu.isClosed();
    this.active = true;
    if (closed) {
      this.menu.open();
    }
    const opened = closed && !this.menu.isClosed();
    return {
      opened,
      release: () => {
        this.reset();
        if (opened) {
          this.menu.close();
        }
      },
    };
  }
}
