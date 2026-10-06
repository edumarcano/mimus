import { createTranslateHandler } from "@/lib/server/translate";
import { streamRewrite } from "@/lib/server/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

const handleTranslate = createTranslateHandler({ adapter: streamRewrite });

export async function POST(request: Request): Promise<Response> {
  return handleTranslate(request);
}
