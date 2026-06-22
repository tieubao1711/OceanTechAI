import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/db/prisma";
import { officeHoursService } from "@/server/office-hours/office-hours.service";
import { agentAvatarService } from "@/server/workforce/agent-avatar.service";
import { DEPARTMENT_LABELS } from "@/server/workforce/workforce-types";
import { SUGGESTED_PROMPTS } from "@/server/office-hours/office-hours-types";
import { OFFICE_HOURS_ADVISORY_NOTICE } from "@/server/office-hours/office-hours-governance";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OfficeHoursChatPanel } from "@/components/office-hours-chat-panel";
import {
  sendOfficeHoursMessageAction,
  createDiscussionFromOfficeHoursAction,
  startOfficeHoursConversationAction,
} from "@/app/actions";
import { formatRoleLabel } from "@/server/agents/agent-profile";

export default async function OfficeHoursChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; agentId: string }>;
  searchParams: Promise<{ conversationId?: string }>;
}) {
  const { projectId, agentId } = await params;
  const { conversationId: selectedId } = await searchParams;
  const t = await getTranslations("officeHours");
  const ta = await getTranslations("agents");
  const tc = await getTranslations("common");

  const agent = await prisma.agent.findFirstOrThrow({
    where: { id: agentId, projectId },
  });

  const avatar = agentAvatarService.resolve(agent.avatarSeed ?? agent.name, agent.avatarType);
  const canChat =
    agent.workforceStatus === "ACTIVE" && agent.isActive;

  let conversationId = selectedId;
  if (!conversationId) {
    const existing = await officeHoursService.listConversations(projectId, agentId);
    conversationId = existing[0]?.id;
  }

  const conversations = await officeHoursService.listConversations(projectId, agentId);
  const conversation = conversationId
    ? await officeHoursService.getConversation(conversationId)
    : null;

  const lastAgentMsg = conversation?.messages
    .filter((m) => m.role === "agent")
    .at(-1);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/projects/${projectId}/agents/${agentId}`}
          className="text-sm text-[var(--muted)] hover:text-white"
        >
          {t("backProfile")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
            style={{ backgroundColor: `${avatar.color}22`, color: avatar.color }}
          >
            {avatar.emoji}
          </span>
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="text-sm text-[var(--muted)]">
              {agent.name} · {agent.title ?? formatRoleLabel(agent.role)} ·{" "}
              {DEPARTMENT_LABELS[agent.department]} · {agent.rank}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <p className="text-sm text-amber-400">⚠ {t("advisoryWarning")}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{OFFICE_HOURS_ADVISORY_NOTICE}</p>
      </Card>

      {!canChat && (
        <Card>
          <p className="text-sm text-amber-400">
            {agent.workforceStatus === "RETIRED"
              ? t("retiredBlocked")
              : agent.workforceStatus === "SUSPENDED"
                ? t("suspendedBlocked")
                : t("inactiveBlocked")}
          </p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-1">
          <CardTitle>{t("conversations")}</CardTitle>
          {conversations.length === 0 ? (
            <p className="mb-3 text-sm text-[var(--muted)]">{t("noConversations")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {conversations.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/projects/${projectId}/agents/${agentId}/chat?conversationId=${c.id}`}
                    className={`block rounded border px-3 py-2 hover:border-emerald-500/50 ${
                      c.id === conversationId ? "border-emerald-500/50 bg-emerald-500/5" : "border-[var(--border)]"
                    }`}
                  >
                    <p className="font-medium">{c.title ?? t("untitled")}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {c.messageCount} {t("messages")} · {c.updatedAt.toLocaleDateString()}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {canChat && (
            <form action={startOfficeHoursConversationAction.bind(null, projectId, agentId)} className="mt-4">
              <Button type="submit" variant="secondary" className="w-full">
                {t("newConversation")}
              </Button>
            </form>
          )}
        </Card>

        <Card className="md:col-span-3">
          <CardTitle>{t("thread")}</CardTitle>
          {!conversation ? (
            <div className="space-y-3 text-sm text-[var(--muted)]">
              <p>{t("startPrompt")}</p>
              {canChat && (
                <form action={startOfficeHoursConversationAction.bind(null, projectId, agentId)}>
                  <Button type="submit" variant="primary">{t("startChat")}</Button>
                </form>
              )}
            </div>
          ) : (
            <>
              <div className="mb-6 max-h-[28rem] space-y-4 overflow-y-auto">
                {conversation.messages.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">{t("emptyThread")}</p>
                ) : (
                  conversation.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded border px-4 py-3 text-sm ${
                        msg.role === "founder"
                          ? "border-blue-500/30 bg-blue-500/5"
                          : msg.role === "agent"
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-[var(--border)]"
                      }`}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant={msg.role === "founder" ? "info" : "success"}>
                          {msg.role === "founder" ? t("founder") : agent.name.split("—")[0]?.trim()}
                        </Badge>
                        <span className="text-xs text-[var(--muted)]">
                          {msg.createdAt.toLocaleString()}
                        </span>
                        {msg.tokenTotal != null && (
                          <span className="text-xs text-[var(--muted)]">
                            {t("tokens")}: {msg.tokenTotal}
                            {msg.fallbackUsed && ` · ${t("mockFallback")}`}
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      {msg.role === "agent" && canChat && (
                        <form action={createDiscussionFromOfficeHoursAction} className="mt-3">
                          <input type="hidden" name="conversationId" value={conversation.id} />
                          <input type="hidden" name="projectId" value={projectId} />
                          <input type="hidden" name="messageId" value={msg.id} />
                          <Button type="submit" variant="ghost">{t("createDiscussion")}</Button>
                        </form>
                      )}
                    </div>
                  ))
                )}
              </div>

              {canChat && (
                <OfficeHoursChatPanel
                  conversationId={conversation.id}
                  projectId={projectId}
                  agentId={agentId}
                  sendAction={sendOfficeHoursMessageAction}
                  createDiscussionAction={createDiscussionFromOfficeHoursAction}
                  suggestedPrompts={SUGGESTED_PROMPTS}
                  lastAgentMessageId={lastAgentMsg?.id}
                  lastTokenTotal={lastAgentMsg?.tokenTotal ?? undefined}
                  labels={{
                    placeholder: t("messagePlaceholder"),
                    send: t("send"),
                    createDiscussion: t("createDiscussionFromLast"),
                    suggestedPrompts: t("suggestedPrompts"),
                    tokenUsage: t("lastTokenUsage"),
                  }}
                />
              )}
            </>
          )}
        </Card>
      </div>

      <Link href={`/projects/${projectId}/agents/${agentId}`}>
        <Button variant="secondary">{tc("backAgents")}</Button>
      </Link>
    </div>
  );
}
