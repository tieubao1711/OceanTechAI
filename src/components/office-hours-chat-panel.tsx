"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  conversationId: string;
  projectId: string;
  agentId: string;
  sendAction: (formData: FormData) => Promise<void>;
  createDiscussionAction: (formData: FormData) => Promise<void>;
  suggestedPrompts: readonly string[];
  labels: {
    placeholder: string;
    send: string;
    createDiscussion: string;
    suggestedPrompts: string;
    tokenUsage: string;
  };
  lastAgentMessageId?: string;
  lastTokenTotal?: number;
};

export function OfficeHoursChatPanel({
  conversationId,
  projectId,
  agentId,
  sendAction,
  createDiscussionAction,
  suggestedPrompts,
  labels,
  lastAgentMessageId,
  lastTokenTotal,
}: Props) {
  const [message, setMessage] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-[var(--muted)]">
          {labels.suggestedPrompts}
        </p>
        <div className="flex flex-wrap gap-2">
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setMessage(prompt)}
              className="rounded border border-[var(--border)] px-3 py-1.5 text-xs hover:border-emerald-500/50 hover:text-emerald-400"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <form action={sendAction} className="space-y-3">
        <input type="hidden" name="conversationId" value={conversationId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="agentId" value={agentId} />
        <textarea
          name="content"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={labels.placeholder}
          rows={4}
          required
          className="w-full rounded border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={!message.trim()}>
            {labels.send}
          </Button>
          {lastTokenTotal != null && (
            <span className="text-xs text-[var(--muted)]">
              {labels.tokenUsage}: {lastTokenTotal}
            </span>
          )}
        </div>
      </form>

      {lastAgentMessageId && (
        <form action={createDiscussionAction}>
          <input type="hidden" name="conversationId" value={conversationId} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="messageId" value={lastAgentMessageId} />
          <Button type="submit" variant="secondary">{labels.createDiscussion}</Button>
        </form>
      )}
    </div>
  );
}
