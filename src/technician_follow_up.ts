import { z } from "zod";

export const WorkOrderSchema = z.object({
  workOrderId: z.string().min(1).max(80),
  customerName: z.string().min(1).max(120),
  dispatchStatus: z.enum(["scheduled", "en_route", "on_site", "completed"]),
  photoUrls: z.array(z.string().url()).max(12),
  technicianNotes: z.string().max(2000).default(""),
});

export type WorkOrder = z.infer<typeof WorkOrderSchema>;

export type FollowUpDecision = {
  audience: "technician" | "customer";
  purpose: "collect_completion_photo" | "share_dispatch_update" | "close_work_order";
  instruction: string;
};

export function decideFollowUp(workOrder: WorkOrder): FollowUpDecision {
  if (workOrder.dispatchStatus === "completed" && workOrder.photoUrls.length === 0) {
    return {
      audience: "technician",
      purpose: "collect_completion_photo",
      instruction: "Ask the technician to attach one completion photo before customer follow-up.",
    };
  }
  if (workOrder.dispatchStatus === "completed") {
    return {
      audience: "customer",
      purpose: "close_work_order",
      instruction: "Write a concise completion note grounded in the technician notes and attached photos.",
    };
  }
  return {
    audience: "customer",
    purpose: "share_dispatch_update",
    instruction: "Write a concise status update without promising an arrival time that is not in the work order.",
  };
}
