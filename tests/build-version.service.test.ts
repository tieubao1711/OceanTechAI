import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BuildVersionService } from "@/server/services/build-version.service";

describe("build-version.service (P0)", () => {
  const service = new BuildVersionService();

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns sanitized semver from APP_VERSION env", () => {
    vi.stubEnv("APP_VERSION", "1.2.3");
    vi.stubEnv("BUILD_DATE", "2026-06-24T00:00:00.000Z");

    const info = service.getVersionInfo();

    expect(info.version).toBe("1.2.3");
    expect(info.buildDate).toBe("2026-06-24T00:00:00.000Z");
  });

  it("falls back to safe default when APP_VERSION is invalid", () => {
    vi.stubEnv("APP_VERSION", "<script>alert(1)</script>");

    const info = service.getVersionInfo();

    expect(info.version).toBe("0.0.0");
  });

  it("does not expose commit hash or internal fields", () => {
    vi.stubEnv("APP_VERSION", "0.1.0");
    vi.stubEnv("GIT_COMMIT", "abc123deadbeef");
    vi.stubEnv("BUILD_DATE", "2026-06-24T00:00:00.000Z");

    const info = service.getVersionInfo();

    expect(info).toEqual({
      version: "0.1.0",
      buildDate: "2026-06-24T00:00:00.000Z",
    });
    expect(Object.keys(info)).toEqual(["version", "buildDate"]);
  });

  it("reads version from package.json when APP_VERSION is unset", () => {
    const info = service.getVersionInfo();

    expect(info.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
