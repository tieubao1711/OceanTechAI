import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/v1/build-version/route";

describe("GET /api/v1/build-version (P0)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("APP_VERSION", "0.1.0");
    vi.stubEnv("BUILD_DATE", "2026-06-24T12:00:00.000Z");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns version JSON with cache headers", async () => {
    const response = await GET();
    const body = (await response.json()) as { version: string; buildDate: string | null };

    expect(response.status).toBe(200);
    expect(body.version).toBe("0.1.0");
    expect(body.buildDate).toBe("2026-06-24T12:00:00.000Z");
    expect(response.headers.get("Cache-Control")).toContain("max-age=3600");
  });

  it("does not include commit hash in response body", async () => {
    vi.stubEnv("GIT_COMMIT", "deadbeef");

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(body).not.toHaveProperty("commit");
    expect(body).not.toHaveProperty("commitHash");
    expect(body).not.toHaveProperty("gitSha");
    expect(Object.keys(body)).toEqual(["version", "buildDate"]);
  });

  it("sanitizes invalid version strings in API response", async () => {
    vi.stubEnv("APP_VERSION", "../../../etc/passwd");

    const response = await GET();
    const body = (await response.json()) as { version: string };

    expect(body.version).toBe("0.0.0");
  });
});
