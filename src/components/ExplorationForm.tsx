"use client";

import { Compass, MapPin, Target } from "lucide-react";

import type { ExplorationRequest, OutputCategory } from "@/lib/types";
import { OUTPUT_CATEGORY_LABELS } from "@/lib/types";

interface ExplorationFormProps {
  value: ExplorationRequest;
  onChange: (next: ExplorationRequest) => void;
  onSubmit: () => void;
  isLoading: boolean;
  live?: boolean;
  /** True while the server has not yet confirmed Live availability: the form cannot submit. */
  blocked?: boolean;
  /** Live was asked for in the URL but the server reports it unavailable: the form runs Demo. */
  liveUnavailable?: boolean;
}

export function ExplorationForm({
  value,
  onChange,
  onSubmit,
  isLoading,
  live = false,
  blocked = false,
  liveUnavailable = false,
}: ExplorationFormProps) {
  const update = <K extends keyof ExplorationRequest>(
    key: K,
    next: ExplorationRequest[K],
  ) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <form
      className="panel space-y-5 p-5 sm:p-7"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-white">Exploration Input</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Frame a creative objective and cultural interest.{" "}
            {live
              ? "Live Mode queries the real Qloo API (a small, capped number of requests per run)."
              : liveUnavailable
                ? "Live Mode is unavailable on this server. Demo Mode runs entirely on fictional sample data."
                : "Demo Mode runs entirely on fictional sample data."}
          </p>
        </div>
        <span className={live ? "badge" : "badge badge-demo"}>{live ? "Live Mode" : liveUnavailable ? "Live unavailable · Demo" : "Demo Mode"}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="field-label" htmlFor="objective">
            <Target className="mr-1 inline h-3 w-3" aria-hidden />
            Creative objective
          </label>
          <textarea
            id="objective"
            className="field-textarea"
            placeholder="e.g. Design a late-night hospitality product for culturally curious travelers"
            value={value.creativeObjective}
            onChange={(e) => update("creativeObjective", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="interest">
            <Compass className="mr-1 inline h-3 w-3" aria-hidden />
            Target cultural interest
          </label>
          <input
            id="interest"
            className="field-input"
            placeholder="e.g. jazz, anime, streetwear, specialty coffee"
            value={value.culturalInterest}
            onChange={(e) => update("culturalInterest", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="location">
            <MapPin className="mr-1 inline h-3 w-3" aria-hidden />
            Location (optional)
          </label>
          <input
            id="location"
            className="field-input"
            placeholder="e.g. Lisbon, Brooklyn, Seoul"
            value={value.location ?? ""}
            onChange={(e) => update("location", e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="field-label" htmlFor="output">
            Output category
          </label>
          <select
            id="output"
            className="field-select"
            value={value.outputCategory}
            onChange={(e) =>
              update("outputCategory", e.target.value as OutputCategory)
            }
          >
            {(Object.keys(OUTPUT_CATEGORY_LABELS) as OutputCategory[]).map(
              (key) => (
                <option key={key} value={key}>
                  {OUTPUT_CATEGORY_LABELS[key]}
                </option>
              ),
            )}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={
            isLoading ||
            blocked ||
            !value.creativeObjective.trim() ||
            !value.culturalInterest.trim()
          }
        >
          {isLoading ? "Exploring…" : "Run Cultural Discovery"}
        </button>
        <p className="text-xs text-[var(--text-dim)]">
          Drafts auto-save to browser localStorage. No accounts required.
        </p>
      </div>
    </form>
  );
}
