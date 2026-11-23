import { useEffect, useState } from "react";
import { ChevronsUpDown, LocateFixed } from "lucide-react";
import { api } from "@/api";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { currentPosition } from "@/lib/geolocation";

const SEARCH_DELAY_MS = 300;

// Pick the household's place: search Philippine places, or use the browser's (rounded) position.
// onPick gets { name, latitude, longitude }.
export default function LocationPicker({ householdId, location, onPick }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | searching | done | error
  const [searchError, setSearchError] = useState("");
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");

  // Search a moment after typing stops; a newer search cancels the older one.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setStatus("searching");
      api
        .searchPlaces(householdId, text, { signal: controller.signal })
        .then((items) => {
          setResults(items);
          setStatus("done");
        })
        .catch((error) => {
          if (error.name === "AbortError") return;
          setResults([]);
          setSearchError(error.message);
          setStatus("error");
        });
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [householdId, query]);

  function pick(place) {
    setOpen(false);
    setQuery("");
    setLocateError("");
    onPick({ name: place.name, latitude: place.latitude, longitude: place.longitude });
  }

  async function useMyLocation() {
    if (locating) return;
    setLocating(true);
    setLocateError("");
    try {
      pick({ name: "My location", ...(await currentPosition()) });
    } catch (error) {
      setLocateError(error.message);
    } finally {
      setLocating(false);
    }
  }

  const message = {
    idle: "Type at least 2 letters.",
    searching: "Searching...",
    done: results.length === 0 ? "No places found." : "",
    error: searchError,
  }[status];

  return (
    <div className="flex flex-col gap-1.5">
      <Label id="solar-location-label" className="text-xs tracking-wide text-muted-foreground uppercase">
        Location
      </Label>
      <div className="flex flex-wrap gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-labelledby="solar-location-label solar-location-value"
              className="min-w-56 justify-between"
            >
              <span id="solar-location-value" className="truncate">
                {location.name}
              </span>
              <ChevronsUpDown className="opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
            {/* The server already matched the text, so cmdk must not filter again. */}
            <Command shouldFilter={false} label="Search places">
              <CommandInput placeholder="Search your city or town" value={query} onValueChange={setQuery} />
              <CommandList>
                {message && (
                  <p role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {message}
                  </p>
                )}
                {results.length > 0 && (
                  <CommandGroup>
                    {results.map((place) => {
                      const key = `${place.name}|${place.latitude}|${place.longitude}`;
                      return (
                        <CommandItem key={key} value={key} onSelect={() => pick(place)}>
                          <span className="truncate">{place.name}</span>
                          {place.region && (
                            <span className="ml-auto truncate text-xs text-muted-foreground">{place.region}</span>
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Never disabled: a disabled button drops keyboard focus to the page. */}
        <Button variant="ghost" aria-disabled={locating} onClick={useMyLocation} aria-describedby="solar-locate-hint">
          <LocateFixed />
          {locating ? "Locating..." : "Use my location"}
        </Button>
      </div>
      <p id="solar-locate-hint" className="text-xs text-muted-foreground">
        Your position is rounded to about 1 km and only used to estimate sunlight.
      </p>
      {locateError && (
        <p role="alert" className="text-xs text-danger">
          {locateError}
        </p>
      )}
    </div>
  );
}
