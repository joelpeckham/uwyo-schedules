import { HOME_FAQ_ITEMS } from "@/lib/seo/home-faq";

export function LandingFaq() {
  return (
    <section
      className="px-4 py-14 sm:px-6 sm:py-16"
      aria-labelledby="landing-faq-heading"
    >
      <div className="mx-auto max-w-3xl">
        <h2
          id="landing-faq-heading"
          className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl"
        >
          Common questions
        </h2>
        <dl className="mt-10 space-y-8">
          {HOME_FAQ_ITEMS.map((item) => (
            <div key={item.question}>
              <dt className="font-medium text-foreground">{item.question}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
