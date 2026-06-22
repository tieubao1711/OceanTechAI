import { PrismaClient } from "@prisma/client";

import { memoryService } from "../src/server/memory/memory.service";

import { governanceService } from "../src/server/governance/governance.service";

import { projectService } from "../src/server/services/project.service";
import { backfillWorkforceForProject } from "../src/server/workforce/workforce-backfill";

import { adrService } from "../src/server/insights/adr.service";

import { timelineService } from "../src/server/insights/timeline.service";

import {

  DOGFOOD_PROJECT_ID,

  DOGFOOD_WORKSPACE_ID,

  SEED_PROJECT_ID,

  SEED_WORKSPACE_ID,

} from "../src/lib/dogfood-ids";



const prisma = new PrismaClient();



async function seedProjectAgents(projectId: string) {

  await projectService.seedDefaultAgents(projectId);

  const agents = await prisma.agent.findMany({ where: { projectId } });

  for (const agent of agents) {

    const memoryByRole: Record<string, string> = {

      economy_designer: "Founder ghét pay-to-win. Gold inflation hit 15% sau guild event.",

      system_architect: "Project dùng PostgreSQL. API convention: REST /api/v1/.",

      qa_engineer: "Inventory module từng có bug duplication. Test concurrent ops.",

      red_team: "Founder rejected mass-report auto-disband. Cần manual review threshold.",

      product_manager: "Founder prefers MVP scope ≤ 2-week implementation.",

    };

    const memory = memoryByRole[agent.role];

    if (memory) {

      await prisma.agent.update({

        where: { id: agent.id },

        data: { memorySummary: memory },

      });

      await memoryService.upsertEntry({

        scope: "AGENT",

        agentRole: agent.role,

        key: "learned_context",

        value: memory,

        source: "seed",

      });

    }

  }

  return agents.length;

}



async function main() {

  await memoryService.seedGlobalMemory();



  await memoryService.upsertEntry({

    scope: "GLOBAL",

    key: "dogfood_personal_first",

    value: "Founder wants OceanTechAI for personal use first — dogfood before external teams.",

    source: "seed",

  });

  await memoryService.upsertEntry({

    scope: "GLOBAL",

    key: "dogfood_self",

    value: "OceanTechAI should dogfood itself — use the system to improve the system.",

    source: "seed",

  });

  await memoryService.upsertEntry({

    scope: "GLOBAL",

    key: "no_saas_yet",

    value: "Do not add SaaS, billing, or multi-user until dogfooding proves value.",

    source: "seed",

  });



  const user = await prisma.user.upsert({

    where: { email: "founder@oceantechai.local" },

    update: {},

    create: {

      email: "founder@oceantechai.local",

      name: "Founder",

    },

  });



  const workspace = await prisma.workspace.upsert({

    where: { id: SEED_WORKSPACE_ID },

    update: {},

    create: {

      id: SEED_WORKSPACE_ID,

      name: "OceanTechAI Demo",

      description: "Founder ghét pay-to-win. Ưu tiên retention hơn monetization.",

      ownerId: user.id,

    },

  });



  await governanceService.seedWorkspaceRules(workspace.id);



  await memoryService.upsertEntry({

    scope: "WORKSPACE",

    workspaceId: workspace.id,

    key: "founder_preference",

    value: "Founder ghét pay-to-win — mọi monetization phải cosmetic-only.",

    source: "seed",

  });



  const demoProject = await prisma.project.upsert({

    where: { id: SEED_PROJECT_ID },

    update: {},

    create: {

      id: SEED_PROJECT_ID,

      name: "MMO Game Project",

      description: "Game MMO với PostgreSQL backend, modular monolith architecture.",

      workspaceId: workspace.id,

    },

  });



  await memoryService.upsertEntry({

    scope: "PROJECT",

    projectId: demoProject.id,

    key: "database",

    value: "PostgreSQL 15 — không propose NoSQL.",

    source: "seed",

  });



  await memoryService.upsertEntry({

    scope: "PROJECT",

    projectId: demoProject.id,

    key: "known_bug",

    value: "Inventory module từng có bug item duplication — test concurrent operations.",

    source: "seed",

  });



  await seedProjectAgents(demoProject.id);
  await backfillWorkforceForProject(demoProject.id);

  await adrService.seedForProject(demoProject.id);

  await timelineService.seedProjectMilestones(demoProject.id, demoProject.name, demoProject.createdAt);



  const dogfoodWorkspace = await prisma.workspace.upsert({

    where: { id: DOGFOOD_WORKSPACE_ID },

    update: {},

    create: {

      id: DOGFOOD_WORKSPACE_ID,

      name: "OceanTechAI Self-Test",

      description: "Dogfooding workspace — OceanTechAI manages and improves itself.",

      ownerId: user.id,

    },

  });



  await governanceService.seedWorkspaceRules(dogfoodWorkspace.id);



  await memoryService.upsertEntry({

    scope: "WORKSPACE",

    workspaceId: dogfoodWorkspace.id,

    key: "dogfood_mission",

    value: "Founder wants OceanTechAI for personal use first. Dogfood daily via Executive Dashboard.",

    source: "seed",

  });



  const coreProject = await prisma.project.upsert({

    where: { id: DOGFOOD_PROJECT_ID },

    update: {},

    create: {

      id: DOGFOOD_PROJECT_ID,

      name: "OceanTechAI Core",

      description: "The operating system project — self-management, self-improvement, Founder approval.",

      workspaceId: dogfoodWorkspace.id,

    },

  });



  await memoryService.upsertEntry({

    scope: "PROJECT",

    projectId: coreProject.id,

    key: "personal_use_first",

    value: "Founder wants OceanTechAI for personal use first.",

    source: "seed",

  });

  await memoryService.upsertEntry({

    scope: "PROJECT",

    projectId: coreProject.id,

    key: "dogfood_itself",

    value: "OceanTechAI should dogfood itself — debates and proposals improve this codebase.",

    source: "seed",

  });

  await memoryService.upsertEntry({

    scope: "PROJECT",

    projectId: coreProject.id,

    key: "constraints",

    value: "Do not add SaaS, billing, or multi-user yet. Focus on self-improvement loop.",

    source: "seed",

  });



  const coreAgents = await seedProjectAgents(coreProject.id);
  await backfillWorkforceForProject(coreProject.id);

  await adrService.seedForProject(coreProject.id);

  await timelineService.seedProjectMilestones(coreProject.id, coreProject.name, coreProject.createdAt);



  console.log("Seed complete:");

  console.log(`  User: ${user.email}`);

  console.log(`  Demo workspace: ${workspace.name} (${workspace.id})`);

  console.log(`  Demo project:   ${demoProject.name} (${demoProject.id})`);

  console.log(`  Dogfood workspace: ${dogfoodWorkspace.name} (${dogfoodWorkspace.id})`);

  console.log(`  Core project:      ${coreProject.name} (${coreProject.id})`);

  console.log(`  Core agents:       ${coreAgents}`);
  console.log(`  Roster: Core = Alex/Sam/... · MMO = Linh/Khoa/... (chạy lại seed để đồng bộ tên)`);

  console.log(`\n  Executive: http://localhost:3001/projects/${coreProject.id}/executive`);

}



main()

  .catch((e) => {

    console.error(e);

    process.exit(1);

  })

  .finally(() => prisma.$disconnect());


