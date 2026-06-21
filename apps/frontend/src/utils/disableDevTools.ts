interface DevToolsConfig {
  disableContextMenu: boolean;
  disableKeyboardShortcuts: boolean;
  detectDevTools: boolean;
}

const defaultConfig: DevToolsConfig = {
  disableContextMenu: true,
  disableKeyboardShortcuts: true,
  detectDevTools: false,
};

let isDisabled = false;
let cleanupFns: (() => void)[] = [];

export function disableDevTools(config?: Partial<DevToolsConfig>) {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV === 'development') return;
  if (isDisabled) return;

  const opts = { ...defaultConfig, ...config };

  if (opts.disableContextMenu) {
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };
    document.addEventListener('contextmenu', handler);
    cleanupFns.push(() => document.removeEventListener('contextmenu', handler));
  }

  if (opts.disableKeyboardShortcuts) {
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
      if (e.ctrlKey && e.shiftKey && /^[IiJjCc]$/.test(e.key)) {
        e.preventDefault();
        return false;
      }
      if (e.ctrlKey && /^[Uu]$/.test(e.key)) {
        e.preventDefault();
        return false;
      }
      if (e.metaKey && e.altKey && /^[IiJj]$/.test(e.key)) {
        e.preventDefault();
        return false;
      }
      if (e.metaKey && /^[Uu]$/.test(e.key)) {
        e.preventDefault();
        return false;
      }
    };
    document.addEventListener('keydown', keyHandler);
    cleanupFns.push(() => document.removeEventListener('keydown', keyHandler));
  }

  isDisabled = true;
}

export function enableDevTools() {
  cleanupFns.forEach((fn) => fn());
  cleanupFns = [];
  isDisabled = false;
}

export function isDevToolsBlocked(): boolean {
  return isDisabled;
}