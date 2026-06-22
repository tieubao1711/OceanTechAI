import { NextResponse } from "next/server";
import { debateLiveService } from "@/server/services/debate-live.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ discussionId: string }> }
) {
  const { discussionId } = await params;
  const state = await debateLiveService.getLiveState(discussionId);
  return NextResponse.json(state);
}
