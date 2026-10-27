import { useMemo } from "react";
import { useAnnouncementConfig, type AnnouncementMessage } from "@/lib/announcement";
import { cn } from "@/lib/utils";
import "./announcement-marquee.css";

function visibleNow(message: AnnouncementMessage, now: number) {
  return (!message.startAt || Date.parse(message.startAt) <= now) && (!message.endAt || Date.parse(message.endAt) > now);
}

export function AnnouncementMarquee({ preview = false, config: previewConfig }: {
  preview?: boolean;
  config?: ReturnType<typeof useAnnouncementConfig>["data"];
}) {
  const query = useAnnouncementConfig();
  const config = preview ? (previewConfig ?? null) : (query.data ?? null);
  const messages = useMemo(() => (config?.messages ?? []).filter((message) => visibleNow(message, Date.now())), [config?.messages]);
  if (!config?.enabled || !messages.length) return null;

  const content = (duplicate = false) => messages.map((message) => {
    const body = <><span aria-hidden="true">{message.icon || "•"}</span><span>{message.text}</span></>;
    return (
      <span key={(duplicate ? "copy-" : "") + message.id} className="ew-announcement__item">
        {message.url ? (
          <a href={message.url} tabIndex={duplicate ? -1 : undefined} aria-hidden={duplicate || undefined} className="ew-announcement__link">{body}</a>
        ) : (
          <span aria-hidden={duplicate || undefined} className="ew-announcement__plain">{body}</span>
        )}
        <span aria-hidden="true" className="ew-announcement__separator">✦</span>
      </span>
    );
  });

  return (
    <section
      className={cn("ew-announcement", preview && "ew-announcement--preview")}
      role="region"
      aria-label="Website announcements"
      style={{
        backgroundColor: config.backgroundColor,
        color: config.textColor,
        ["--ew-marquee-duration" as string]: `${config.speedSeconds}s`,
        ["--ew-marquee-direction" as string]: config.direction === "left" ? "normal" : "reverse",
      }}
    >
      <div className="ew-announcement__viewport">
        <div className="ew-announcement__track">
          <div className="ew-announcement__group">{content(false)}</div>
          <div className="ew-announcement__group" aria-hidden="true" inert>{content(true)}</div>
        </div>
      </div>
      <p className="sr-only" aria-live="off">{messages.map((message) => message.text).join(". ")}</p>
    </section>
  );
}
