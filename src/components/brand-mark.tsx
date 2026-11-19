import { initials } from "@/lib/brand";

/** The business's initials in a rounded square, in its brand color. */
export function BrandMark({ name, size }: { name: string; size: number }) {
  return (
    <span
      aria-hidden="true"
      className="font-display inline-grid shrink-0 place-items-center rounded-lg bg-brand font-bold text-brand-ink"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initials(name)}
    </span>
  );
}
