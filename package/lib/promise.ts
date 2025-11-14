function debounce<T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number
): (...args: T) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: T) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export type DeferredPromise<T> = {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
};

export const createDeferredPromise = <T>(debounceTime = 0): DeferredPromise<T> => {
  let resolve: (v: T) => void;
  let reject: (e: unknown) => void;

  const promise = new Promise<T>((r, j) => {
    resolve = debounceTime > 0 ? debounce(r, debounceTime) : r;
    reject = j;
  });

  return { promise, resolve: resolve!, reject: reject! };
};
