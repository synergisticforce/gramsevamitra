import { useEffect, useMemo, useState } from 'react';
import { formatQty, scaleRecipe } from '../../lib/convert/recipeEngine';

const STORAGE_KEY = 'gsm-tools:recipe-scaler';

const DEFAULT_INGREDIENTS = `flour 2 cups\nsugar 1 cup\nmilk 500 ml\neggs 3\nbutter 100 g`;

export default function RecipeScalerTool() {
  const [originalServings, setOriginalServings] = useState('4');
  const [targetServings, setTargetServings] = useState('6');
  const [ingredients, setIngredients] = useState(DEFAULT_INGREDIENTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { original?: string; target?: string; ingredients?: string };
        if (s.original) setOriginalServings(s.original);
        if (s.target) setTargetServings(s.target);
        if (s.ingredients) setIngredients(s.ingredients);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const scaled = useMemo(() => {
    const original = parseFloat(originalServings) || 1;
    const target = parseFloat(targetServings) || 1;
    return scaleRecipe(ingredients, original, target);
  }, [ingredients, originalServings, targetServings]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ original: originalServings, target: targetServings, ingredients }),
      );
    } catch {
      /* ignore */
    }
  }, [originalServings, targetServings, ingredients]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-800 bg-canvas-accent-muted/60 p-5 shadow-none sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Original recipe</h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-canvas-muted">Original servings</span>
            <input
              type="number"
              min={0.25}
              step={0.25}
              value={originalServings}
              onChange={(e) => setOriginalServings(e.target.value)}
              className="input-field w-full tabular-nums"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-canvas-muted">Target servings</span>
            <input
              type="number"
              min={0.25}
              step={0.25}
              value={targetServings}
              onChange={(e) => setTargetServings(e.target.value)}
              className="input-field w-full tabular-nums"
            />
          </label>
        </div>
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-canvas-muted">Ingredients (one per line)</span>
          <textarea
            rows={10}
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            placeholder={'flour 2 cups\nsugar 1 cup'}
            className="input-field w-full resize-y font-mono text-sm"
          />
        </label>
        <p className="mt-2 text-xs text-canvas-subtle">Format: name then quantity — e.g. flour 2 cups or eggs 3</p>
      </section>

      <section aria-live="polite">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-canvas-accent/80">Scaled ingredients</h2>
        <div className="rounded-2xl border border-canvas-border bg-gradient-to-br from-emerald-950/30 to-slate-900/60 p-4 shadow-none sm:p-5">
          {scaled.items.length === 0 ? (
            <p className="text-sm text-canvas-subtle">Add ingredients to see scaled quantities.</p>
          ) : (
            <ul className="space-y-0">
              {scaled.items.map((item) => (
                <li key={item.raw} className="flex items-baseline justify-between gap-3 border-b border-slate-800/60 py-2 last:border-0">
                  <span className="text-sm font-medium text-canvas-text">{item.name}</span>
                  <span className="text-right text-sm text-canvas-accent">
                    {item.scaledLabel}
                    <span className="block text-xs text-canvas-subtle">
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
            Scale factor ×{scaled.factor.toFixed(3).replace(/\.?0+$/, '')} ({originalServings} → {targetServings} servings)
          </p>
        )}
      </section>
    </div>
  );
}
