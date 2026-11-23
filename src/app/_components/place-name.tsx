import { splitPlaceTail } from "@/core/tenant/place-tail.ts";

/**
 * The office's name with the town's last word and the state kept on one
 * line ("Cruzeta / RN"), so a narrow screen never leaves "/ RN" alone.
 */
export function PlaceName({ text }: { text: string }) {
  const { head, tail } = splitPlaceTail(text);
  if (!tail) return <>{text}</>;
  return (
    <>
      {head}
      <span className="whitespace-nowrap">{tail}</span>
    </>
  );
}
