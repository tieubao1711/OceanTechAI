"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DebateProgressPanel } from "@/components/debate-progress-panel";
import type { DebateLiveState, LiveAgentMessage } from "@/server/services/debate-live.service";

function formatRole(role: string) {
  return role.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function roundLabelKey(roundNumber: number) {
  const keys: Record<number, string> = {
    1: "round1",
    2: "round2",
    3: "round3",
    4: "round4",
    5: "round5",
  };
  return keys[roundNumber] ?? "roundN";
}

type Props = {
  discussionId: string;
  projectId: string;
  initialState: DebateLiveState;
};

function MessageCard({
  msg,
  isNew,
  labels,
}: {
  msg: LiveAgentMessage;
  isNew: boolean;
  labels: { concerns: string; suggestions: string; fallback: string };
}) {
  return (
    <div className={`debate-message${isNew ? " debate-message--enter" : ""}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-medium">{msg.agentName}</span>
        <Badge variant="info">{formatRole(msg.agentRole)}</Badge>
        <Badge variant="default">{msg.stance}</Badge>
        {msg.vote && (
          <Badge variant={msg.vote === "YES" ? "success" : msg.vote === "NO" ? "danger" : "warning"}>
            {msg.vote}
          </Badge>
        )}
        {msg.qualityScore != null && (
          <Badge variant={msg.qualityScore >= 60 ? "success" : "warning"}>
            Q:{msg.qualityScore}
          </Badge>
        )}
        {msg.provider && (
          <span className="text-xs text-[var(--muted)]">
            {msg.provider}/{msg.model}
            {msg.fallbackUsed && ` ${labels.fallback}`}
          </span>
        )}
      </div>
      <p className="text-sm">{msg.content}</p>
      {msg.concerns.length > 0 && (
        <p className="mt-2 text-xs text-amber-400">
          {labels.concerns}: {msg.concerns.join("; ")}
        </p>
      )}
      {msg.suggestions.length > 0 && (
        <p className="mt-1 text-xs text-sky-400">
          {labels.suggestions}: {msg.suggestions.join("; ")}
        </p>
      )}
    </div>
  );
}

function ThinkingPlaceholder({ label }: { label: string }) {
  return (
    <div className="debate-thinking" aria-hidden>
      <span className="debate-thinking__dots">
        <span />
        <span />
        <span />
      </span>
      <span className="debate-thinking__text">{label}</span>
    </div>
  );
}

export function DebateLiveView({ discussionId, projectId, initialState }: Props) {
  const t = useTranslations("discussion");
  const tc = useTranslations("common");
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [live, setLive] = useState(initialState.discussionStatus === "RUNNING");
  const [starting, setStarting] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const seenIdsRef = useRef(new Set(collectMessageIds(initialState)));
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runStartedRef = useRef(false);

  const canRun =
    state.discussionStatus === "DRAFT" || state.discussionStatus === "FAILED";

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/discussions/${discussionId}/live`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as DebateLiveState;
  }, [discussionId]);

  const applyState = useCallback((next: DebateLiveState) => {
    const freshIds = new Set<string>();
    for (const round of next.rounds) {
      for (const msg of round.messages) {
        if (!seenIdsRef.current.has(msg.id)) freshIds.add(msg.id);
      }
    }

    if (freshIds.size > 0) {
      setNewIds(freshIds);
      freshIds.forEach((id) => seenIdsRef.current.add(id));
      setTimeout(() => setNewIds(new Set()), 1200);
    }

    setState(next);

    if (next.phase === "completed" || next.phase === "failed") {
      setLive(false);
      setStarting(false);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      router.refresh();
    }
  }, [router]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const next = await fetchState();
      if (next) applyState(next);
    }, 800);
  }, [applyState, fetchState]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (live) startPolling();
    return stopPolling;
  }, [live, startPolling, stopPolling]);

  useEffect(() => {
    if (initialState.discussionStatus === "RUNNING") {
      setLive(true);
    }
  }, [initialState.discussionStatus]);

  const handleRun = async () => {
    if (runStartedRef.current) return;
    runStartedRef.current = true;
    setLive(true);
    setStarting(true);
    setState((prev) => ({
      ...prev,
      discussionStatus: "RUNNING",
      phase: "debating",
      overallPercent: 5,
      rounds: prev.rounds.map((r, i) =>
        i === 0 ? { ...r, status: "running" as const } : r
      ),
    }));
    startPolling();

    try {
      await fetch(`/api/discussions/${discussionId}/run-debate`, {
        method: "POST",
      });
      const final = await fetchState();
      if (final) applyState(final);
    } catch {
      const final = await fetchState();
      if (final) applyState(final);
    } finally {
      runStartedRef.current = false;
      setStarting(false);
    }
  };

  const showPanel = live || starting || state.discussionStatus === "RUNNING";

  const progressForPanel = showPanel
    ? {
        discussionStatus: state.discussionStatus,
        lastError: state.lastError,
        rounds: state.rounds.map((r) => ({
          roundNumber: r.roundNumber,
          roundType: r.roundType,
          status: r.status,
          messageCount: r.messageCount,
        })),
        currentRound: state.currentRound,
        overallPercent: state.overallPercent,
        phase: state.phase,
      }
    : null;

  return (
    <div className="space-y-8">
      {showPanel && (
        <DebateProgressPanel
          progress={progressForPanel}
          isStarting={starting && state.overallPercent < 10}
        />
      )}

      {canRun && !showPanel && (
        <Button type="button" variant="primary" onClick={handleRun}>
          {state.discussionStatus === "FAILED" ? t("retryDebate") : t("runDebate")}
        </Button>
      )}

      {state.rounds.map((round) => {
        const isActive = round.status === "running";
        if (
          !showPanel &&
          round.messages.length === 0 &&
          round.status !== "completed" &&
          !(state.consensus && round.roundNumber === 5)
        ) {
          return null;
        }

        const roundTitle = (() => {
          const key = roundLabelKey(round.roundNumber);
          if (key === "roundN") return t("roundN", { n: round.roundNumber });
          return t(key as "round1");
        })();

        return (
          <Card
            key={round.roundNumber}
            className={isActive ? "debate-round-card--active" : undefined}
          >
            <CardTitle>
              {roundTitle}
              <Badge className="ml-2" variant="default">{round.roundType}</Badge>
              {showPanel && round.status !== "completed" && (
                <Badge className="ml-2" variant={isActive ? "info" : "warning"}>
                  {isActive ? t("roundInProgress") : t("roundWaiting")}
                </Badge>
              )}
              {round.status === "completed" && round.messageCount > 0 && (
                <Badge className="ml-2" variant="success">
                  {t("roundMessages", { count: round.messageCount })}
                </Badge>
              )}
            </CardTitle>

            {round.roundNumber === 5 && state.consensus ? (
              <div className="space-y-3 text-sm">
                <p><strong>{t("consensusTitle")}:</strong> {state.consensus.title}</p>
                <p><strong>{t("finalDecision")}:</strong> {state.consensus.finalDecision}</p>
                <p>
                  <strong>{t("vote")}:</strong> yes={state.consensus.voteSummary.yes},
                  no={state.consensus.voteSummary.no},
                  abstain={state.consensus.voteSummary.abstain}
                </p>
                <p><strong>{t("classification")}:</strong> {state.consensus.voteSummary.classification}</p>
                {state.consensus.risks.length > 0 && (
                  <div>
                    <strong>{t("risks")}:</strong>
                    <ul className="ml-4 list-disc text-[var(--muted)]">
                      {state.consensus.risks.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {round.messages.map((msg) => (
                  <MessageCard
                    key={msg.id}
                    msg={msg}
                    isNew={newIds.has(msg.id)}
                    labels={{
                      concerns: t("concerns"),
                      suggestions: t("suggestions"),
                      fallback: t("fallback"),
                    }}
                  />
                ))}

                {Array.from({ length: round.thinkingCount }).map((_, i) => (
                  <ThinkingPlaceholder
                    key={`thinking-${round.roundNumber}-${i}`}
                    label={t("agentThinking")}
                  />
                ))}

                {round.messages.length === 0 &&
                  round.thinkingCount === 0 &&
                  round.roundType !== "CONSENSUS" &&
                  isActive && (
                    <div className="debate-round-skeleton space-y-3" aria-hidden>
                      <div className="debate-skeleton-line debate-skeleton-line--wide" />
                      <div className="debate-skeleton-line" />
                      <p className="text-xs text-sky-400/80">{t("agentsDebating")}</p>
                    </div>
                  )}

                {round.messages.length === 0 &&
                  !isActive &&
                  round.status === "pending" &&
                  !showPanel && (
                    <p className="text-sm text-[var(--muted)]">{t("noMessages")}</p>
                  )}
              </div>
            )}
          </Card>
        );
      })}

      {state.proposal && (
        <Card>
          <CardTitle>{t("proposalCreated")}</CardTitle>
          <p className="text-sm text-[var(--muted)]">
            {t("statusLabel")}: {state.proposal.status}
            {state.proposal.qualityScore != null &&
              ` · ${t("quality")}: ${state.proposal.qualityScore}/100`}
          </p>
          <Link
            href={`/projects/${projectId}/proposals/${state.proposal.id}`}
            className="mt-4 inline-block"
          >
            <Button>{tc("reviewProposal")}</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}

function collectMessageIds(s: DebateLiveState) {
  const ids = new Set<string>();
  for (const round of s.rounds) {
    for (const msg of round.messages) ids.add(msg.id);
  }
  return ids;
}
