import assert from "node:assert/strict";
import test from "node:test";
import { decideFollowUp, WorkOrderSchema } from "../src/technician_follow_up.js";

test("a completed work order without photos goes back to the technician", () => {
  const workOrder = WorkOrderSchema.parse({
    workOrderId: "WO-1842",
    customerName: "North Street Cinema",
    dispatchStatus: "completed",
    photoUrls: [],
    technicianNotes: "Replaced the lobby display controller.",
  });

  assert.deepEqual(decideFollowUp(workOrder), {
    audience: "technician",
    purpose: "collect_completion_photo",
    instruction: "Ask the technician to attach one completion photo before customer follow-up.",
  });
});
