import { notFound } from "next/navigation";
import { repo } from "@/lib/db";
import { Reader } from "@/app/ui/Reader";

export const dynamic = "force-dynamic";

export default async function ReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paper = repo.getPaper(id);
  if (!paper) notFound();
  const blocks = repo.getBlocks(id);
  const conversation = repo.ensureConversation(id);
  const messages = repo.messages(conversation.id);
  const projects = repo.listProjectsForPaper(id);
  return <Reader paper={paper} initialBlocks={blocks} initialMessages={messages as Array<{
    id: string; role: string; content: string; selectedText?: string | null;
  }>}
    initialProjects={projects} />;
}
