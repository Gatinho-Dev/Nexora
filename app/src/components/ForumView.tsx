import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router";
import { trpc } from "@/providers/trpc";
import { realtime } from "@/lib/ws";
import { Avatar } from "./Avatar";
import { MessageContent } from "./chat/MessageContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessagesSquare, Loader2, MessageSquare, ArrowLeft, SendHorizonal, Plus } from "lucide-react";
import { toast } from "sonner";
import type { AppOutletContext } from "@/lib/appOutletContext";
import type { MessageDTO } from "@contracts/types";

function postTitle(post: MessageDTO): string {
  const firstLine = post.content.split("\n")[0]?.trim();
  return firstLine || "Sem título";
}

function postBody(post: MessageDTO): string {
  const lines = post.content.split("\n");
  return lines.slice(1).join("\n").trim();
}

export function ForumView({ channelId }: { channelId: number }) {
  const { onOpenProfile } = useOutletContext<AppOutletContext>();
  const me = trpc.auth.me.useQuery().data;
  const utils = trpc.useUtils();
  const [openPostId, setOpenPostId] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [replyText, setReplyText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const postsQuery = trpc.forum.posts.useQuery(
    { channelId, limit: 50 },
    { enabled: openPostId === null }
  );
  const threadQuery = trpc.forum.thread.useQuery(
    { channelId, postId: openPostId! },
    { enabled: openPostId !== null }
  );

  const send = trpc.message.send.useMutation({
    onSuccess: () => {
      if (openPostId !== null) {
        utils.forum.thread.invalidate({ channelId, postId: openPostId });
        utils.forum.posts.invalidate({ channelId });
      }
      setReplyText("");
    },
    onError: e => toast.error(e.message),
  });

  // Live refresh for the open thread and the post list
  useEffect(() => {
    return realtime.on(event => {
      if (event.t !== "message:new") return;
      const msg = event.message;
      if (msg.channelId !== channelId) return;
      if (openPostId !== null) {
        if (
          msg.id === openPostId ||
          msg.replyToId === openPostId
        ) {
          utils.forum.thread.invalidate({ channelId, postId: openPostId });
        }
      }
      if (msg.replyToId === null) {
        utils.forum.posts.invalidate({ channelId });
      }
    });
  }, [channelId, openPostId, utils]);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
    });
  }, [threadQuery.data?.replies.length]);

  const canSend = useMemo(() => !!me && !send.isPending, [me, send.isPending]);

  const createPost = () => {
    const t = title.trim();
    if (!t) return;
    const content = body.trim() ? `${t}\n${body.trim()}` : t;
    send.mutate(
      { channelId, content },
      {
        onSuccess: () => {
          setTitle("");
          setBody("");
          setComposerOpen(false);
          utils.forum.posts.invalidate({ channelId });
        },
      }
    );
  };

  const sendReply = () => {
    const content = replyText.trim();
    if (!content || openPostId === null) return;
    send.mutate({ channelId, content, replyToId: openPostId });
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-chat text-foreground">
      {/* Forum header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-black/20 bg-chat px-4 select-none shadow-sm">
        <div className="flex min-w-0 items-center gap-2">
          {openPostId !== null ? (
            <button
              onClick={() => setOpenPostId(null)}
              className="rounded p-1 text-muted2 hover:bg-white/10 hover:text-foreground"
              title="Voltar para os posts"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <MessagesSquare className="h-5 w-5 shrink-0 text-faint" />
          )}
          <span className="truncate text-sm font-bold">
            {openPostId !== null
              ? threadQuery.data
                ? postTitle(threadQuery.data.post)
                : "Carregando..."
              : "Posts"}
          </span>
        </div>
        {openPostId === null && (
          <Button
            size="sm"
            onClick={() => setComposerOpen(o => !o)}
            className="bg-[#5865F2] hover:bg-[#4752C4] text-xs font-semibold"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Novo post
          </Button>
        )}
      </header>

      {openPostId === null ? (
        <>
          {/* New post composer */}
          {composerOpen && (
            <div className="mx-4 mt-3 space-y-2 rounded-xl border border-white/10 bg-sidebar p-3 shadow-lg">
              <Input
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Título do post"
                maxLength={200}
                className="bg-[#383A40] border-transparent text-sm font-semibold"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    createPost();
                  }
                }}
              />
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Escreva o conteúdo do post (opcional)"
                rows={3}
                maxLength={3800}
                className="w-full resize-none rounded-md bg-[#383A40] px-3 py-2 text-sm outline-none placeholder:text-faint"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setComposerOpen(false)}
                  className="text-muted2 hover:text-foreground"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={!title.trim() || send.isPending}
                  onClick={createPost}
                  className="bg-[#5865F2] hover:bg-[#4752C4] font-semibold"
                >
                  {send.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Publicar"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Post grid */}
          <div ref={listRef} className="flex-1 overflow-y-auto p-4">
            {postsQuery.isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted2" />
              </div>
            ) : (postsQuery.data?.posts.length ?? 0) === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <MessagesSquare className="h-10 w-10 text-faint" />
                <p className="text-sm font-semibold">Nenhum post ainda</p>
                <p className="max-w-xs text-xs text-muted2">
                  Comece a primeira discussão deste fórum criando um novo post.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {postsQuery.data!.posts.map(post => (
                  <button
                    key={post.id}
                    onClick={() => setOpenPostId(post.id)}
                    className="group flex h-fit flex-col rounded-xl border border-white/[0.06] bg-sidebar p-3.5 text-left transition-all hover:border-[#5865F2]/50 hover:bg-[#2f3136]"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onOpenProfile?.(post.authorId);
                        }}
                      >
                        <Avatar
                          userId={post.authorId}
                          name={post.author.name ?? "?"}
                          src={post.author.avatar}
                          size="xs"
                          showStatus={false}
                        />
                      </button>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold">
                          {post.author.name ?? post.author.username ?? "?"}
                        </div>
                        <div className="text-[10px] text-faint">
                          {new Date(post.createdAt).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                    </div>
                    <div className="line-clamp-2 text-sm font-bold leading-snug group-hover:text-bodyx">
                      {postTitle(post)}
                    </div>
                    {postBody(post) && (
                      <div className="mt-1 line-clamp-3 text-xs text-muted2">
                        <MessageContent content={postBody(post)} />
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-faint">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {postsQuery.data?.replyCounts[post.id] ?? 0}{" "}
                      {(postsQuery.data?.replyCounts[post.id] ?? 0) === 1
                        ? "resposta"
                        : "respostas"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Thread view */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4">
            {threadQuery.isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted2" />
              </div>
            ) : threadQuery.data ? (
              <div className="mx-auto max-w-3xl space-y-3">
                {/* Original post */}
                <div className="rounded-xl border border-white/10 bg-sidebar p-4">
                  <div className="flex items-start gap-3">
                    <Avatar
                      userId={threadQuery.data.post.authorId}
                      name={threadQuery.data.post.author.name ?? "?"}
                      src={threadQuery.data.post.author.avatar}
                      size="sm"
                      showStatus={false}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-bold">
                          {threadQuery.data.post.author.name ??
                            threadQuery.data.post.author.username}
                        </span>
                        <span className="text-[11px] text-faint">
                          {new Date(
                            threadQuery.data.post.createdAt
                          ).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div className="mt-1 text-base font-bold">
                        {postTitle(threadQuery.data.post)}
                      </div>
                      {postBody(threadQuery.data.post) && (
                        <div className="mt-1 text-sm text-bodyx">
                          <MessageContent content={postBody(threadQuery.data.post)} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Replies */}
                {threadQuery.data.replies.map(reply => (
                  <div key={reply.id} className="flex items-start gap-3 pl-2">
                    <Avatar
                      userId={reply.authorId}
                      name={reply.author.name ?? "?"}
                      src={reply.author.avatar}
                      size="xs"
                      showStatus={false}
                    />
                    <div className="min-w-0 flex-1 rounded-lg bg-sidebar/60 px-3 py-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-bold">
                          {reply.author.name ?? reply.author.username}
                        </span>
                        <span className="text-[10px] text-faint">
                          {new Date(reply.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div className="text-sm text-bodyx">
                        <MessageContent content={reply.content} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Reply input */}
          <div className="shrink-0 px-4 pb-4">
            <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-xl bg-[#383A40] px-3 py-2">
              <input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                placeholder="Responder ao post..."
                disabled={!canSend}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-faint disabled:opacity-50"
              />
              <button
                onClick={sendReply}
                disabled={!canSend || !replyText.trim()}
                className="text-[#5865F2] transition-colors hover:text-[#8ea1ff] disabled:opacity-40"
                title="Enviar resposta"
              >
                <SendHorizonal className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
