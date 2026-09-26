import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, MessageSquare, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { friendlyError, adminContactMessagesQuery, deleteContactMessage } from "@/lib/admin";

export const Route = createFileRoute("/admin/messages")({ component: AdminMessages });

function AdminMessages() {
  const qc = useQueryClient();
  const messages = useQuery(adminContactMessagesQuery());

  const remove = async (id: string) => {
    if (!window.confirm("Delete this message? This cannot be undone.")) return;
    try {
      await deleteContactMessage(id);
      await qc.invalidateQueries({ queryKey: ["admin", "contact-messages"] });
      toast.success("Message deleted.");
    } catch (err) {
      toast.error(friendlyError(err, "Could not delete the message."));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Messages submitted through the public Contact page.
        </p>
      </div>

      {messages.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : messages.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-sm">
          Could not load messages. {friendlyError(messages.error, "Please try again.")}<br /><Button size="sm" variant="outline" className="mt-3" onClick={() => void messages.refetch()}>Retry</Button>
        </div>
      ) : (messages.data ?? []).length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No messages yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Messages sent from the website contact form will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(messages.data ?? []).map((m) => (
            <article key={m.id} className="rounded-lg border border-border bg-card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="font-semibold">{m.name}</h2>
                  <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                    <a className="inline-flex items-center gap-2 hover:text-foreground" href={`mailto:${m.email}`}>
                      <Mail className="h-4 w-4" /> {m.email}
                    </a>
                    {m.whatsapp && (
                      <a className="inline-flex items-center gap-2 hover:text-foreground" href={`https://wa.me/${m.whatsapp.replace(/\\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                        <Phone className="h-4 w-4" /> {m.whatsapp}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <time className="text-xs text-muted-foreground" dateTime={m.created_at}>
                    {new Date(m.created_at).toLocaleString()}
                  </time>
                  <Button variant="ghost" size="icon" aria-label="Delete message" onClick={() => void remove(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 whitespace-pre-wrap rounded-md bg-muted/40 p-4 text-sm leading-6">
                {m.message}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
