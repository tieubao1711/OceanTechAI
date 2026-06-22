import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/db/prisma";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createDiscussionAction } from "@/app/actions";

export default async function NewDiscussionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const t = await getTranslations("discussionNew");
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const activeCount = await prisma.agent.count({ where: { projectId, isActive: true } });

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/projects/${projectId}`} className="text-sm text-[var(--muted)] hover:text-white">
          ← {project.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-[var(--muted)]">{t("activeAgents", { count: activeCount })}</p>
      </div>

      <Card>
        <CardTitle>{t("founderInput")}</CardTitle>
        <form action={createDiscussionAction} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <textarea
            name="userPrompt"
            placeholder={t("promptPlaceholder")}
            rows={4}
            required
            className="w-full rounded-md border border-[var(--border)] bg-slate-900 px-3 py-2 text-sm"
          />
          <div>
            <label className="mb-2 block text-sm font-medium">{t("modeLabel")}</label>
            <select
              name="mode"
              className="w-full rounded-md border border-[var(--border)] bg-slate-900 px-3 py-2 text-sm"
              defaultValue="normal"
            >
              <option value="normal">{t("modeNormal")}</option>
              <option value="architecture_audit">{t("modeAudit")}</option>
            </select>
            <p className="mt-1 text-xs text-[var(--muted)]">{t("modeAuditHint")}</p>
          </div>
          <Button type="submit">{t("createButton")}</Button>
        </form>
      </Card>
    </div>
  );
}
