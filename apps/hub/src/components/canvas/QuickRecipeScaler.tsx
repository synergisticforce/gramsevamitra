import { useEffect, useMemo, useState } from 'react';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';
import { formatQty, scaleRecipe } from '../../lib/convert/recipeEngine';

interface FormState {
  originalServings: number;
  targetServings: number;
  ingredients: string;
}

const DEFAULT_INGREDIENTS = `flour 2 cups\nsugar 1 cup\nmilk 500 ml\neggs 3\nbutter 100 g`;

const DEFAULTS: FormState = {
  originalServings: 4,
  targetServings: 6,
  ingredients: DEFAULT_INGREDIENTS,
};

export default function QuickRecipeScaler() {
  const initial = useMemo(
    () => loadPersistedJson<FormState>(QUICK_TOOLS_STORAGE_KEYS.recipeScaler, DEFAULTS),
    []
  );
  const [originalServings, setOriginalServings] = useState(initial.originalServings);
  const [targetServings, setTargetServings] = useState(initial.targetServings);
  const [ingredients, setIngredients] = useState(initial.ingredients);

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.recipeScaler, {
      originalServings,
      targetServings,
      ingredients,
    });
  }, [originalServings, targetServings, ingredients]);

  const scaled = useMemo(
    () => scaleRecipe(ingredients, originalServings, targetServings),
    [ingredients, originalServings, targetServings]
  );

  const inputClass =
    'w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2 tabular-nums';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Recipe</h2>
        <label className="mt-4 block text-sm font-medium text-canvas-muted">
          Original servings
          <input
            type="number"
            min={0.25}
            step={0.25}
            value={originalServings}
            onChange={(e) => setOriginalServings(Math.max(0.25, Number(e.target.value) || 1))}
            className={`${inputClass} mt-1.5`}
          />
        </label>
        <label className="mt-5 block">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-canvas-muted">Target servings</span>
            <span className="text-sm font-bold tabular-nums text-canvas-accent">{targetServings}</span>
          </div>
          <input
            type="range"
            min={1}
            max={24}
            step={0.5}
            value={targetServings}
            onChange={(e) => setTargetServings(Number(e.target.value))}
            className="w-full accent-violet-600"
          />
          <div className="mt-1 flex justify-between text-[10px] text-canvas-subtle">
            <span>1</span>
            <span>24</span>
          </div>
        </label>
        <label className="mt-5 block text-sm font-medium text-canvas-muted">
          Ingredients (one per line)
          <textarea
            rows={8}
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            placeholder={'flour 2 cups\nsugar 1 cup'}
            className={`${inputClass} mt-1.5 resize-y font-mono`}
          />
        </label>
        <p className="mt-2 text-xs text-canvas-subtle">Format: name then quantity — e.g. flour 2 cups or eggs 3</p>
      </section>

      <section aria-live="polite">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-canvas-accent">Scaled ingredients</h2>
        <div className="rounded-2xl border border-canvas-border bg-canvas-accent-soft/50 p-4 sm:p-5">
          {scaled.items.length === 0 ? (
            <p className="text-sm text-canvas-subtle">Add ingredients to see scaled quantities.</p>
          ) : (
            <ul className="divide-y divide-violet-100">
              {scaled.items.map((item) => (
                <li key={item.raw} className="flex items-baseline justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="text-sm font-medium text-canvas-text">{item.name}</span>
                  <span className="text-right text-sm font-semibold text-violet-800">
                    {item.scaledLabel}
                    <span className="block text-xs font-normal text-canvas-subtle">
                      was {formatQty(item.qty)}
                      {item.unit ? ` ${item.unit}` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {scaled.items.length > 0 && (
          <p className="mt-3 text-center text-xs text-canvas-subtle">
            Scale factor ×{scaled.factor.toFixed(3).replace(/\.?0+$/, '')} ({originalServings} → {targetServings}{' '}
            servings)
          </p>
        )}
      </section>
    </div>
  );
}
