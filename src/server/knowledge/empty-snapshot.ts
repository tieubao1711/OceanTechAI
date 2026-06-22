import type { ProjectKnowledgeSnapshot } from "./project-knowledge-types";

export function emptyProjectKnowledgeSnapshot(): ProjectKnowledgeSnapshot {
  return {
    architectureSummary: "OceanTechAI test snapshot",
    existingModules: [],
    existingFeatures: [],
    existingTests: [],
    existingPages: [],
    existingServices: [],
    existingIntegrations: [],
    knownConstraints: [],
    recentADRs: [],
    recentDecisions: [],
    prismaModels: [],
    packageScripts: [],
    auditFileMap: [],
  };
}
