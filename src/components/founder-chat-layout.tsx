import { getTranslations } from "next-intl/server";
import { AgentChatSidebar } from "@/components/agent-chat-sidebar";
import {
  loadSidebarAgentsAction,
  loadSidebarChatAction,
  sendSidebarMessageAction,
  sidebarCreateDiscussionAction,
} from "@/app/actions";

export async function FounderChatLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("agentSidebar");

  return (
    <div className="relative pr-0 lg:pr-4">
      {children}
      <AgentChatSidebar
        labels={{
          title: t("title"),
          searchPlaceholder: t("searchPlaceholder"),
          advisoryWarning: t("advisoryWarning"),
          send: t("send"),
          messagePlaceholder: t("messagePlaceholder"),
          openFullChat: t("openFullChat"),
          createDiscussion: t("createDiscussion"),
          noAgents: t("noAgents"),
          expand: t("expand"),
          collapse: t("collapse"),
        }}
        loadAgents={loadSidebarAgentsAction}
        loadChat={loadSidebarChatAction}
        sendMessage={sendSidebarMessageAction}
        createDiscussion={sidebarCreateDiscussionAction}
      />
    </div>
  );
}
