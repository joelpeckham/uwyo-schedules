import { HOME_FAQ_ITEMS } from "@/lib/seo/home-faq";
import { Reveal } from "@/components/landing/motion";

export function LandingFaq() {
  return (
    <section
      className="px-4 py-14 sm:px-6 sm:py-16"
      aria-labelledby="landing-faq-heading"
    >
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <h2
            id="landing-faq-heading"
            className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl"
          >
            Common questions
          </h2>
        </Reveal>
        <dl className="mt-10 space-y-8">
          {HOME_FAQ_ITEMS.map((item, index) => (
            <Reveal key={item.question} delay={Math.min(index * 0.05, 0.35)}>
              <div>
                <dt className="font-medium text-foreground">{item.question}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {item.answer}
                </dd>
              </div>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
