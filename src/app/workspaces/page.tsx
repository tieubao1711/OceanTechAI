import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { workspaceService } from "@/server/services/workspace.service";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createWorkspaceAction } from "@/app/actions";

export default async function WorkspacesPage() {
  const t = await getTranslations("workspaces");
  const tc = await getTranslations("common");
  const workspaces = await workspaceService.list();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      <Card>
        <CardTitle>{t("createTitle")}</CardTitle>
        <form action={createWorkspaceAction} className="space-y-4">
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
        {workspaces.map((ws) => (
          <Card key={ws.id}>
            <div className="flex items-center justify-between">
              <div>
                <Link href={`/workspaces/${ws.id}`} className="text-lg font-medium hover:text-[var(--accent)]">
                  {ws.name}
                </Link>
                <p className="text-sm text-[var(--muted)]">{ws.description}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {t("projectCount", { count: ws.projects.length })} · {tc("owner")}: {ws.owner.name}
                </p>
              </div>
              <Link href={`/workspaces/${ws.id}`}>
                <Button variant="secondary">{tc("open")}</Button>
              </Link>
            </div>
          </Card>
        ))}
        {workspaces.length === 0 && (
          <p className="text-[var(--muted)]">{t("empty")}</p>
        )}
      </div>
    </div>
  );
}
