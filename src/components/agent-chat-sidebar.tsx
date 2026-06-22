"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { SidebarAgentView } from "@/server/workforce/workforce-types";
import type { OfficeHoursConversationView } from "@/server/office-hours/office-hours-types";

type Props = {
  labels: {
    title: string;
    searchPlaceholder: string;
    advisoryWarning: string;
    send: string;
    messagePlaceholder: string;
    openFullChat: string;
    createDiscussion: string;
    noAgents: string;
    expand: string;
    collapse: string;
  };
  loadAgents: (pathname: string, search?: string) => Promise<SidebarAgentView[]>;
  loadChat: (projectId: string, agentId: string) => Promise<OfficeHoursConversationView>;
  sendMessage: (
    projectId: string,
    agentId: string,
    conversationId: string,
    content: string
  ) => Promise<OfficeHoursConversationView>;
  createDiscussion: (
    conversationId: string,
    projectId: string,
    messageId?: string
  ) => Promise<string>;
};

export function AgentChatSidebar({
  labels,
  loadAgents,
  loadChat,
  sendMessage,
  createDiscussion,
}: Props) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [agents, setAgents] = useState<SidebarAgentView[]>([]);
  const [selected, setSelected] = useState<SidebarAgentView | null>(null);
  const [chat, setChat] = useState<OfficeHoursConversationView | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const refreshAgents = useCallback(() => {
    startTransition(async () => {
      const list = await loadAgents(pathname, search || undefined);
      setAgents(list);
    });
  }, [pathname, search, loadAgents]);

  useEffect(() => {
    refreshAgents();
  }, [refreshAgents]);

  const selectAgent = (agent: SidebarAgentView) => {
    if (!agent.canChat) return;
    setSelected(agent);
    startTransition(async () => {
      const data = await loadChat(agent.chatProjectId, agent.id);
      setChat(data);
    });
  };

  const handleSend = () => {
    if (!selected || !chat || !message.trim()) return;
    const content = message.trim();
    setMessage("");
    startTransition(async () => {
      const updated = await sendMessage(
        selected.chatProjectId,
        selected.id,
        chat.id,
        content
      );
      setChat(updated);
      refreshAgents();
    });
  };

  const lastAgentMsg = chat?.messages.filter((m) => m.role === "agent").at(-1);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="fixed right-4 top-24 z-40 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm shadow-lg hover:border-emerald-500/50"
      >
        💬 {labels.expand}
      </button>
    );
  }

  return (
    <aside className="fixed right-0 top-16 z-40 flex h-[calc(100vh-4rem)] w-80 flex-col border-l border-[var(--border)] bg-[var(--card)] shadow-xl">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="text-sm font-semibold">{labels.title}</span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs text-[var(--muted)] hover:text-white"
        >
          {labels.collapse}
        </button>
      </div>

      <p className="border-b border-[var(--border)] px-3 py-2 text-xs text-amber-400">
        {labels.advisoryWarning}
      </p>

      <div className="border-b border-[var(--border)] p-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && refreshAgents()}
          placeholder={labels.searchPlaceholder}
          className="w-full rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-xs"
        />
      </div>

      {!selected ? (
        <div className="flex-1 overflow-y-auto p-2">
          {agents.length === 0 ? (
            <p className="p-2 text-xs text-[var(--muted)]">{labels.noAgents}</p>
          ) : (
            <ul className="space-y-1">
              {agents.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    disabled={!a.canChat || pending}
                    onClick={() => selectAgent(a)}
                    className="flex w-full items-center gap-2 rounded border border-[var(--border)] px-2 py-2 text-left text-xs hover:border-emerald-500/40 disabled:opacity-50"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${a.avatarColor}22`, color: a.avatarColor }}
                    >
                      {a.avatarEmoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{a.displayName}</span>
                      <span className="block truncate text-[var(--muted)]">{a.title} · {a.homeProjectName}</span>
                      {a.lastMessagePreview && (
                        <span className="block truncate text-[var(--muted)] opacity-70">
                          {a.lastMessagePreview}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col min-h-0">
          <button
            type="button"
            onClick={() => { setSelected(null); setChat(null); }}
            className="border-b border-[var(--border)] px-3 py-2 text-left text-xs text-[var(--muted)] hover:text-white"
          >
            ← {selected.displayName}
          </button>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {chat?.messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded px-2 py-1.5 text-xs ${
                  msg.role === "founder"
                    ? "bg-blue-500/10 text-blue-200"
                    : "bg-emerald-500/10 text-emerald-200"
                }`}
              >
                {msg.content}
              </div>
            ))}
          </div>
          <div className="border-t border-[var(--border)] p-2 space-y-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={labels.messagePlaceholder}
              rows={2}
              className="w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-xs"
            />
            <Button
              type="button"
              variant="primary"
              className="w-full text-xs"
              disabled={pending || !message.trim()}
              onClick={handleSend}
            >
              {labels.send}
            </Button>
            {lastAgentMsg && chat && (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const url = await createDiscussion(
                      chat.id,
                      selected.chatProjectId,
                      lastAgentMsg.id
                    );
                    window.location.href = url;
                  });
                }}
              >
                {labels.createDiscussion}
              </Button>
            )}
            <Link
              href={`/projects/${selected.chatProjectId}/agents/${selected.id}/chat`}
              className="block text-center text-xs text-emerald-400 hover:underline"
            >
              {labels.openFullChat}
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
}
