/** Lets the browser paint/handle input before heavier synchronous work runs. */

export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    const g = globalThis as typeof globalThis & {
      scheduler?: { postTask: (cb: () => void) => void };
    };
    if (typeof g.scheduler?.postTask === "function") {
      g.scheduler.postTask(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}
