import { getTranslations } from "next-intl/server";
import { founderService } from "@/server/founder/founder.service";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { translateStatus } from "@/i18n/status";

export default async function GlobalLearningPage() {
  const t = await getTranslations("founderLearning");
  const ts = await getTranslations("status");
  const learning = await founderService.getGlobalLearning();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-[var(--muted)]">{t("subtitle")}</p>
        <p className="mt-2 text-2xl font-bold text-emerald-400">
          {t("healthScore")}: {learning.healthScore}%
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>{t("verifiedImprovements")}</CardTitle>
          <ul className="space-y-2 text-sm">
            {learning.verifiedImprovements.map((v, i) => (
              <li key={i} className="rounded border border-[var(--border)] px-3 py-2">
                <Badge variant="success" className="mr-2">{translateStatus(ts, "VERIFIED")}</Badge>
                {v.title}
                <span className="ml-2 text-xs text-[var(--muted)]">{v.projectName}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>{t("repeatedMistakes")}</CardTitle>
          <ul className="space-y-2 text-sm text-amber-400">
            {learning.repeatedMistakes.map((m, i) => (
              <li key={i}>
                ⚠ {m.title}
                <span className="ml-2 text-xs text-[var(--muted)]">{m.projectName}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>{t("topLearnings")}</CardTitle>
          <ul className="space-y-2 text-sm">
            {learning.topLearnings.map((l, i) => (
              <li key={i}>
                {l.title}
                <span className="ml-2 text-xs text-[var(--muted)]">
                  {l.projectName} ×{l.evidenceCount}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>{t("recentAdrs")}</CardTitle>
          <ul className="space-y-2 text-sm">
            {learning.recentAdrs.map((a, i) => (
              <li key={i}>
                {a.title}
                <span className="ml-2 text-xs text-[var(--muted)]">{a.projectName}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardTitle>{t("improvementCycles")}</CardTitle>
        <ul className="space-y-2 text-sm">
          {learning.improvementCycles.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              <Badge variant="info">{translateStatus(ts, c.status)}</Badge>
              {c.title}
              <span className="text-xs text-[var(--muted)]">{c.projectName}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
