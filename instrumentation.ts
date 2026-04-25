export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }
  const { getWorld } = await import("workflow/runtime");
  await getWorld().start?.();
}
