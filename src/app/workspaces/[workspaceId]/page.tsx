import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/db/prisma";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createProjectAction } from "@/app/actions";

export default async function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const t = await getTranslations("workspace");
  const tc = await getTranslations("common");
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    include: { projects: true },
  });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/workspaces" className="text-sm text-[var(--muted)] hover:text-white">
          {tc("backWorkspaces")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{workspace.name}</h1>
        <p className="text-[var(--muted)]">{workspace.description}</p>
      </div>

      <Card>
        <CardTitle>{t("createTitle")}</CardTitle>
        <form action={createProjectAction} className="space-y-4">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input
            name="name"
            placeholder={t("namePlaceholder")}
            required
            className="w-full rounded-md border border-[var(--border)] bg-slate-900 px-3 py-2 text-sm"
          />
          <textarea
            name="description"
            placeholder={t("descPlaceholder")}
            rows={2}
            className="w-full rounded-md border border-[var(--border)] bg-slate-900 px-3 py-2 text-sm"
          />
          <Button type="submit">{t("createButton")}</Button>
        </form>
      </Card>

      <div className="space-y-4">
        {workspace.projects.map((project) => (
          <Card key={project.id}>
            <Link href={`/projects/${project.id}`} className="text-lg font-medium hover:text-[var(--accent)]">
              {project.name}
            </Link>
            <p className="text-sm text-[var(--muted)]">{project.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
