export interface JsonFieldOption {
  path: string;
  sampleValue: string;
}

function formatSampleValue(value: unknown): string {
  if (typeof value === "string") {
    return value.length > 80 ? `${value.slice(0, 77)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }

  if (typeof value === "object") {
    return "Object";
  }

  return typeof value;
}

function collectFieldPaths(
  value: unknown,
  prefix: string,
  map: Map<string, string>,
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectFieldPaths(item, prefix, map);
    });
    return;
  }

  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      const nextPath = prefix ? `${prefix}.${key}` : key;
      if (Array.isArray(child) || (typeof child === "object" && child !== null)) {
        collectFieldPaths(child, nextPath, map);
        continue;
      }

      if (!map.has(nextPath)) {
        map.set(nextPath, formatSampleValue(child));
      }
    }
  }
}

function hasSelectedDescendant(path: string, selected: Set<string>): boolean {
  const prefix = `${path}.`;
  for (const item of selected) {
    if (item.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function filterArray(value: unknown[], path: string, selected: Set<string>): unknown[] | undefined {
  const filtered = value
    .map((item) => filterValue(item, path, selected))
    .filter((item) => item !== undefined);
  return filtered.length > 0 ? filtered : undefined;
}

function shouldKeepBranch(path: string, selected: Set<string>): boolean {
  return selected.has(path) || hasSelectedDescendant(path, selected);
}

function filterObject(
  value: Record<string, unknown>,
  path: string,
  selected: Set<string>,
): Record<string, unknown> | undefined {
  const result: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (!shouldKeepBranch(nextPath, selected)) {
      continue;
    }

    if (selected.has(nextPath)) {
      result[key] = child;
      continue;
    }

    const filteredChild = filterValue(child, nextPath, selected);
    if (filteredChild !== undefined) {
      result[key] = filteredChild;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function filterValue(value: unknown, path: string, selected: Set<string>): unknown {
  if (Array.isArray(value)) {
    return filterArray(value, path, selected);
  }

  if (typeof value === "object" && value !== null) {
    return filterObject(value as Record<string, unknown>, path, selected);
  }

  return selected.has(path) ? value : undefined;
}

export function extractJsonFieldOptions(value: unknown): JsonFieldOption[] {
  const map = new Map<string, string>();
  collectFieldPaths(value, "", map);
  return Array.from(map.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, sampleValue]) => ({ path, sampleValue }));
}

export function filterJsonFields(value: unknown, selectedPaths: string[]): unknown {
  if (selectedPaths.length === 0) {
    return value;
  }

  const selected = new Set(selectedPaths);
  return filterValue(value, "", selected) ?? value;
}
