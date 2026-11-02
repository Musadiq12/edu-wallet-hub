import { useCallback, useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn } from "lucide-react";
import { publicImageUrl } from "@/lib/image-storage";

const ZOOM_FACTOR = 2.5;
const MAX_TOUCH_ZOOM = 3;
const LENS_SIZE = 176;
const MODE: "panel" | "lens" = "panel";
const HI_RES_WIDTH = 1600;

type Point = { x: number; y: number };
type Props = {
  path: string | null;
  title: string;
  /** Supply additional images when the product model gains a gallery field. */
  images?: string[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getDistance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function ProductImageZoom({ path, title, images }: Props) {
  const imagePaths = Array.from(new Set([path, ...(images ?? [])].filter((item): item is string => Boolean(item))));
  const [selected, setSelected] = useState(0);

  const [zoomOpen, setZoomOpen] = useState(false);
  const [hiResReady, setHiResReady] = useState(false);
  const [hiResFailed, setHiResFailed] = useState(false);
  const [touchScale, setTouchScale] = useState(1);
  const [touchPan, setTouchPan] = useState<Point>({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const mainFrameRef = useRef<HTMLDivElement>(null);
  const zoomFrameRef = useRef<HTMLDivElement>(null);
  const panelImageRef = useRef<HTMLImageElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const highImageRef = useRef<HTMLImageElement | null>(null);
  const boundsRef = useRef<DOMRect | null>(null);
  const pointerRef = useRef<Point>({ x: 0, y: 0 });
  const rafRef = useRef(0);
  const touchPointsRef = useRef<Map<number, Point>>(new Map());
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const currentPath = imagePaths[selected] ?? null;
  const imageUrl = currentPath ? publicImageUrl("product-covers", currentPath, 800) : null;
  const highUrl = currentPath ? publicImageUrl("product-covers", currentPath, HI_RES_WIDTH) : null;
  const zoomAvailable = Boolean(imageUrl && highUrl && currentPath) && !hiResFailed;
  const zoomSource = hiResReady && highImageRef.current ? highUrl : imageUrl;

  const resetZoomAsset = useCallback(() => {
    setZoomOpen(false);
    setHiResReady(false);
    setHiResFailed(false);
    setTouchScale(1);
    setTouchPan({ x: 0, y: 0 });
    highImageRef.current = null;
    cancelAnimationFrame(rafRef.current);
    if (lensRef.current) lensRef.current.style.display = "none";
    if (indicatorRef.current) indicatorRef.current.style.display = "none";
  }, []);

  const preloadHighResolution = useCallback(() => {
    if (!highUrl || highImageRef.current || hiResFailed) return;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const mainWidth = imageRef.current?.getBoundingClientRect().width ?? 0;
      if (mainWidth > 0 && image.naturalWidth <= mainWidth * 1.5) {
        setHiResFailed(true);
        return;
      }
      highImageRef.current = image;
      setHiResReady(true);
      if (panelImageRef.current) panelImageRef.current.src = highUrl;
    };
    image.onerror = () => setHiResFailed(true);
    image.src = highUrl;
  }, [highUrl, hiResFailed]);

  const cacheBounds = useCallback(() => {
    boundsRef.current = imageRef.current?.getBoundingClientRect() ?? null;
  }, []);

  const paintPointer = useCallback(() => {
    const bounds = boundsRef.current;
    if (!bounds || !lensRef.current || !indicatorRef.current) return;
    const x = clamp(pointerRef.current.x, 0, bounds.width);
    const y = clamp(pointerRef.current.y, 0, bounds.height);
    const lens = MODE === "lens" ? lensRef.current! : indicatorRef.current;
    const size = MODE === "lens" ? LENS_SIZE : 72;
    const xRatio = bounds.width ? x / bounds.width : 0.5;
    const yRatio = bounds.height ? y / bounds.height : 0.5;
    const left = clamp(x - size / 2, 0, Math.max(0, bounds.width - size));
    const top = clamp(y - size / 2, 0, Math.max(0, bounds.height - size));
    lens.style.transform = `translate3d(${left}px,${top}px,0)`;
    lens.style.display = "block";

    if (MODE === "panel") {
      indicatorRef.current.style.transform = `translate3d(${left}px,${top}px,0)`;
      indicatorRef.current.style.display = "block";
    }

    if (MODE === "panel" && panelImageRef.current && hiResReady && highImageRef.current) {
      const width = bounds.width * ZOOM_FACTOR;
      const height = bounds.height * ZOOM_FACTOR;
      panelImageRef.current.style.width = `${width}px`;
      panelImageRef.current.style.height = `${height}px`;
      panelImageRef.current.style.transform = `translate3d(${-(xRatio * width - (bounds.width / 2))}px,${-(yRatio * height - (bounds.height / 2))}px,0)`;
    }
  }, [hiResReady]);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !hiResReady || !boundsRef.current) return;
    pointerRef.current = {
      x: event.clientX - boundsRef.current.left,
      y: event.clientY - boundsRef.current.top,
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(paintPointer);
  };

  const handlePointerLeave = () => {
    cancelAnimationFrame(rafRef.current);
    if (lensRef.current) lensRef.current.style.display = "none";
    if (indicatorRef.current) indicatorRef.current.style.display = "none";
    boundsRef.current = null;
  };

  const openTouchZoom = () => {
    if (!zoomAvailable) return;
    preloadHighResolution();
    setZoomOpen(true);
  };

  const closeTouchZoom = () => {
    setZoomOpen(false);
    setTouchScale(1);
    setTouchPan({ x: 0, y: 0 });
    touchPointsRef.current.clear();
    pinchRef.current = null;
    dragRef.current = null;
  };

  const onTouchPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const points = touchPointsRef.current;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size === 2) {
      const [a, b] = Array.from(points.values());
      pinchRef.current = { distance: getDistance(a, b), scale: touchScale };
      dragRef.current = null;
    } else if (points.size === 1) {
      dragRef.current = { x: event.clientX, y: event.clientY, panX: touchPan.x, panY: touchPan.y };
    }
  };

  const onTouchPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    const points = touchPointsRef.current;
    if (!points.has(event.pointerId)) return;
    event.preventDefault();
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size === 2 && pinchRef.current) {
      const [a, b] = Array.from(points.values());
      const factor = getDistance(a, b) / Math.max(1, pinchRef.current.distance);
      const nextScale = clamp(pinchRef.current.scale * factor, 1, MAX_TOUCH_ZOOM);
      setTouchScale(nextScale);
      if (nextScale === 1) setTouchPan({ x: 0, y: 0 });
    } else if (points.size === 1 && dragRef.current && touchScale > 1) {
      const delta = dragRef.current;
      const rect = zoomFrameRef.current?.getBoundingClientRect();
      const maxX = ((rect?.width ?? 0) * (touchScale - 1)) / 2;
      const maxY = ((rect?.height ?? 0) * (touchScale - 1)) / 2;
      setTouchPan({
        x: clamp(delta.panX + event.clientX - delta.x, -maxX, maxX),
        y: clamp(delta.panY + event.clientY - delta.y, -maxY, maxY),
      });
    }
  };

  const onTouchPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const points = touchPointsRef.current;
    points.delete(event.pointerId);
    if (points.size < 2) pinchRef.current = null;
    if (!points.size) dragRef.current = null;
  };

  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!zoomOpen && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openTouchZoom();
      return;
    }
    if (!zoomOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeTouchZoom();
      return;
    }
    const step = 32;
    const rect = frameRef.current?.getBoundingClientRect();
    const maxX = ((rect?.width ?? 0) * (touchScale - 1)) / 2;
    const maxY = ((rect?.height ?? 0) * (touchScale - 1)) / 2;
    if (event.key === "ArrowLeft") setTouchPan((p) => ({ ...p, x: clamp(p.x + step, -maxX, maxX) }));
    if (event.key === "ArrowRight") setTouchPan((p) => ({ ...p, x: clamp(p.x - step, -maxX, maxX) }));
    if (event.key === "ArrowUp") setTouchPan((p) => ({ ...p, y: clamp(p.y + step, -maxY, maxY) }));
    if (event.key === "ArrowDown") setTouchPan((p) => ({ ...p, y: clamp(p.y - step, -maxY, maxY) }));
  };

  useEffect(() => {
    setSelected(0);
    resetZoomAsset();
  }, [path, resetZoomAsset]);

  useEffect(() => {
    const update = () => {
      handlePointerLeave();
      if (zoomOpen) closeTouchZoom();
    };
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      cancelAnimationFrame(rafRef.current);
    };
  }, [zoomOpen]);

  useEffect(() => {
    if (!zoomOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [zoomOpen]);

  if (!imagePaths.length || !imageUrl) {
    return (
      <div className="relative aspect-[4/3] w-full bg-muted" aria-label={`No image available for ${title}`}>
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No image available</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label={`View larger image of ${title}`}
        className={`product-image-zoom-frame relative aspect-[4/3] w-full overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${zoomAvailable && !hiResFailed ? "cursor-zoom-in" : "cursor-default"}`}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse" && zoomAvailable) {
            cacheBounds();
            preloadHighResolution();
          }
        }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse") {
            event.preventDefault();
            openTouchZoom();
          }
        }}
        onKeyDown={handleKeys}
        onClick={(event) => {
          if (event.detail === 0) openTouchZoom();
        }}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt={`Cover of ${title}, image ${selected + 1}`}
          width={800}
          height={600}
          loading="eager"
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-contain"
        />
        {MODE === "lens" && <div ref={lensRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 hidden rounded-full border-2 border-white bg-no-repeat shadow-[0_2px_12px_rgba(0,0,0,.35)]" style={{ width: LENS_SIZE, height: LENS_SIZE, backgroundImage: hiResReady ? `url("${highUrl}")` : "none", backgroundSize: `${ZOOM_FACTOR * 100}% ${ZOOM_FACTOR * 100}%` }} />}
        {MODE === "panel" && <div ref={indicatorRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 hidden h-[72px] w-[72px] border border-primary bg-primary/10" />}
        {MODE === "panel" && hiResReady && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-full z-10 hidden w-full overflow-hidden border border-border bg-card lg:block">
            <img ref={panelImageRef} alt="" className="absolute left-0 top-0 max-w-none" />
          </div>
        )}
        <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
          <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" /> Tap or hover to zoom
        </span>
      </div>

      {imagePaths.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Product images">
          {imagePaths.map((item, index) => {
            const thumbnail = publicImageUrl("product-covers", item, 160);
            return (
              <button
                key={item}
                type="button"
                aria-label={`Show image ${index + 1} of ${title}`}
                aria-pressed={selected === index}
                onClick={() => { setSelected(index); resetZoomAsset(); }}
                className={`h-16 min-h-11 w-16 min-w-11 shrink-0 overflow-hidden rounded-lg border bg-muted p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected === index ? "border-primary ring-1 ring-primary" : "border-border"}`}
              >
                <img src={thumbnail ?? undefined} alt="" width={160} height={120} loading="lazy" decoding="async" className="h-full w-full object-contain" />
              </button>
            );
          })}
        </div>
      )}
      {zoomOpen && typeof document !== "undefined" && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Zoomed image of ${title}`}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/95 p-3 sm:p-8"
          onKeyDown={handleKeys}
        >
          <button type="button" onClick={closeTouchZoom} aria-label="Close zoomed image" className="absolute right-4 top-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            <X className="h-6 w-6" />
          </button>
          <div
            ref={zoomFrameRef}
            className="relative h-[min(82dvh,900px)] w-full touch-none overflow-hidden"
            onPointerDown={onTouchPointerDown}
            onPointerMove={onTouchPointerMove}
            onPointerUp={onTouchPointerUp}
            onPointerCancel={onTouchPointerUp}
            onDoubleClick={() => setTouchScale((v) => v === 1 ? 2 : 1)}
          >
            {!hiResReady && !hiResFailed && <div className="absolute inset-0 animate-pulse bg-white/10" aria-label="Loading high-resolution image" />}
            <img
              src={zoomSource ?? imageUrl}
              alt={`Zoomed view of ${title}, image ${selected + 1}`}
              decoding="async"
              draggable={false}
              onError={() => { if (hiResReady) { setHiResFailed(true); setHiResReady(false); } }}
              className="absolute inset-0 m-auto max-h-full max-w-full select-none object-contain"
              style={{ transform: `translate3d(${touchPan.x}px,${touchPan.y}px,0) scale(${touchScale})`, transformOrigin: "center", touchAction: "none" }}
            />
            {hiResFailed && <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-black/70 px-3 py-2 text-xs text-white">High-resolution image unavailable. Showing standard image.</p>}
          </div>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/75">Pinch or drag to inspect · Press Esc to close</p>
        </div>,
        document.body
      )}
    </div>
  );
}
