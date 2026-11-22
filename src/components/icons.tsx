import type { SVGProps } from "react";

type IconName = "drink" | "search" | "bag" | "cup" | "coffee" | "juice" | "bottle";

const paths: Record<IconName, React.ReactNode> = {
  drink: <><path d="M5 9h14l-2 12H7L5 9ZM4 9h16M9 5h6l2 4m-5 4 4-10 4-1" /><path d="M10 17h.01m4 1h.01" /></>,
  search: <><circle cx="10.7" cy="10.7" r="5.7" /><path d="m15 15 4 4" /></>,
  bag: <><path d="M5.5 7.5h13L20 21H4L5.5 7.5Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
  cup: <><path d="M4 8h16m-2 0-2 13H8L6 8m7 0 3-5 4-1" /><path d="M10 17h.01m4-2h.01" /></>,
  coffee: <><path d="M4 9h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Zm13 1h2a2 2 0 0 1 0 4h-2M3 21h16M8 6V3m4 3V3" /></>,
  juice: <><circle cx="12" cy="13" r="8" /><path d="M12 5c0-2 2-3 4-3M4 13h16m-8-8v16m-6-14 12 12M6 19 18 7" /></>,
  bottle: <><path d="M9 3h6m-5 0v5l-3 3v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-8l-3-3V3M7 13h10m-10 4h10" /></>,
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>{paths[name]}</svg>;
}

export function CategoryIcon({ slug }: { slug: string }) {
  const name = { "tra-sua": "cup", "ca-phe": "coffee", "nuoc-ep": "juice", "nuoc-dong-chai": "bottle" } as const;
  return <Icon name={name[slug as keyof typeof name] ?? "drink"} className="size-6" />;
}
