import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { publicImageUrl } from "@/lib/image-storage";

const ZOOM_FACTOR = 2.5;
const LENS_SIZE = 176;
const MAX_IMAGES = 8;

type Props = { title: string; coverPath: string | null; imagePaths?: string[] | null };

export function ProductImageGallery({ title, coverPath, imagePaths = [] }: Props) {
  const paths = useMemo(() => [...new Set([coverPath, ...(imagePaths ?? [])].filter((v): v is string => !!v))].slice(0, MAX_IMAGES), [coverPath, imagePaths]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [hiResReady, setHiResReady] = useState(false);
  const [hiResFailed, setHiResFailed] = useState(false);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const boundsRef = useRef<DOMRect | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistance = useRef(0);
  const panOrigin = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const mainUrl = paths[active] ? publicImageUrl("product-covers", paths[active], 800) : null;
  // Keep this URL builder aligned with the R2/Supabase image transformation pipeline.
  const zoomUrl = paths[active] ? publicImageUrl("product-covers", paths[active], 1800) : null;

  useEffect(() => {
    setActive(0); setOpen(false); setScale(1); setPan({ x: 0, y: 0 });
    setHiResReady(false); setHiResFailed(false);
    if (lensRef.current) lensRef.current.style.opacity = "0";
  }, [paths.join("|")]);

  const preloadHiRes = () => {
    if (hiResReady || hiResFailed || !zoomUrl || typeof window === "undefined") return;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => setHiResReady(true);
    image.onerror = () => setHiResFailed(true);
    image.src = zoomUrl;
  };

  const updateLens = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !hiResReady || !boundsRef.current || !lensRef.current) return;
    const rect = boundsRef.current;
    const x = Math.max(LENS_SIZE / 2, Math.min(rect.width - LENS_SIZE / 2, event.clientX - rect.left));
    const y = Math.max(LENS_SIZE / 2, Math.min(rect.height - LENS_SIZE / 2, event.clientY - rect.top));
    const lens = lensRef.current;
    lens.style.transform = `translate3d(${x - LENS_SIZE / 2}px, ${y - LENS_SIZE / 2}px, 0)`;
    lens.style.backgroundImage = `url("${zoomUrl}")`;
    lens.style.backgroundSize = `${rect.width * ZOOM_FACTOR}px ${rect.height * ZOOM_FACTOR}px`;
    lens.style.backgroundPosition = `-${x * ZOOM_FACTOR - LENS_SIZE / 2}px -${y * ZOOM_FACTOR - LENS_SIZE / 2}px`;
    lens.style.opacity = "1";
  };

  const clampPan = (nextScale: number, x: number, y: number) => {
    const stage = stageRef.current;
    if (!stage) return { x, y };
    const rect = stage.getBoundingClientRect();
    const maxX = (rect.width * (nextScale - 1)) / 2;
    const maxY = (rect.height * (nextScale - 1)) / 2;
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchDistance.current = Math.hypot(a.x - b.x, a.y - b.y);
    } else {
      panOrigin.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y };
    }
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance.current) {
        const next = Math.max(1, Math.min(3, scale * (distance / pinchDistance.current)));
        setScale(next);
        setPan((current) => clampPan(next, current.x, current.y));
      }
      pinchDistance.current = distance;
    } else if (panOrigin.current && scale > 1) {
      const origin = panOrigin.current;
      setPan(clampPan(scale, origin.px + event.clientX - origin.x, origin.py + event.clientY - origin.y));
    }
  };
  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchDistance.current = 0;
    if (pointers.current.size === 0) panOrigin.current = null;
  };

  const closeZoom = () => { setOpen(false); setScale(1); setPan({ x: 0, y: 0 }); pointers.current.clear(); };
  const activeSrc = hiResReady && !hiResFailed ? zoomUrl : mainUrl;

  return (
    <div className="space-y-3">
      <div
        className="group relative aspect-[4/3] overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        tabIndex={0}
        role="button"
        aria-label={`Zoom product images for ${title}`}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); preloadHiRes(); setOpen(true); } }}
        onPointerEnter={(event) => { if (event.pointerType === "mouse") { boundsRef.current = imageRef.current?.getBoundingClientRect() ?? null; preloadHiRes(); } }}
        onPointerMove={updateLens}
        onPointerLeave={() => { if (lensRef.current) lensRef.current.style.opacity = "0"; boundsRef.current = null; }}
        onTouchStart={preloadHiRes}
        onClick={(event) => { if (event.detail !== 0) { preloadHiRes(); setOpen(true); } }}
      >
        {mainUrl ? <img ref={imageRef} src={mainUrl} alt={`${title}, image ${active + 1}`} width={800} height={600} loading="eager" decoding="async" draggable={false} className="absolute inset-0 h-full w-full select-none object-cover" /> : <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">No product image</div>}
        <div ref={lensRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 z-10 rounded-full border-2 border-white shadow-[0_2px_14px_rgba(0,0,0,.35)]" style={{ width: LENS_SIZE, height: LENS_SIZE, opacity: 0, backgroundRepeat: "no-repeat", willChange: "transform" }} />
        <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-2 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"><ZoomIn className="size-3.5" /> Tap to zoom</span>
      </div>

      {paths.length > 1 && <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Product image thumbnails">
        {paths.map((path, index) => <button key={path} type="button" onClick={() => { setActive(index); setHiResReady(false); setHiResFailed(false); setScale(1); setPan({ x: 0, y: 0 }); closeZoom(); }} aria-label={`Show image ${index + 1} of ${paths.length}`} aria-pressed={active === index} className={`size-16 min-h-11 min-w-11 shrink-0 overflow-hidden rounded-lg border-2 bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active === index ? "border-primary" : "border-border"}`}>
          <img src={publicImageUrl("product-covers", path, 160) ?? ""} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        </button>)}
      </div>}

      <Dialog open={open} onOpenChange={(value) => value ? setOpen(true) : closeZoom()}>
        <DialogContent className="flex h-[100dvh] w-screen max-w-none flex-col gap-3 rounded-none border-0 bg-black p-3 text-white sm:h-[min(90dvh,900px)] sm:w-[min(94vw,1100px)] sm:rounded-2xl sm:border" onOpenAutoFocus={(event) => event.preventDefault()} onKeyDown={(event) => {
          if (event.key === "Escape") closeZoom();
          if (event.key.startsWith("Arrow")) { event.preventDefault(); setPan((p) => clampPan(scale, p.x + (event.key === "ArrowLeft" ? 30 : event.key === "ArrowRight" ? -30 : 0), p.y + (event.key === "ArrowUp" ? 30 : event.key === "ArrowDown" ? -30 : 0))); }
          if (event.key === "+" || event.key === "=") setScale((s) => Math.min(3, s + .25));
          if (event.key === "-") setScale((s) => Math.max(1, s - .25));
        }}>
          <div className="flex items-center justify-between gap-3"><DialogTitle className="truncate text-sm font-medium">{title} · Image {active + 1} of {paths.length}</DialogTitle><button type="button" onClick={closeZoom} aria-label="Close zoom view" className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><X className="size-5"/></button></div>
          <div ref={stageRef} className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onDoubleClick={() => { setScale((s) => s === 1 ? 2 : 1); setPan({ x: 0, y: 0 }); }}>
            {!hiResReady && !hiResFailed && <div className="absolute z-10 flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm"><Loader2 className="size-4 animate-spin"/> Loading high-resolution image…</div>}
            {hiResFailed && <p className="absolute top-3 z-10 rounded-lg bg-amber-950/90 px-3 py-2 text-xs">High-resolution image unavailable. Showing standard image.</p>}
            {activeSrc && <img src={activeSrc} alt={`${title}, enlarged image ${active + 1}`} draggable={false} decoding="async" className="max-h-full max-w-full select-none object-contain" style={{ transform: `translate3d(${pan.x}px,${pan.y}px,0) scale(${scale})`, transformOrigin: "center", touchAction: "none" }} />}
          </div>
          <div className="flex items-center justify-center gap-3 text-xs text-white/75"><button type="button" className="min-h-11 rounded-full border border-white/20 px-4" onClick={() => { setScale((s) => Math.max(1, s - .25)); setPan({ x: 0, y: 0 }); }}>−</button><span>{Math.round(scale * 100)}%</span><button type="button" className="min-h-11 rounded-full border border-white/20 px-4" onClick={() => setScale((s) => Math.min(3, s + .25))}>+</button><span className="hidden sm:inline">Pinch or drag to explore</span></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
