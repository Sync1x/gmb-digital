import "server-only";
import { isAiEnabled } from "@/lib/ai";
import { getPublishMode } from "@/lib/publish-mode";
import type { DraftCardContext } from "@/lib/types";

export function getDraftCardContext(): DraftCardContext {
  return { aiEnabled: isAiEnabled(), publishMode: getPublishMode() };
}
