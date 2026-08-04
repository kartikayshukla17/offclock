import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-full bg-stone-50 text-stone-900">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-6">
        <span className="font-semibold tracking-tight">OffClock</span>
        <Link
          href="/login"
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-20 pt-8">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
          Work from home
        </p>
        <h1 className="mt-3 max-w-xl text-4xl font-semibold leading-tight tracking-tight">
          Your household knows when you&apos;re off the clock.
        </h1>
        <p className="mt-4 max-w-lg text-lg text-stone-600">
          One link on the kitchen tablet — working hours, meeting status, and a
          clear end to the day. No Slack account required for your family.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-medium text-white hover:bg-teal-800"
          >
            Get your free link
          </Link>
          <span className="flex items-center text-sm text-stone-500">
            Building in public — Day 1
          </span>
        </div>

        <div className="mt-16 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Preview — household view (Day 4)
          </p>
          <div className="mt-4 space-y-3 rounded-xl bg-stone-900 p-5 text-white">
            <p className="text-lg font-medium">Alex · Working until 6:00 PM</p>
            <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-100">
              In a meeting — back around 2:30 PM
            </p>
            <p className="text-sm text-stone-400">Lunch free 12:00 – 1:00 PM</p>
          </div>
        </div>
      </main>
    </div>
  );
}
