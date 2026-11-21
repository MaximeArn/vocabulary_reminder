import { useEffect, useRef, useState } from "react";
import type { MapViewProps, ZoneTone } from "../views";
import { MinusIcon, PlusIcon, RecenterIcon } from "../../ui/icons";
import styles from "./FranceMap.module.css";

/**
 * Carte de France des départements, dessinée en SVG (aucune bibliothèque, aucune
 * connexion). Les tracés sont chargés à la première carte affichée, puis restent
 * en cache (service worker).
 *
 * Couches : les départements, et les cours d'eau (dessinés par-dessus, seulement
 * quand on les demande). Un cours d'eau se touche dans une bande large autour de son
 * trait, plus fin que le doigt.
 *
 * Gestes : toucher un département (ou un cours d'eau) le choisit ; pincer zoome ; une fois zoomé, un
 * doigt déplace la carte ; un double toucher zoome sur l'endroit touché. Les
 * boutons +, − et « recentrer », en haut à droite (dans une bande de mer réservée,
 * au-dessus de la métropole), font de même sans geste.
 */

interface MapData {
  viewBox: [number, number, number, number];
  insets: { id: string; title: string; box: [number, number, number, number] }[];
  /** Tracés par département : sur la carte, puis (Paris et environs) dans l'encart agrandi. */
  paths: Record<string, string[]>;
  /** Tracés par cours d'eau, de même (la Seine et la Marne traversent l'encart de Paris). */
  rivers: Record<string, string[]>;
}

let cached: MapData | null = null;
let loading: Promise<MapData> | null = null;
function loadMap(): Promise<MapData> {
  loading ??= import("./data/carte-france.json").then((module) => {
    cached = module.default as unknown as MapData;
    return cached;
  });
  return loading;
}

function useMapData(): MapData | null {
  const [data, setData] = useState(cached);
  useEffect(() => {
    if (!data) void loadMap().then(setData);
  }, [data]);
  return data;
}

interface View {
  scale: number;
  x: number;
  y: number;
}

const IDENTITY: View = { scale: 1, x: 0, y: 0 };
const MAX_SCALE = 6;
const DOUBLE_TAP_SCALE = 2.5;
/** Un toucher sur + ou − multiplie (ou divise) le zoom par ce facteur. */
const BUTTON_STEP = 1.8;
/** Au-delà de ce déplacement (en pixels), ce n'est plus un toucher mais un geste. */
const TAP_SLOP = 8;
const DOUBLE_TAP_MS = 300;

const TONE_CLASS: Record<ZoneTone, string> = {
  highlight: styles.highlight!,
  selected: styles.selected!,
  good: styles.good!,
  bad: styles.bad!,
};

const RIVER_TONE_CLASS: Record<ZoneTone, string> = {
  highlight: styles.riverHighlight!,
  selected: styles.riverHighlight!,
  good: styles.riverGood!,
  bad: styles.riverBad!,
};

/**
 * Taille du cadre, suivie en continu (mode `fill`) : la carte s'y ajuste quelles
 * que soient ses proportions.
 */
function useFrameSize(enabled: boolean) {
  const [frame, frameRef] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    if (!enabled || !frame) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [enabled, frame]);
  return { frameRef, size: enabled ? size : null };
}

/** Une dimension (x ou y) : le cadre visible [start, start + length] et la carte [0, content]. */
function clampAxis(translate: number, scale: number, content: number, start: number, length: number): number {
  const scaled = content * scale;
  // Carte plus petite que le cadre : centrée. Sinon, elle le couvre toujours entièrement.
  if (scaled <= length) return start + (length - scaled) / 2;
  return Math.min(start, Math.max(start + length - scaled, translate));
}

export function FranceMap({ tones = {}, onSelect, label, fill = false, layer = "departments" }: MapViewProps) {
  const data = useMapData();
  const svgRef = useRef<SVGSVGElement>(null);
  const { frameRef, size } = useFrameSize(fill);
  const [view, setView] = useState<View>(IDENTITY);
  const gesture = useRef({
    pointers: new Map<number, { x: number; y: number }>(),
    start: { view: IDENTITY, distance: 0, mid: [0, 0] as [number, number], point: [0, 0] as [number, number] },
    moved: false,
    lastTap: { time: 0, x: 0, y: 0 },
  });

  // Pincer sur la carte ne doit pas zoomer toute la page (Safari iOS).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const prevent = (event: Event) => event.preventDefault();
    svg.addEventListener("gesturestart", prevent);
    return () => svg.removeEventListener("gesturestart", prevent);
  }, [data]);

  if (!data) {
    return (
      <div ref={frameRef} className={`${styles.loading} ${fill ? styles.fill : ""}`} role="img" aria-label={`${label} (chargement)`} />
    );
  }

  const [, , width, height] = data.viewBox;
  // Cadre visible, dans le repère de la carte : la carte elle-même, ou (mode `fill`)
  // agrandi en largeur ou en hauteur pour épouser les proportions du cadre, carte centrée.
  let frame = { x: 0, y: 0, width, height };
  if (size) {
    const ratio = size.height / size.width;
    frame =
      ratio > height / width
        ? { x: 0, y: -(width * ratio - height) / 2, width, height: width * ratio }
        : { x: -(height / ratio - width) / 2, y: 0, width: height / ratio, height };
  }

  /** Position d'un point de l'écran dans le repère du SVG (cadre visible, sans le zoom). */
  const toSvg = (clientX: number, clientY: number): [number, number] => {
    const rect = svgRef.current!.getBoundingClientRect();
    const k = frame.width / rect.width;
    return [frame.x + (clientX - rect.left) * k, frame.y + (clientY - rect.top) * k];
  };
  /** Position d'un point de l'écran dans le repère de la carte (avant zoom). */
  const toMap = (clientX: number, clientY: number, current: View): [number, number] => {
    const [x, y] = toSvg(clientX, clientY);
    return [(x - current.x) / current.scale, (y - current.y) / current.scale];
  };
  /** Garde la carte dans son cadre. */
  const clamp = ({ scale, x, y }: View): View => {
    const s = Math.min(Math.max(scale, 1), MAX_SCALE);
    return {
      scale: s,
      x: clampAxis(x, s, width, frame.x, frame.width),
      y: clampAxis(y, s, height, frame.y, frame.height),
    };
  };
  /** Zoom de `scale`, en gardant le point `point` (repère de la carte) sous `screen` (repère du SVG). */
  const zoomAt = (scale: number, point: [number, number], screen: [number, number]): View =>
    clamp({ scale, x: screen[0] - point[0] * scale, y: screen[1] - point[1] * scale });

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (g.pointers.size === 0) g.moved = false;
    g.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...g.pointers.values()];
    if (points.length === 2) {
      const [a, b] = points as [{ x: number; y: number }, { x: number; y: number }];
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      g.start = { view, distance: Math.hypot(a.x - b.x, a.y - b.y), mid: [midX, midY], point: toMap(midX, midY, view) };
      g.moved = true;
    } else {
      g.start = { ...g.start, view, mid: [event.clientX, event.clientY] };
    }
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (!g.pointers.has(event.pointerId)) return;
    g.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...g.pointers.values()];
    if (points.length === 2) {
      const [a, b] = points as [{ x: number; y: number }, { x: number; y: number }];
      const scale = (g.start.view.scale * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(g.start.distance, 1);
      setView(zoomAt(scale, g.start.point, toSvg((a.x + b.x) / 2, (a.y + b.y) / 2)));
      return;
    }
    const dx = event.clientX - g.start.mid[0];
    const dy = event.clientY - g.start.mid[1];
    if (Math.hypot(dx, dy) > TAP_SLOP) g.moved = true;
    if (g.start.view.scale > 1 && g.moved) {
      const k = frame.width / svgRef.current!.getBoundingClientRect().width;
      setView(clamp({ ...g.start.view, x: g.start.view.x + dx * k, y: g.start.view.y + dy * k }));
    }
  };

  const onPointerEnd = (event: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    g.pointers.delete(event.pointerId);
    if (g.pointers.size === 1) {
      // Fin d'un pincement : le doigt restant reprend le déplacement depuis ici.
      const [rest] = [...g.pointers.values()] as [{ x: number; y: number }];
      g.start = { ...g.start, view, mid: [rest.x, rest.y] };
      return;
    }
    if (g.pointers.size > 0 || g.moved || event.type === "pointercancel") return;
    // Double toucher : zoom sur l'endroit touché, ou retour à la vue d'ensemble.
    const now = Date.now();
    const near = Math.hypot(event.clientX - g.lastTap.x, event.clientY - g.lastTap.y) < 30;
    if (now - g.lastTap.time < DOUBLE_TAP_MS && near) {
      setView(
        view.scale > 1
          ? IDENTITY
          : zoomAt(DOUBLE_TAP_SCALE, toMap(event.clientX, event.clientY, view), toSvg(event.clientX, event.clientY)),
      );
      g.lastTap = { time: 0, x: 0, y: 0 };
      return;
    }
    g.lastTap = { time: now, x: event.clientX, y: event.clientY };
  };

  /** Zoom des boutons : autour du centre de la vue. */
  const zoomBy = (factor: number) => {
    const center: [number, number] = [frame.x + frame.width / 2, frame.y + frame.height / 2];
    const point: [number, number] = [(center[0] - view.x) / view.scale, (center[1] - view.y) / view.scale];
    setView(zoomAt(view.scale * factor, point, center));
  };

  const select = (code: string) => {
    // Un geste (déplacement, pincement) n'est pas un choix.
    if (gesture.current.moved || !onSelect) return;
    onSelect(code);
  };

  // Les zones mises en évidence sont dessinées en dernier : leur contour reste visible.
  const highlightedLast = (ids: string[]) => [...ids.filter((id) => !tones[id]), ...ids.filter((id) => tones[id])];
  const ordered = highlightedLast(Object.keys(data.paths));
  const rivers = layer === "departments" ? [] : highlightedLast(Object.keys(data.rivers));
  const idf = data.insets.find((inset) => inset.id === "idf")!.box;
  // Questions sur les cours d'eau : les départements ne sont qu'un fond, on ne les touche pas.
  const departmentsSelectable = Boolean(onSelect) && layer !== "rivers";

  const zone = (code: string, d: string, key: string) => (
    <path
      key={key}
      d={d}
      data-code={code}
      className={`${styles.zone} ${tones[code] ? TONE_CLASS[tones[code]] : ""} ${departmentsSelectable ? styles.selectable : ""} ${layer === "rivers" ? styles.background : ""}`}
      onClick={departmentsSelectable ? () => select(code) : undefined}
    />
  );
  const river = (id: string, d: string, key: string) => (
    <g key={key}>
      <path d={d} data-river={id} className={`${styles.river} ${tones[id] ? RIVER_TONE_CLASS[tones[id]] : ""}`} />
      {onSelect && <path d={d} className={styles.riverHit} onClick={() => select(id)} />}
    </g>
  );

  return (
    <div ref={frameRef} className={`${styles.frame} ${fill ? styles.fill : ""}`}>
      <svg
        ref={svgRef}
        className={styles.map}
        viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
        role="group"
        aria-label={label}
        // En plein écran, la page ne défile pas : tous les gestes vont à la carte.
        style={{ touchAction: fill || view.scale > 1 ? "none" : "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <defs>
          <clipPath id="encart-paris">
            <rect x={idf[0]} y={idf[1]} width={idf[2]} height={idf[3]} rx={12} />
          </clipPath>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          {ordered.map((code) => zone(code, data.paths[code]![0]!, code))}
          {rivers.map((id) => river(id, data.rivers[id]![0]!, id))}
          {data.insets.map((inset) => (
            <rect key={inset.id} className={styles.inset} x={inset.box[0]} y={inset.box[1]} width={inset.box[2]} height={inset.box[3]} rx={12} />
          ))}
          <g clipPath="url(#encart-paris)">
            {ordered.filter((code) => data.paths[code]![1]).map((code) => zone(code, data.paths[code]![1]!, `${code}-encart`))}
            {rivers.filter((id) => data.rivers[id]![1]).map((id) => river(id, data.rivers[id]![1]!, `${id}-encart`))}
          </g>
        </g>
      </svg>
      <div className={styles.controls}>
        <button type="button" className={styles.control} onClick={() => zoomBy(BUTTON_STEP)} disabled={view.scale >= MAX_SCALE} aria-label="Zoomer">
          <PlusIcon size={20} />
        </button>
        <button type="button" className={styles.control} onClick={() => zoomBy(1 / BUTTON_STEP)} disabled={view.scale <= 1} aria-label="Dézoomer">
          <MinusIcon size={20} />
        </button>
        <button type="button" className={styles.control} onClick={() => setView(IDENTITY)} disabled={view.scale <= 1} aria-label="Recentrer la carte">
          <RecenterIcon size={20} />
        </button>
      </div>
    </div>
  );
}
