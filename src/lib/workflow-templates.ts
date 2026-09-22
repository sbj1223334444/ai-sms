import { readConfig, updateConfig } from "@/lib/store";
import { SHIPPED_TEMPLATES } from "@/lib/workflow";
import type { StageTemplate, WorkflowTemplates } from "@/lib/types";

/**
 * Default workflows per report type (US-18). config/workflows.json is the shipped set; once an
 * admin saves from Administration → Workflows, the saved set is used instead.
 */
export async function workflowTemplates(): Promise<WorkflowTemplates> {
  return (await readConfig<WorkflowTemplates>("workflows")) ?? SHIPPED_TEMPLATES;
}

/**
 * Save one template. `target` is "default" or a form ID; `stages: null` sends a report type back
 * to the default workflow. Stages must already be normalised (see normaliseTemplate).
 */
export async function saveWorkflowTemplate(
  target: string,
  stages: StageTemplate[] | null,
  actor: { name: string; email: string }
): Promise<WorkflowTemplates> {
  const message =
    target === "default"
      ? "feat(workflows): update default workflow"
      : stages
        ? `feat(workflows): set workflow for ${target}`
        : `feat(workflows): ${target} back to default workflow`;
  return updateConfig<WorkflowTemplates>(
    "workflows",
    SHIPPED_TEMPLATES,
    (current) => {
      if (target === "default") return { ...current, default: stages! };
      const byFormId = { ...current.byFormId };
      if (stages) byFormId[target] = stages;
      else delete byFormId[target];
      return { ...current, byFormId };
    },
    message,
    actor
  );
}
