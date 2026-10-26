import Image from "next/image";

export function MomentumWordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image src="/icon.svg" alt="" width={44} height={44} className="shrink-0" />
      <span className="font-heading text-[23px] font-semibold tracking-[-0.055em]">
        NemmyKnowsML
      </span>
    </span>
  );
}
