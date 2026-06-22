import { NextResponse } from "next/server";
import { discussionService } from "@/server/services/discussion.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ discussionId: string }> }
) {
  const { discussionId } = await params;
  try {
    await discussionService.runDebate(discussionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
