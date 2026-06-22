import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { founderService } from "@/server/founder/founder.service";
import { getFounderScope } from "@/server/founder/founder-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { translateStatus } from "@/i18n/status";

export default async function GlobalDiscussionsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; status?: string; topic?: string }>;
}) {
  const filters = await searchParams;
  const t = await getTranslations("founderDiscussions");
  const ts = await getTranslations("status");
  const scope = await getFounderScope();

  const projects = await founderService.getGlobalProjects();
  const discussions = await founderService.getGlobalDiscussions(filters);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-[var(--muted)]">{t("subtitle")}</p>
      </div>

      <Card>
        <form className="grid gap-3 md:grid-cols-4">
          <select
            name="projectId"
            defaultValue={filters.projectId ?? ""}
            className="rounded border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          >
            <option value="">{t("allProjects")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="rounded border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          >
            <option value="">{t("allStatuses")}</option>
            {["DRAFT", "RUNNING", "COMPLETED", "FAILED"].map((s) => (
              <option key={s} value={s}>{translateStatus(ts, s)}</option>
            ))}
          </select>
          <input
            name="topic"
            defaultValue={filters.topic ?? ""}
            placeholder={t("topicFilter")}
            className="rounded border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          />
          <Button type="submit" variant="secondary">{t("filter")}</Button>
        </form>
      </Card>

      {discussions.length === 0 ? (
        <Card><p className="text-sm text-[var(--muted)]">{t("empty")}</p></Card>
      ) : (
        <div className="space-y-3">
          {discussions.map((d) => (
            <Card key={d.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Link href={d.href} className="font-medium hover:text-emerald-400">
                    {d.userPrompt.slice(0, 120)}
                    {d.userPrompt.length > 120 ? "…" : ""}
                  </Link>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="info">{d.projectName}</Badge>
                    <Badge variant="default">{translateStatus(ts, d.status)}</Badge>
                    {d.proposalStatus && (
                      <Badge variant="warning">{translateStatus(ts, d.proposalStatus)}</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {d.createdAt.toLocaleString()} · {d.mode}
                  </p>
                </div>
                <Link href={d.href}>
                  <Button variant="ghost">{t("open")}</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {scope.primaryProjectId && (
        <Link href={`/projects/${scope.primaryProjectId}/discussions/new`}>
          <Button variant="primary">{t("newDiscussion")}</Button>
        </Link>
      )}
    </div>
  );
}
