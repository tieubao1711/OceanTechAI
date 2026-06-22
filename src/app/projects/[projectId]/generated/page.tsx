import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { proposalService } from "@/server/services/proposal.service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function GeneratedFilesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const t = await getTranslations("generated");
  const tc = await getTranslations("common");
  const files = await proposalService.listGeneratedFiles(projectId);

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/projects/${projectId}`} className="text-sm text-[var(--muted)] hover:text-white">
          {tc("backProject")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-[var(--muted)]">{t("subtitle")}</p>
      </div>

      {files.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">{t("empty")}</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {files.map((file) => (
            <Card key={file.id}>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="font-mono text-sm text-[var(--accent)]">{file.path}</h3>
                <Badge variant="success">{file.proposal.title}</Badge>
              </div>
              <pre className="max-h-96 overflow-auto rounded bg-slate-950 p-4 text-xs text-slate-300 whitespace-pre-wrap">
                {file.content}
              </pre>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
