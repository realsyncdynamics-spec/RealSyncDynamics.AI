import { Eyebrow } from "@/components/layout/section";

export function PageHero({
  eyebrow,
  title,
  copy,
  image,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  image?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden border-b border-border">
      {image ? (
        <img
          src={image}
          alt=""
          width={1792}
          height={1008}
          className="absolute inset-0 size-full object-cover opacity-30"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-bg/40 to-bg" />
      <div className="relative mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24 lg:px-12">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="max-w-3xl text-4xl font-medium tracking-[-0.04em] text-fg md:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted md:text-lg">{copy}</p>
      </div>
    </section>
  );
}
