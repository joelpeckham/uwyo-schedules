import { toast } from "sonner";

/** Surfaces planner feedback above modals via the global toast portal. */
export function showPlannerError(message: string) {
  toast.error(message);
}

export function showPlannerSuccess(message: string) {
  toast.success(message);
}
