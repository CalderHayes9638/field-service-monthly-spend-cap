import { createServer, type ServerResponse } from "node:http";
import OpenAI from "openai";
import { ZodError } from "zod";
import { baseURL } from "./infrai_control.js";
import { decideFollowUp, WorkOrderSchema } from "./technician_follow_up.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

// A single INFRAI_API_KEY and base URL cover both the spend control and the calls it caps.
const ai = new OpenAI({ apiKey, baseURL });
const port = Number(process.env.PORT ?? 3000);

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 64_000) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/work-orders/follow-up") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const workOrder = WorkOrderSchema.parse(await readJson(request));
    const decision = decideFollowUp(workOrder);
    const completion = await ai.chat.completions.create({
      model: "auto",
      messages: [
        {
          role: "system",
          content: "You write factual field-service follow-ups. Return plain text in no more than 80 words.",
        },
        {
          role: "user",
          content: JSON.stringify({ workOrder, instruction: decision.instruction }),
        },
      ],
    });
    sendJson(response, 200, {
      workOrderId: workOrder.workOrderId,
      audience: decision.audience,
      purpose: decision.purpose,
      message: completion.choices[0]?.message.content ?? "",
    });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Invalid work order", details: String(error) });
      return;
    }
    if (error instanceof OpenAI.APIError) {
      const status = error.status && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.message });
      return;
    }
    sendJson(response, 500, { error: error instanceof Error ? error.message : "Unexpected error" });
  }
});

server.listen(port, () => {
  console.log(`Work-order follow-up service listening on http://localhost:${port}`);
});
