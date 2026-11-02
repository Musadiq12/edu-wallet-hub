import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn } from "lucide-react";
import { publicImageUrl } from "@/lib/image-storage";

const ZOOM_FACTOR = 2.5;
const MAX_TOUCH_ZOOM = 3;
const LENS_SIZE = 176;
const HIGH_RES_WIDTH = 1600;

type Point = { x: number; y: number };
type Props = { path: string | null; title: string; images?: string[] };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function ProductImageZoom({ path, title, images = [] }: Props) {
  const paths = Array.from(new Set([path, ...images].filter((item): item is string => Boolean(item))));
  const [selected, setSelected] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [highReady, setHighReady] = useState(false);
  const [highFailed, setHighFailed] = useState(false);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });

  const mainFrameRef = useRef<HTMLDivElement>(null);
  const mainImageRef = useRef<HTMLImageElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const zoomFrameRef = useRef<HTMLDivElement>(null);
  const zoomImageRef = useRef<HTMLImageElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const boundsRef = useRef<DOMRect | null>(null);
  const pointerRef = useRef<Point>({ x: 0, y: 0 });
  const hoveringRef = useRef(false);
  const rafRef = useRef(0);
  const highImageRef = useRef<HTMLImageElement | null>(null);
  const touchPointsRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const dragRef = useRef<{ origin: Point; pan: Point } | null>(null);
  const zoomBoundsRef = useRef({ width: 0, height: 0 });

  const pathsKey = paths.join("|");
  const currentPath = paths[selected] ?? null;
  const mainUrl = currentPath ? publicImageUrl("product-covers", currentPath, 800) : null;
  const highUrl = currentPath ? publicImageUrl("product-covers", currentPath, HIGH_RES_WIDTH) : null;
  const canZoom = Boolean(mainUrl && highUrl && !highFailed);

  const hideLens = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (lensRef.current) lensRef.current.style.display = "none";
  }, []);

  const paintLens = useCallback(() => {
    const bounds = boundsRef.current;
    const lens = lensRef.current;
    const image = mainImageRef.current;
    if (!bounds || !lens || !image || !highImageRef.current || !hoveringRef.current) return;

    const naturalWidth = image.naturalWidth || 800;
    const naturalHeight = image.naturalHeight || 600;
    const fit = Math.min(bounds.width / naturalWidth, bounds.height / naturalHeight);
    const visibleWidth = naturalWidth * fit;
    const visibleHeight = naturalHeight * fit;
    const offsetX = (bounds.width - visibleWidth) / 2;
    const offsetY = (bounds.height - visibleHeight) / 2;
    const pointerX = clamp(pointerRef.current.x - offsetX, 0, visibleWidth);
    const pointerY = clamp(pointerRef.current.y - offsetY, 0, visibleHeight);
    const lensWidth = Math.min(LENS_SIZE, visibleWidth);
    const lensHeight = Math.min(LENS_SIZE, visibleHeight);
    const lensX = clamp(pointerX - lensWidth / 2, 0, visibleWidth - lensWidth);
    const lensY = clamp(pointerY - lensHeight / 2, 0, visibleHeight - lensHeight);

    lens.style.width = `${lensWidth}px`;
    lens.style.height = `${lensHeight}px`;
    lens.style.transform = `translate3d(${offsetX + lensX}px,${offsetY + lensY}px,0)`;
    lens.style.backgroundImage = `url("${highUrl}")`;
    lens.style.backgroundSize = `${visibleWidth * ZOOM_FACTOR}px ${visibleHeight * ZOOM_FACTOR}px`;
    lens.style.backgroundPosition = `-${pointerX * ZOOM_FACTOR - lensWidth / 2}px -${pointerY * ZOOM_FACTOR - lensHeight / 2}px`;
    lens.style.display = "block";
  }, [highUrl]);

  const preloadHighResolution = useCallback(() => {
    if (!highUrl || highImageRef.current || highFailed) return;
    const highImage = new Image();
    highImage.decoding = "async";
    highImage.onload = () => {
      const mainImage = mainImageRef.current;
      const mainWidth = mainImage?.naturalWidth || 800;
      if (!mainImage || highImage.naturalWidth <= mainWidth * 1.5) {
        setHighFailed(true);
        hideLens();
        setZoomOpen(false);
        setScale(1);
        setPan({ x: 0, y: 0 });
        mainFrameRef.current?.focus();
        return;
      }
      highImageRef.current = highImage;
      setHighReady(true);
      if (hoveringRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(paintLens);
      }
    };
    highImage.onerror = () => {
      setHighFailed(true);
      hideLens();
      setZoomOpen(false);
      setScale(1);
      setPan({ x: 0, y: 0 });
      mainFrameRef.current?.focus();
    };
    highImage.src = highUrl;
  }, [highUrl, highFailed, hideLens, paintLens]);

  const updateMainPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !boundsRef.current) return;
    pointerRef.current = {
      x: event.clientX - boundsRef.current.left,
      y: event.clientY - boundsRef.current.top,
    };
    if (highImageRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(paintLens);
    }
  };

  const openZoom = () => {
    if (!canZoom) return;
    preloadHighResolution();
    setScale(1);
    setPan({ x: 0, y: 0 });
    setZoomOpen(true);
  };

  const closeZoom = () => {
    setZoomOpen(false);
    mainFrameRef.current?.focus();
    setScale(1);
    setPan({ x: 0, y: 0 });
    touchPointsRef.current.clear();
    pinchRef.current = null;
    dragRef.current = null;
  };

  const handleMainKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openZoom();
    }
  };

  const handleZoomKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeZoom();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      closeButtonRef.current?.focus();
      return;
    }
    const step = 32;
    const { width, height } = zoomBoundsRef.current;
    const maxX = (width * (scale - 1)) / 2;
    const maxY = (height * (scale - 1)) / 2;
    if (event.key === "ArrowLeft") setPan((value) => ({ ...value, x: clamp(value.x + step, -maxX, maxX) }));
    if (event.key === "ArrowRight") setPan((value) => ({ ...value, x: clamp(value.x - step, -maxX, maxX) }));
    if (event.key === "ArrowUp") setPan((value) => ({ ...value, y: clamp(value.y + step, -maxY, maxY) }));
    if (event.key === "ArrowDown") setPan((value) => ({ ...value, y: clamp(value.y - step, -maxY, maxY) }));
  };

  const handleTouchDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const points = touchPointsRef.current;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size === 2) {
      const [a, b] = Array.from(points.values());
      pinchRef.current = { distance: distance(a, b), scale };
      dragRef.current = null;
    } else {
      dragRef.current = { origin: { x: event.clientX, y: event.clientY }, pan };
    }
  };

  const handleTouchMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    const points = touchPointsRef.current;
    if (!points.has(event.pointerId)) return;
    event.preventDefault();
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (points.size === 2 && pinchRef.current) {
      const [a, b] = Array.from(points.values());
      const nextScale = clamp(pinchRef.current.scale * distance(a, b) / Math.max(1, pinchRef.current.distance), 1, MAX_TOUCH_ZOOM);
      setScale(nextScale);
      if (nextScale === 1) setPan({ x: 0, y: 0 });
      return;
    }

    if (points.size === 1 && dragRef.current && scale > 1) {
      const { origin, pan: startingPan } = dragRef.current;
      const { width, height } = zoomBoundsRef.current;
      const maxX = width * (scale - 1) / 2;
      const maxY = height * (scale - 1) / 2;
      setPan({
        x: clamp(startingPan.x + event.clientX - origin.x, -maxX, maxX),
        y: clamp(startingPan.y + event.clientY - origin.y, -maxY, maxY),
      });
    }
  };

  const handleTouchEnd = (event: PointerEvent<HTMLDivElement>) => {
    const points = touchPointsRef.current;
    points.delete(event.pointerId);
    if (points.size < 2) pinchRef.current = null;
    if (points.size === 1) {
      const [point] = Array.from(points.values());
      dragRef.current = { origin: point, pan };
    } else if (!points.size) {
      dragRef.current = null;
    }
  };

  useEffect(() => {
    setSelected(0);
    setZoomOpen(false);
    setHighReady(false);
    setHighFailed(false);
    highImageRef.current = null;
    setScale(1);
    setPan({ x: 0, y: 0 });
    hoveringRef.current = false;
    touchPointsRef.current.clear();
    hideLens();
  }, [pathsKey, hideLens]);

  useEffect(() => {
    if (!zoomOpen) return;
    const frame = zoomFrameRef.current;
    if (!frame) return;
    const measure = () => {
      const imageRect = zoomImageRef.current?.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      zoomBoundsRef.current = {
        width: imageRect?.width || frameRect.width,
        height: imageRect?.height || frameRect.height,
      };
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(frame);
    if (zoomImageRef.current) observer?.observe(zoomImageRef.current);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      observer?.disconnect();
      document.body.style.overflow = previousOverflow;
    };
  }, [zoomOpen]);

  useEffect(() => {
    const resize = () => {
      hoveringRef.current = false;
      hideLens();
      if (zoomOpen) closeZoom();
      boundsRef.current = null;
    };
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [hideLens, zoomOpen]);

  if (!mainUrl) {
    return (
      <div className="relative aspect-[4/3] w-full bg-muted" aria-label={`No image available for ${title}`}>
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No image available</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={mainFrameRef}
        role={canZoom ? "button" : "img"}
        tabIndex={canZoom ? 0 : undefined}
        aria-label={canZoom ? `View larger image of ${title}` : `Image of ${title}`}
        className={`relative aspect-[4/3] w-full overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${canZoom ? "cursor-zoom-in" : "cursor-default"}`}
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse" || !canZoom) return;
          hoveringRef.current = true;
          boundsRef.current = mainFrameRef.current?.getBoundingClientRect() ?? null;
          pointerRef.current = {
            x: event.clientX - (boundsRef.current?.left ?? 0),
            y: event.clientY - (boundsRef.current?.top ?? 0),
          };
          preloadHighResolution();
        }}
        onPointerMove={updateMainPointer}
        onPointerLeave={() => {
          hoveringRef.current = false;
          hideLens();
          boundsRef.current = null;
        }}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse") {
            event.preventDefault();
            openZoom();
          }
        }}
        onKeyDown={handleMainKeyDown}
        onClick={(event) => {
          if (event.detail === 0) openZoom();
        }}
      >
        <img
          ref={mainImageRef}
          src={mainUrl}
          alt={`Cover of ${title}, image ${selected + 1}`}
          width={800}
          height={600}
          loading="eager"
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-contain"
        />
        <div
          ref={lensRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 hidden rounded-full border-2 border-white shadow-[0_2px_12px_rgba(0,0,0,.35)] motion-reduce:transition-none"
        />
        <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
          <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" /> Tap or hover to zoom
        </span>
      </div>

      {paths.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Product images">
          {paths.map((item, index) => {
            const thumbnail = publicImageUrl("product-covers", item, 160);
            return (
              <button
                key={item}
                type="button"
                aria-label={`Show image ${index + 1} of ${title}`}
                aria-pressed={selected === index}
                onClick={() => {
                  setSelected(index);
                  setZoomOpen(false);
                  setHighReady(false);
                  setHighFailed(false);
                  highImageRef.current = null;
                  setScale(1);
                  setPan({ x: 0, y: 0 });
                  hoveringRef.current = false;
                  hideLens();
                }}
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
          className="fixed inset-0 z-[40] flex items-center justify-center bg-black/95 p-3 sm:p-8"
          onKeyDown={handleZoomKeyDown}
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeZoom}
            aria-label="Close zoomed image"
            className="absolute right-4 top-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <X className="h-6 w-6" />
          </button>
          <div
            ref={zoomFrameRef}
            tabIndex={-1}
            className="relative h-[min(82dvh,900px)] w-full touch-none overflow-hidden"
            onPointerDown={handleTouchDown}
            onPointerMove={handleTouchMove}
            onPointerUp={handleTouchEnd}
            onPointerCancel={handleTouchEnd}
            onDoubleClick={() => setScale((value) => value === 1 ? 2 : 1)}
          >
            {!highReady && !highFailed && <div className="absolute inset-0 animate-pulse bg-white/10" role="status" aria-label="Loading high-resolution image" />}
            <img
              ref={zoomImageRef}
              src={highReady ? highUrl ?? mainUrl : mainUrl}
              alt={`Zoomed view of ${title}, image ${selected + 1}`}
              decoding="async"
              draggable={false}
              onLoad={() => {
                const rect = zoomImageRef.current?.getBoundingClientRect();
                if (rect) zoomBoundsRef.current = { width: rect.width, height: rect.height };
              }}
              onError={() => {
                if (highReady) {
                  setHighFailed(true);
                  setHighReady(false);
                  setZoomOpen(false);
                  setScale(1);
                  setPan({ x: 0, y: 0 });
                  mainFrameRef.current?.focus();
                }
              }}
              className="absolute inset-0 m-auto max-h-full max-w-full select-none object-contain"
              style={{
                transform: `translate3d(${pan.x}px,${pan.y}px,0) scale(${scale})`,
                transformOrigin: "center",
                touchAction: "none",
              }}
            />
            {highFailed && <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-black/70 px-3 py-2 text-xs text-white">High-resolution image unavailable. Showing standard image.</p>}
          </div>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/75">Pinch or drag to inspect · Press Esc to close</p>
        </div>,
        document.body,
      )}
    </div>
  );
}
