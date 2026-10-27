import { useEffect, useMemo, useRef, useState } from "react";
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
  const [now, setNow] = useState(() => Date.now());
  const viewportRef = useRef<HTMLDivElement>(null);
  const sampleRef = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(3);
  useEffect(() => {
    const viewport = viewportRef.current;
    const sample = sampleRef.current;
    if (!viewport || !sample) return;
    const measure = () => {
      const viewportWidth = viewport.clientWidth;
      const sampleWidth = sample.getBoundingClientRect().width;
      if (!viewportWidth || !sampleWidth) return;
      const requiredCopies = Math.max(2, Math.ceil(viewportWidth / sampleWidth) + 1);
      setCopies((current) => current === requiredCopies ? current : requiredCopies);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(sample);
    return () => observer.disconnect();
  }, [messages]);
  useEffect(() => {
    if (preview) return;
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [preview]);
  const messages = useMemo(() => (config?.messages ?? []).filter((message) => visibleNow(message, now)), [config?.messages, now]);
  if (!config?.enabled || !messages.length) return null;

  const content = (duplicate = false) => messages.map((message) => {
    const icon = (message.icon ?? "").trim();
    const isDecorativeStar = /^[⭐🌟✦✧★☆]+$/u.test(icon);
    const body = <>{icon && !isDecorativeStar && <span aria-hidden="true">{icon}</span>}<span>{message.text}</span></>;
    return (
      <span key={(duplicate ? "copy-" : "") + message.id} className="ew-announcement__item">
        {message.url ? (
          <a href={message.url} tabIndex={duplicate ? -1 : undefined} aria-hidden={duplicate || undefined} className="ew-announcement__link">{body}</a>
        ) : (
          <span aria-hidden={duplicate || undefined} className="ew-announcement__plain">{body}</span>
        )}
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
      <div className="ew-announcement__viewport" ref={viewportRef}>
        <div className="ew-announcement__track">
          {[0, 1].map((groupIndex) => (
            <div
              className="ew-announcement__group"
              key={groupIndex}
              aria-hidden={groupIndex === 1 || undefined}
              inert={groupIndex === 1 ? true : undefined}
            >
              {Array.from({ length: copies }, (_, copyIndex) => {
                const duplicate = groupIndex === 1 || copyIndex > 0;
                return (
                  <div
                    className="ew-announcement__set"
                    key={copyIndex}
                    ref={groupIndex === 0 && copyIndex === 0 ? sampleRef : undefined}
                    aria-hidden={duplicate || undefined}
                    inert={duplicate ? true : undefined}
                  >
                    {content(duplicate)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
