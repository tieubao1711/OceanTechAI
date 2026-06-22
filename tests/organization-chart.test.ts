import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrganizationChartService } from "@/server/workforce/organization-chart.service";

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    agent: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

describe("organization-chart", () => {
  const service = new OrganizationChartService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("groups agents by department under founder", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: "a1",
        name: "Sam — Architect",
        role: "system_architect",
        department: "ENGINEERING",
        title: "Lead Architect",
        rank: "LEAD",
        managerAgentId: null,
        workforceStatus: "ACTIVE",
        avatarType: "FANTASY",
        avatarSeed: "sam-architect",
        manager: null,
        project: { name: "Core" },
      },
      {
        id: "a2",
        name: "Morgan — Security",
        role: "red_team",
        department: "SECURITY",
        title: "Security Director",
        rank: "DIRECTOR",
        managerAgentId: null,
        workforceStatus: "ACTIVE",
        avatarType: "CYBERPUNK",
        avatarSeed: "morgan-security",
        manager: null,
        project: { name: "Core" },
      },
    ]);

    const chart = await service.getChart("ws1");
    expect(chart.founderLabel).toBe("Founder");
    const engineering = chart.departments.find((d) => d.department === "ENGINEERING");
    const security = chart.departments.find((d) => d.department === "SECURITY");
    expect(engineering?.agents).toHaveLength(1);
    expect(security?.agents[0]?.title).toBe("Security Director");
    expect(engineering?.agents[0]?.avatarEmoji).toBeTruthy();
  });

  it("walks manager chain", async () => {
    mockFindUnique
      .mockResolvedValueOnce({ managerAgentId: "m1", name: "Blake" })
      .mockResolvedValueOnce({ id: "m1", name: "Alex", managerAgentId: null });

    const chain = await service.getManagerChain("a1");
    expect(chain).toEqual(["Alex"]);
  });
});
