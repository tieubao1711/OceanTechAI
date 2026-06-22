import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { executiveService } from "@/server/services/executive.service";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function ProjectTimelinePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const t = await getTranslations("timeline");
  const tc = await getTranslations("common");
  const events = await executiveService.getTimeline(projectId);

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/projects/${projectId}/executive`} className="text-sm text-[var(--muted)] hover:text-white">
          {tc("backExecutive")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-[var(--muted)]">{t("subtitle")}</p>
      </div>

      <Card>
        <CardTitle>{t("events")}</CardTitle>
        {events.length === 0 ? (
          <div className="space-y-4 text-sm text-[var(--muted)]">
            <p>{t("empty")}</p>
            <Link href={`/projects/${projectId}/discussions/new`}>
              <Button variant="primary">{t("createFirstDiscussion")}</Button>
            </Link>
          </div>
        ) : (
          <div className="relative space-y-0">
            {events.map((event, index) => (
              <div key={event.id} className="flex gap-4 pb-6">
                <div className="flex w-28 shrink-0 flex-col items-end pt-1 text-right">
                  <span className="font-mono text-xs text-emerald-400">
                    {event.occurredAt.toISOString().slice(0, 10)}
                  </span>
                </div>
                <div className="relative flex flex-1 flex-col border-l border-[var(--border)] pl-6">
                  <span
                    className="absolute -left-1.5 top-2 h-3 w-3 rounded-full bg-emerald-500"
                    aria-hidden
                  />
                  <div className="rounded border border-[var(--border)] p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="default">{event.eventType}</Badge>
                      <span className="font-medium">{event.title}</span>
                    </div>
                    {event.description && (
                      <p className="mt-1 text-sm text-[var(--muted)]">{event.description}</p>
                    )}
                  </div>
                  {index < events.length - 1 && null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
