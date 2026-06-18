import type { VideoToolCategory, VideoToolId } from '../../config/videoCanvasTools';
import {
  VIDEO_CANVAS_TOOLS,
  VIDEO_CATEGORY_META,
  videoToolsByCategory,
} from '../../config/videoCanvasTools';

interface Props {
  onSelectTool: (toolId: VideoToolId) => void;
}

const CATEGORY_ORDER: VideoToolCategory[] = ['extract', 'transform', 'convert'];

export default function VideoToolGrid({ onSelectTool }: Props) {
  const grouped = videoToolsByCategory();

  return (
    <div className="space-y-8">
      {CATEGORY_ORDER.map((category) => {
        const tools = grouped[category];
        if (tools.length === 0) return null;
        const meta = VIDEO_CATEGORY_META[category];

        return (
          <section key={category}>
            <div className="mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent">
                {meta.label}
              </h2>
              <p className="mt-0.5 text-sm font-medium leading-relaxed text-slate-200">{meta.description}</p>
            </div>

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <li key={tool.id}>
                  <button
                    type="button"
                    onClick={() => onSelectTool(tool.id)}
                    className="group flex h-full w-full flex-col items-start gap-3 rounded-2xl border border-canvas-border bg-canvas-surface p-4 text-left shadow-none transition hover:border-violet-300 hover:shadow-md active:scale-[0.98] sm:p-5"
                  >
                    <span className="text-3xl leading-none" aria-hidden="true">
                      {tool.icon}
                    </span>
                    <div>
                      <p className="text-base font-semibold text-white group-hover:text-violet-200">
                        {tool.label}
                      </p>
                      <p className="mt-1 text-sm font-medium leading-relaxed text-slate-200">{tool.description}</p>
                    </div>
                    <span className="mt-auto text-xs font-semibold text-canvas-accent">Open tool →</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <p className="rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3 text-center text-xs font-medium leading-relaxed text-slate-300">
        {VIDEO_CANVAS_TOOLS.length} video tools · processed on your device · never uploaded to our servers
      </p>
    </div>
  );
}
