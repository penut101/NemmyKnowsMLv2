"use client";

import { useId, useMemo, useRef } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { Combobox } from "@base-ui/react/combobox";
import { ChevronDown } from "lucide-react";

export interface ComparisonPlayer {
  id: string;
  label: string;
  group: string;
}

// A pool too large to hold searches on the server: the parent fetches matches
// for what is typed and passes them, with the selected players, as `players`,
// which are then shown as they are rather than filtered again here.
export interface ServerPlayerSearch {
  onQueryChange: (query: string) => void;
  status: "searching" | "failed" | null;
  placeholder: string;
}

export function PlayerComparisonPicker({
  players,
  selected,
  onChange,
  description,
  disclosure,
  search,
  noun = "player",
}: {
  players: ComparisonPlayer[];
  selected: string[];
  onChange: (ids: string[]) => void;
  description: string;
  disclosure: { open: boolean; onOpenChange: (open: boolean) => void };
  search?: ServerPlayerSearch;
  noun?: string;
}) {
  const inputId = useId();
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
  // Matches that arrive after the last keystroke are not auto-highlighted, so
  // Enter with nothing highlighted takes the first match instead of clearing.
  const highlighted = useRef<ComparisonPlayer | undefined>(undefined);
  const byId = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );
  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.label.localeCompare(b.label)),
    [players],
  );
  const first = byId.get(selected[0]);
  const second = byId.get(selected[1]);
  const opponents = useMemo(
    () =>
      first
        ? sortedPlayers.filter(
            (player) => player.group === first.group && player.id !== first.id,
          )
        : [],
    [sortedPlayers, first],
  );

  const choose = (slot: 0 | 1, player: ComparisonPlayer | null) => {
    if (slot === 0)
      onChange(
        player
          ? [
              player.id,
              ...(second &&
              second.group === player.group &&
              second.id !== player.id
                ? [second.id]
                : []),
            ]
          : [],
      );
    else if (first) onChange([first.id, ...(player ? [player.id] : [])]);
  };

  const clearButton = selected.length > 0 && (
    <button
      type="button"
      onClick={() => onChange([])}
      className="min-h-9 px-2 text-xs text-primary underline underline-offset-4"
    >
      Clear comparison
    </button>
  );

  return (
    <Collapsible.Root
      open={disclosure.open}
      onOpenChange={disclosure.onOpenChange}
      render={<section aria-label={`Compare ${noun}s`} />}
      className="rounded-md border border-rule-strong"
    >
      <h2>
        <Collapsible.Trigger className="group flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="text-sm">Compare two {noun}s</span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-data-[panel-open]:rotate-180" />
        </Collapsible.Trigger>
      </h2>
      <Collapsible.Panel className="space-y-3 px-3 pb-3">
        <p className="text-xs text-muted-foreground">{description}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {([0, 1] as const).map((slot) => (
            <Combobox.Root
              key={`${slot}-${slot === 1 ? (first?.group ?? "empty") : "first"}`}
              items={slot === 0 ? sortedPlayers : opponents}
              value={(slot === 0 ? first : second) ?? null}
              itemToStringLabel={(player: ComparisonPlayer) => player.label}
              isItemEqualToValue={(a, b) => a.id === b.id}
              onValueChange={(player) => choose(slot, player)}
              disabled={slot === 1 && !first}
              limit={30}
              autoHighlight
              {...(search && {
                filter: null,
                onInputValueChange: (query: string) => search.onQueryChange(query),
                onItemHighlighted: (player: ComparisonPlayer | undefined) => {
                  highlighted.current = player;
                },
              })}
            >
              <div className="min-w-0 space-y-1">
                <label
                  htmlFor={`${inputId}-${slot}`}
                  className="text-xs text-muted-foreground"
                >
                  {Noun} {slot === 0 ? "A" : "B"}
                </label>
                <div className="relative">
                  <Combobox.Input
                    id={`${inputId}-${slot}`}
                    onKeyDown={(event) => {
                      const firstMatch = (slot === 0 ? sortedPlayers : opponents)[0];
                      if (search && event.key === "Enter" && !highlighted.current && firstMatch) {
                        event.preventDefault();
                        choose(slot, firstMatch);
                      }
                    }}
                    placeholder={
                      slot === 1 && !first
                        ? `Choose the first ${noun}`
                        : (search?.placeholder ?? "Search name or team")
                    }
                    className="h-11 w-full min-w-0 rounded-md border border-input bg-background pl-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  />
                  <Combobox.Trigger
                    aria-label={
                      slot === 0 ? `Choose first ${noun}` : `Choose second ${noun}`
                    }
                    className="absolute inset-y-0 right-0 flex w-9 items-center justify-center"
                  >
                    <ChevronDown className="size-4" />
                  </Combobox.Trigger>
                </div>
              </div>
              <Combobox.Portal>
                <Combobox.Positioner sideOffset={4} className="z-50">
                  <Combobox.Popup className="w-[var(--anchor-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
                    <Combobox.Empty className="p-3 text-sm text-muted-foreground">
                      {search?.status === "searching"
                        ? "Searching…"
                        : search?.status === "failed"
                          ? "Search failed. Edit the name to try again."
                          : `No matching ${noun}s.`}
                    </Combobox.Empty>
                    <Combobox.List className="max-h-64 overflow-y-auto p-1">
                      {(player: ComparisonPlayer) => (
                        <Combobox.Item
                          key={player.id}
                          value={player}
                          className="cursor-pointer rounded-sm px-2 py-2.5 text-sm data-[highlighted]:bg-accent data-[selected]:font-semibold"
                        >
                          {player.label}
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          ))}
        </div>
        {clearButton && <div className="flex justify-end">{clearButton}</div>}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
