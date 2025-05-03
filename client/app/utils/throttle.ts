export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastFunc: NodeJS.Timeout | null = null;
  let lastRan = 0;

  return function (...args: Parameters<T>) {
    const now = Date.now();
    if (!lastRan) {
      func(...args);
      lastRan = now;
    } else {
      if (lastFunc !== null) {
        clearTimeout(lastFunc);
      }
      lastFunc = setTimeout(() => {
        if (now - lastRan >= limit) {
          func(...args);
          lastRan = now;
        }
      }, limit - (now - lastRan));
    }
  };
} 