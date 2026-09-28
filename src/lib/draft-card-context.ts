import "server-only";
import { isAiEnabled } from "@/lib/ai";
import { isLiveEnabled } from "@/lib/publish-mode";
import { getAllStationCategories } from "@/lib/wordpress";
import type { DraftCardContext } from "@/lib/types";

export async function getDraftCardContext(): Promise<DraftCardContext> {
  return {
    aiEnabled: isAiEnabled(),
    liveEnabled: isLiveEnabled(),
    categoriesByStation: await getAllStationCategories(),
  };
}
