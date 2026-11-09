import { APP_WORKSPACES } from '../../config/appWorkspaces';

const DOORS = [
  {
    href: '/workspace/finance/?mode=owner',
    emoji: '🍽️',
    title: 'Restaurant Owner',
    body: 'Swiggy and Zomato visual check. Open the sample two-pocket view.',
  },
  {
    href: '/workspace/finance/?mode=seller',
    emoji: '📦',
    title: 'E-commerce seller',
    body: 'Meesho, Flipkart, and Amazon weight and COD sample.',
  },
  {
    href: '/workspace/finance/?mode=munshi',
    emoji: '💼',
    title: 'Munshi and CA desk',
    body: 'Bulk client view and the sample 30% partner cut.',
  },
] as const;

export default function HomeGateway() {
  const studios = APP_WORKSPACES.filter((workspace) => workspace.id !== 'finance');

  return (
    <section className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-canvas-accent">GramSevaMitra</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-bold text-canvas-text sm:text-4xl">
          Finance Hub — payout and tax check for restaurants and sellers
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
          Start with a sample Swiggy, Zomato, or Flipkart statement. Free studios below run on this device and do not ask you to sign in.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {DOORS.map((door) => (
            <a
              key={door.href}
              href={door.href}
              className="rounded-2xl border border-canvas-border bg-canvas-surface p-4 transition hover:border-canvas-accent"
            >
              <span className="text-3xl" aria-hidden="true">
                {door.emoji}
              </span>
              <h2 className="mt-3 text-lg font-bold text-canvas-text">{door.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{door.body}</p>
            </a>
          ))}
        </div>

        <h2 className="mt-10 text-lg font-bold text-canvas-text">Free studios</h2>
        <p className="mt-1 text-sm text-slate-400">100% on-device for the free tools · no login required</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {studios.map((studio) => (
            <a
              key={studio.id}
              href={studio.href}
              className="rounded-2xl border border-canvas-border bg-canvas-elevated/40 p-4 hover:border-canvas-accent"
            >
              <p className="text-base font-semibold text-canvas-text">
                <span aria-hidden="true">{studio.emoji} </span>
                {studio.label}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{studio.description}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
