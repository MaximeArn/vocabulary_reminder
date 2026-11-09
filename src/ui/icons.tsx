/** Icônes au trait, dessinées pour l'app (24×24, couleur héritée du texte). */

interface IconProps {
  size?: number;
}

function Svg({ size = 24, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function CollectionIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z" />
    </Svg>
  );
}

export function ProgressIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20h16" />
      <path d="M7 16v-3M12 16V8M17 16V5" />
    </Svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m15 5-7 7 7 7" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.5-4.5" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function CrossIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9 5 7 7-7 7" />
    </Svg>
  );
}

export function CardsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="6" width="13" height="14" rx="2" />
      <path d="M8 3h10a2 2 0 0 1 2 2v12" />
    </Svg>
  );
}

export function CloudIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 10.5 3.75 3.75 0 0 0 7 18Z" />
    </Svg>
  );
}

export function PulseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 12h4l2-5 4 10 2-5h6" />
    </Svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </Svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.3 2.6-4.9 3.4-8.4 2.4 1.3 3.6 3.4 3.6 5.4 .9-.6 1.6-1.6 1.8-2.8C16.6 11.3 18 13.4 18 15.6 18 18.7 15.6 21 12 21Z" />
    </Svg>
  );
}

export function LaurelIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21v-5M12 16c-4 0-7-3-7-8M12 16c4 0 7-3 7-8M5 8c1.5.2 2.6 1 3 2.5M19 8c-1.5.2-2.6 1-3 2.5M6.5 12.5c1.4-.3 2.6.1 3.4 1.2M17.5 12.5c-1.4-.3-2.6.1-3.4 1.2" />
    </Svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}




/* ---------- Icônes en deux parties ----------
 * Chaque icône d'entraînement est dessinée en deux tracés qui ont un sens
 * (deux flèches, deux familles de rayons). En mode « Tout », chaque tracé prend
 * la couleur d'une catégorie ; sinon, les deux suivent la couleur du texte.
 */

interface TwoToneProps extends IconProps {
  /** Couleurs des deux tracés ; par défaut, la couleur du texte. */
  tones?: [string, string];
}

function TwoTone({ size, tones, first, second }: TwoToneProps & { first: string; second: string }) {
  return (
    <Svg size={size}>
      <path d={first} style={tones ? { stroke: tones[0] } : undefined} />
      <path d={second} style={tones ? { stroke: tones[1] } : undefined} />
    </Svg>
  );
}

/** Deux flèches qui tournent en cycle : revenir sur ce qui a été oublié. */
export function RepeatIcon(props: TwoToneProps) {
  return (
    <TwoTone
      {...props}
      first="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5"
      second="M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5"
    />
  );
}

/** Une étincelle : rayons droits d'un côté, rayons diagonaux de l'autre. */
export function SparkIcon(props: TwoToneProps) {
  return (
    <TwoTone
      {...props}
      first="M12 3v4M12 17v4M3 12h4M17 12h4"
      second="M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"
    />
  );
}

/** Deux flèches qui se croisent : un tirage mélangé. */
export function ShuffleIcon(props: TwoToneProps) {
  return (
    <TwoTone
      {...props}
      first="M4 7h3.5c4.5 0 5.5 10 10 10H20M17.5 14.5 20 17l-2.5 2.5"
      second="M4 17h3.5c1.8 0 3-1.6 4-3.6M14.5 10.6c1-2 2.2-3.6 4-3.6H20M17.5 4.5 20 7l-2.5 2.5"
    />
  );
}
