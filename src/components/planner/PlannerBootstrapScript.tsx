import { buildPlannerBootstrapScript } from "@/lib/planner/planner-bootstrap";

type Props = {
  termCode: string;
};

/** Blocking script: sets html[data-planner-items] before planner column paints. */
export function PlannerBootstrapScript({ termCode }: Props) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: buildPlannerBootstrapScript(termCode),
      }}
    />
  );
}
