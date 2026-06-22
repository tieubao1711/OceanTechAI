"use client";

import { useTranslations } from "next-intl";
import type { DebateProgress } from "@/server/services/debate-progress.service";

type Props = {
  progress: DebateProgress | null;
  isStarting?: boolean;
};

const ROUND_NUMBERS = [1, 2, 3, 4, 5] as const;

function StepIcon({ status }: { status: "pending" | "running" | "completed" }) {
  if (status === "completed") {
    return (
      <span className="debate-step-icon debate-step-icon--done">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }

  if (status === "running") {
    return (
      <span className="debate-step-icon debate-step-icon--active">
        <span className="debate-spinner" />
      </span>
    );
  }

  return <span className="debate-step-icon debate-step-icon--pending" />;
}

export function DebateProgressPanel({ progress, isStarting }: Props) {
  const t = useTranslations("discussion");

  const percent = progress?.overallPercent ?? (isStarting ? 8 : 0);
  const phase = progress?.phase ?? (isStarting ? "debating" : "idle");
  const currentRound = progress?.currentRound;

  const statusLine =
    phase === "finalizing"
      ? t("progressFinalizing")
      : phase === "completed"
        ? t("progressCompleted")
        : phase === "failed"
          ? t("progressFailed")
          : isStarting && !progress
            ? t("progressStarting")
            : t("progressSubtitle");

  const rounds =
    progress?.rounds ??
    ROUND_NUMBERS.map((n) => ({
      roundNumber: n,
      roundType: "",
      status: (isStarting && n === 1 ? "running" : "pending") as "pending" | "running" | "completed",
      messageCount: 0,
    }));

  const roundLabels: Record<number, string> = {
    1: t("round1"),
    2: t("round2"),
    3: t("round3"),
    4: t("round4"),
    5: t("round5"),
  };

  return (
    <div className="debate-progress-panel" role="status" aria-live="polite">
      <div className="debate-progress-panel__glow" aria-hidden />

      <div className="debate-progress-panel__header">
        <div>
          <h2 className="debate-progress-panel__title">{t("progressTitle")}</h2>
          <p className="debate-progress-panel__status">{statusLine}</p>
        </div>
        <div className="debate-progress-panel__percent">
          {t("progressPercent", { n: percent })}
        </div>
      </div>

      <div className="debate-progress-bar" aria-hidden>
        <div
          className="debate-progress-bar__fill"
          style={{ width: `${percent}%` }}
        />
        {phase === "debating" || phase === "finalizing" || isStarting ? (
          <div className="debate-progress-bar__shimmer" />
        ) : null}
      </div>

      <ol className="debate-steps">
        {rounds.map((round, index, arr) => {
          const label = roundLabels[round.roundNumber] ?? t("roundN", { n: round.roundNumber });
          const isActive = round.status === "running" || currentRound === round.roundNumber;

          return (
            <li
              key={round.roundNumber}
              className={`debate-step debate-step--${round.status}${isActive ? " debate-step--highlight" : ""}`}
            >
              <div className="debate-step__track">
                <StepIcon status={round.status} />
                {index < arr.length - 1 && (
                  <span
                    className={`debate-step__connector${
                      round.status === "completed" ? " debate-step__connector--done" : ""
                    }`}
                  />
                )}
              </div>
              <div className="debate-step__body">
                <span className="debate-step__label">{label}</span>
                {round.status === "running" && round.roundType && (
                  <span className="debate-step__meta debate-step__meta--pulse">
                    {round.roundType}
                  </span>
                )}
                {round.status === "completed" && round.messageCount > 0 && (
                  <span className="debate-step__meta">
                    {t("roundMessages", { count: round.messageCount })}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {phase === "failed" && progress?.lastError && (
        <p className="debate-progress-panel__error">{progress.lastError}</p>
      )}
    </div>
  );
}
