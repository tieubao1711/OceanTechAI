"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ProjectTeamPageData } from "@/server/workforce/workforce-types";

type Props = {
  team: ProjectTeamPageData;
  labels: Record<string, string>;
  addAgent: (formData: FormData) => Promise<void>;
  removeAgent: (formData: FormData) => Promise<void>;
  setLead: (formData: FormData) => Promise<void>;
  updateAssignment: (formData: FormData) => Promise<void>;
};

export function ProjectTeamPanel({
  team,
  labels,
  addAgent,
  removeAgent,
  setLead,
  updateAssignment,
}: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ agentId: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<string | null>(null);

  const healthVariant =
    team.teamHealth.status === "healthy"
      ? "success"
      : team.teamHealth.status === "warning"
        ? "warning"
        : "danger";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{labels.teamTitle}</h2>
          <p className="text-sm text-[var(--muted)]">{labels.teamSubtitle}</p>
        </div>
        <Button variant="primary" onClick={() => setShowAdd(true)}>
          {labels.addAgent}
        </Button>
      </div>

      <div className="rounded border border-[var(--border)] p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-medium">{labels.teamHealth}</span>
          <Badge variant={healthVariant}>{team.teamHealth.status}</Badge>
        </div>
        <ul className="space-y-1 text-sm text-[var(--muted)]">
          {team.teamHealth.messages.map((m, i) => (
            <li key={i}>• {m}</li>
          ))}
        </ul>
        {team.teamHealth.suggestedAgents.length > 0 && (
          <p className="mt-2 text-xs text-emerald-400">
            {labels.suggestions}: {team.teamHealth.suggestedAgents.join("; ")}
          </p>
        )}
      </div>

      {team.warnings.some((w) => w.includes("overallocated")) && (
        <p className="text-sm text-amber-400">⚠ {labels.overallocatedWarning}</p>
      )}

      {team.members.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{labels.noMembers}</p>
      ) : (
        <div className="space-y-3">
          {team.members.map((m) => (
            <div
              key={m.assignmentId}
              className="rounded border border-[var(--border)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                    style={{ backgroundColor: `${m.avatarColor}22`, color: m.avatarColor }}
                  >
                    {m.avatarEmoji}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{m.agentName}</span>
                      {m.isLead && <Badge variant="success">{labels.lead}</Badge>}
                      {m.isOverallocated && <Badge variant="warning">OVERALLOCATED</Badge>}
                    </div>
                    <p className="text-sm text-[var(--muted)]">
                      {m.title} · {m.departmentLabel} · {m.projectRole}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {m.allocationPercent}% · {labels.reputation}: {m.reputation.toFixed(1)} · {labels.influence}: {m.influenceScore}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/projects/${m.homeProjectId}/agents/${m.agentId}/chat`}>
                    <Button variant="secondary">{labels.officeHours}</Button>
                  </Link>
                  {!m.isLead && (
                    <form action={setLead}>
                      <input type="hidden" name="projectId" value={team.projectId} />
                      <input type="hidden" name="agentId" value={m.agentId} />
                      <Button type="submit" variant="ghost">{labels.setLead}</Button>
                    </form>
                  )}
                  <Button variant="ghost" onClick={() => setEditTarget(m.agentId)}>
                    {labels.edit}
                  </Button>
                  <Button variant="ghost" onClick={() => setRemoveTarget({ agentId: m.agentId, name: m.agentName })}>
                    {labels.remove}
                  </Button>
                </div>
              </div>

              {editTarget === m.agentId && (
                <form action={updateAssignment} className="mt-3 grid gap-2 border-t border-[var(--border)] pt-3 md:grid-cols-3">
                  <input type="hidden" name="projectId" value={team.projectId} />
                  <input type="hidden" name="agentId" value={m.agentId} />
                  <input
                    name="role"
                    defaultValue={m.projectRole}
                    placeholder={labels.projectRole}
                    className="rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
                  />
                  <input
                    name="allocationPercent"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={m.allocationPercent}
                    className="rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
                  />
                  <Button type="submit" variant="secondary">{labels.save}</Button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {team.recentEvents.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">{labels.recentChanges}</h3>
          <ul className="space-y-1 text-xs text-[var(--muted)]">
            {team.recentEvents.map((e) => (
              <li key={e.id}>
                {e.createdAt.toLocaleString()} — [{e.type}] {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
            <h3 className="mb-4 font-semibold">{labels.addAgent}</h3>
            <form
              action={async (fd) => {
                await addAgent(fd);
                setShowAdd(false);
              }}
              className="space-y-3"
            >
              <input type="hidden" name="projectId" value={team.projectId} />
              <select name="agentId" required className="w-full rounded border border-[var(--border)] bg-transparent px-3 py-2 text-sm">
                <option value="">{labels.selectAgent}</option>
                {team.availableAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.title ?? a.department}
                  </option>
                ))}
              </select>
              <input name="role" placeholder={labels.projectRole} required className="w-full rounded border border-[var(--border)] bg-transparent px-3 py-2 text-sm" />
              <input name="allocationPercent" type="number" min={1} max={100} defaultValue={100} className="w-full rounded border border-[var(--border)] bg-transparent px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isLead" value="true" />
                {labels.leadQuestion}
              </label>
              <div className="flex gap-2">
                <Button type="submit" variant="primary">{labels.add}</Button>
                <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>{labels.cancel}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
            <p className="mb-4 text-sm">
              {labels.removeConfirm.replace("{name}", removeTarget.name).replace("{project}", team.projectName)}
            </p>
            <p className="mb-4 text-xs text-[var(--muted)]">{labels.removeNote}</p>
            <form action={async (fd) => { await removeAgent(fd); setRemoveTarget(null); }} className="flex gap-2">
              <input type="hidden" name="projectId" value={team.projectId} />
              <input type="hidden" name="agentId" value={removeTarget.agentId} />
              <Button type="submit" variant="primary">{labels.confirmRemove}</Button>
              <Button type="button" variant="ghost" onClick={() => setRemoveTarget(null)}>{labels.cancel}</Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
