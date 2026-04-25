import { randomUUID } from "node:crypto";
import { scrapeStepLog } from "../scrape-log";

export async function newRunIdStep(): Promise<string> {
  "use step";
  const runId = randomUUID();
  scrapeStepLog("newRunIdStep:done", { runId });
  return runId;
}
