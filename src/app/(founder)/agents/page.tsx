import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { founderService } from "@/server/founder/founder.service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function GlobalAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const t = await getTranslations("founderAgents");
  const tc = await getTranslations("common");
  const ta = await getTranslations("agents");

  const agents = await founderService.getGlobalAgents(q);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-[var(--muted)]">{t("subtitle")}</p>
      </div>

      <form className="flex gap-3">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder={t("searchPlaceholder")}
          className="flex-1 rounded border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
        />
        <Button type="submit" variant="secondary">{t("search")}</Button>
      </form>

      {agents.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">{t("empty")}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-4">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl"
                    style={{ backgroundColor: `${agent.avatarColor}22`, color: agent.avatarColor }}
                  >
                    {agent.avatarEmoji}
                  </span>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{agent.displayName}</h3>
                      <Badge variant={agent.status === "active" ? "success" : "default"}>
                        {agent.status}
                      </Badge>
                      <Badge variant="info">{agent.departmentLabel}</Badge>
                      <Badge variant="default">{agent.homeProjectName}</Badge>
                    </div>
                    <p className="text-sm text-[var(--muted)]">
                      {agent.title} · {agent.rank}
                    </p>
                    <p className="text-sm">
                      {ta("reputation")}: {agent.reputation.toFixed(1)} · {tc("influenceScore")}: {agent.influenceScore}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {t("activeProjects")}: {agent.activeProjects.join(", ")}
                    </p>
                    {agent.expertise.length > 0 && (
                      <p className="text-xs text-[var(--muted)]">
                        {tc("expertise")}: {agent.expertise.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Link href={agent.profileHref}>
                    <Button variant="primary">{tc("viewProfile")}</Button>
                  </Link>
                  {agent.status === "active" && (
                    <Link href={agent.officeHoursHref}>
                      <Button variant="secondary" className="w-full">{ta("officeHours")}</Button>
                    </Link>
                  )}
                  <Link href={`/organization#agent-${agent.id}`}>
                    <Button variant="ghost" className="w-full">{t("viewAssignments")}</Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
