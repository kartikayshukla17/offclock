/* Hallmark · macrostructure: Letter · H12 hero knobs: salutation=direct-address, body=2 paragraphs, signoff=first-name
 * theme: custom · vibe: "soft glass, warm neutral base, vivid teal anchor" · paper: oklch(97% 0.018 60) · accent: oklch(62% 0.13 195)
 * display: Bricolage Grotesque · body: Geist · axes: light / geometric-sans / chromatic-teal
 * studied: no · context: explicit · design-system: design.md · designed-as-app
 * pre-emit critique: P5 H4 E4 S4 R5 V4
 */
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-full bg-paper text-ink">
      <nav className="mx-auto mt-4 flex w-fit items-center gap-6 rounded-full glass px-5 py-2.5 shadow-sm">
        <span className="font-display text-sm font-bold tracking-tight">
          OffClock
        </span>
        <Link
          href="/login"
          className="focus-ring rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink transition-transform duration-150 ease-out hover:scale-[1.03] active:translate-y-px"
        >
          Sign in
        </Link>
      </nav>

      <main className="mx-auto max-w-[50ch] px-6 pb-24 pt-16 sm:pt-24">
        <h1 className="font-display text-display font-medium leading-[1.15] tracking-tight text-balance [overflow-wrap:anywhere] min-w-0">
          Hi. If you work from home, this note&apos;s for you.
        </h1>

        <div className="mt-8 space-y-5 text-lg leading-relaxed text-ink-2">
          <p>
            Your family can&apos;t see the red dot on Slack. So you get walked
            in on mid-call, or you&apos;re &ldquo;still working&rdquo; at 9pm
            because nothing marked the actual end of the day. There&apos;s no
            commute anymore either, no ten minutes in the car where
            &ldquo;work&rdquo; visibly ends and &ldquo;home&rdquo; visibly
            starts.
          </p>
          <p>
            I built OffClock to fix that with one link. It shows your
            household your hours, whether you&apos;re free or in a meeting,
            and when you&apos;re actually done. No login, no app, works on
            the oldest tablet in the house.
          </p>
        </div>

        <p className="mt-10 text-center text-sm tracking-widest text-muted">
          * * *
        </p>

        <figure className="mt-10 overflow-hidden rounded-card glass p-2 shadow-sm">
          <figcaption className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-muted">
            What your household sees
          </figcaption>
          <div className="mt-3 space-y-3 rounded-[calc(var(--radius-card)-0.5rem)] bg-ink p-6 text-paper">
            <p className="font-display text-xl font-medium">
              Alex · Working until 6:00 PM
            </p>
            <p className="rounded-input bg-danger/20 px-3 py-2 text-sm text-danger-bg">
              In a meeting — back around 2:30 PM
            </p>
            <p className="text-sm text-paper/60">Lunch free 12:00 – 1:00 PM</p>
          </div>
        </figure>

        <div className="mt-14 space-y-1 text-lg leading-relaxed text-ink-2">
          <p>
            Still building. Status, hours, shutdown ritual, recurring
            schedule, all live now.
          </p>
          <p>— Kartikay</p>
        </div>

        <p className="mt-8">
          <Link
            href="/login"
            className="text-base font-medium text-accent focus-ring rounded underline decoration-2 underline-offset-2 hover:text-ink"
          >
            p.s. it&apos;s free — get your own link →
          </Link>
        </p>
      </main>

      <footer className="mx-auto max-w-[50ch] px-6 pb-12 text-sm text-muted">
        OffClock — your household knows when you&apos;re off the clock.
      </footer>
    </div>
  );
}
