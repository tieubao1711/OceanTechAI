import { NextResponse } from "next/server";
import { buildVersionService } from "@/server/services/build-version.service";

export async function GET() {
  const { version, buildDate } = buildVersionService.getVersionInfo();

  return NextResponse.json(
    { version, buildDate },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    }
  );
}
