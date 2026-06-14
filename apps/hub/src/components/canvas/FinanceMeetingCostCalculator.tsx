import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chart } from 'chart.js';
import { destroyChart, gsmTooltipOptions, renderChart } from '../../lib/charts/chartHelper';
import {
  FINANCE_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/financeCanvasStorage';
import { clamp, formatInr } from '../../lib/finance/formatInr';
import {
  calculateMeetingCost,
  type MeetingAttendee,
} from '../../lib/finance/meetingCostEngine';

interface MeetingFormState {
  durationMinutes: number;
  attendees: MeetingAttendee[];
}

const DEFAULTS: MeetingFormState = {
  durationMinutes: 60,
  attendees: [
    { id: 'a1', label: 'Engineering lead', hourlyRate: 2_500 },
    { id: 'a2', label: 'Product manager', hourlyRate: 2_200 },
    { id: 'a3', label: 'Designer', hourlyRate: 1_800 },
  ],
};

const LIGHT_LEGEND = {
  labels: { color: '#64748b', boxWidth: 12, padding: 12, font: { size: 11 } },
};

function createAttendeeId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function FinanceMeetingCostCalculator() {
  const initial = useMemo(
    () => loadPersistedJson<MeetingFormState>(FINANCE_STORAGE_KEYS.meeting, DEFAULTS),
    []
  );

  const [durationMinutes, setDurationMinutes] = useState(initial.durationMinutes);
  const [attendees, setAttendees] = useState<MeetingAttendee[]>(initial.attendees);

  const chartRef = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);

  const result = useMemo(
    () => calculateMeetingCost(attendees, durationMinutes),
    [attendees, durationMinutes]
  );

  useEffect(() => {
    savePersistedJson(FINANCE_STORAGE_KEYS.meeting, { durationMinutes, attendees });
  }, [attendees, durationMinutes]);

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas || result.perAttendee.length === 0) {
      chart.current = destroyChart(chart.current);
      return;
    }

    void (async () => {
      chart.current = await renderChart(canvas, chart.current, {
        type: 'bar',
        data: {
          labels: result.perAttendee.map((a) => a.label),
          datasets: [
            {
              label: 'Meeting cost share',
              data: result.perAttendee.map((a) => Math.round(a.cost)),
              backgroundColor: '#059669',
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          scales: {
            x: { ticks: { callback: (v) => formatInr(Number(v)) } },
            y: { grid: { display: false } },
          },
          plugins: {
            legend: { display: false },
            tooltip: gsmTooltipOptions((v) => formatInr(v)),
          },
        },
      });
    })();

    return () => {
      chart.current = destroyChart(chart.current);
    };
  }, [result]);

  const inputClass =
    'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-500/30 focus:border-emerald-400 focus:ring-2 tabular-nums';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Meeting setup</h2>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Duration ({durationMinutes} min)
          <input
            type="range"
            min={15}
            max={240}
            step={15}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="mt-2 w-full accent-emerald-600"
          />
        </label>

        <div className="mt-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attendees (₹/hour)</p>
          {attendees.map((attendee, index) => (
            <div key={attendee.id} className="flex gap-2">
              <input
                value={attendee.label}
                onChange={(e) => {
                  const next = [...attendees];
                  next[index] = { ...attendee, label: e.target.value };
                  setAttendees(next);
                }}
                className={`${inputClass} flex-1`}
                placeholder="Role"
              />
              <input
                type="number"
                min={0}
                value={attendee.hourlyRate}
                onChange={(e) => {
                  const next = [...attendees];
                  next[index] = {
                    ...attendee,
                    hourlyRate: Math.max(0, Number(e.target.value) || 0),
                  };
                  setAttendees(next);
                }}
                className={`${inputClass} w-28`}
              />
              <button
                type="button"
                onClick={() => setAttendees(attendees.filter((a) => a.id !== attendee.id))}
                className="rounded-lg px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                aria-label="Remove attendee"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setAttendees([
                ...attendees,
                { id: createAttendeeId(), label: 'Attendee', hourlyRate: 1_500 },
              ])
            }
            className="w-full rounded-xl border border-dashed border-slate-300 py-2 text-sm font-semibold text-slate-600 hover:border-emerald-400 hover:text-emerald-700"
          >
            + Add attendee
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-700">Meeting cost</h2>
        <p className="mt-3 text-3xl font-bold tabular-nums text-emerald-800">
          {formatInr(Math.round(result.meetingCost))}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Combined hourly burn {formatInr(Math.round(result.totalHourlyBurn))}/hr
        </p>
        <div className="relative mt-5 h-56 rounded-xl border border-slate-100 bg-white p-2">
          <canvas ref={chartRef} aria-label="Cost per attendee" />
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">
          Based on {clamp(durationMinutes, 15, 240)} minutes · {attendees.length} attendee
          {attendees.length === 1 ? '' : 's'}
        </p>
      </section>
    </div>
  );
}
