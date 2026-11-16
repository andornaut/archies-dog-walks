import { MODAL_BRIGHTNESS } from "../dimArt.ts";

interface DimState {
  readonly owners: Set<object>;
  filter: string;
  priority: string;
  applied?: string;
}
const states = new WeakMap<HTMLElement, DimState>();
const roots = new Set<HTMLElement>();

function restore(root: HTMLElement, state: DimState): void {
  if (state.applied === undefined) {
    return;
  }
  if (root.style.filter === state.applied) {
    root.style.setProperty("filter", state.filter, state.priority);
  } else {
    state.filter = root.style.filter;
    state.priority = root.style.getPropertyPriority("filter");
  }
  delete state.applied;
}

function refreshRoots(): void {
  const current: { root: HTMLElement; state: DimState }[] = [];
  for (const root of roots) {
    const state = states.get(root)!;
    restore(root, state);
    current.push({ root, state });
  }
  for (const { root, state } of current) {
    if (
      state.owners.size === 0 ||
      current.some(
        (other) => other.root !== root && other.state.owners.size > 0 && other.root.contains(root),
      )
    ) {
      continue;
    }
    state.filter = root.style.filter;
    state.priority = root.style.getPropertyPriority("filter");
    const original = state.filter && state.filter !== "none" ? `${state.filter} ` : "";
    state.applied = `${original}brightness(${MODAL_BRIGHTNESS})`;
    root.style.setProperty("filter", state.applied, state.priority);
  }
}

function dimRequest(root: HTMLElement): (covered: boolean) => void {
  let state = states.get(root);
  if (state === undefined) {
    state = { filter: "", owners: new Set(), priority: "" };
    states.set(root, state);
  }
  const owner = {};
  return (covered) => {
    if (covered) {
      state.owners.add(owner);
      roots.add(root);
    } else {
      state.owners.delete(owner);
      if (state.owners.size === 0) {
        restore(root, state);
        roots.delete(root);
      }
    }
    refreshRoots();
  };
}

const explicit = new WeakMap<HTMLElement, (covered: boolean) => void>();

// Each independently covered root darkens original paint once; nested roots never multiply it.
export function setRampDimmed(root: HTMLElement, dimmed: boolean): void {
  let request = explicit.get(root);
  if (request === undefined) {
    request = dimRequest(root);
    explicit.set(root, request);
  }
  request(dimmed);
}

// Replaced children and late image paint inherit their covered root's existing filter.
export function dimDrawn(element: HTMLElement, dimmed: boolean): void {
  if (dimmed && [...roots].some((root) => root.contains(element))) {
    refreshRoots();
  }
}

interface UnderlayState {
  leases: number;
  readonly owners: Set<object>;
  readonly inert: boolean;
  readonly hidden: string | null;
}
const underlays = new WeakMap<HTMLElement, UnderlayState>();

export interface ModalUnderlay {
  (): void;
  refresh(): void;
}

// Native roots exclude the protected top bar, current modal and world effects.
export function followModalUnderlay(
  coverage: { accepts(): boolean; subscribe(listener: () => void): () => void },
  element: HTMLElement,
): ModalUnderlay {
  const request = dimRequest(element);
  const owner = {};
  let state = underlays.get(element);
  if (state === undefined) {
    state = {
      hidden: element.getAttribute("aria-hidden"),
      inert: element.inert,
      leases: 0,
      owners: new Set(),
    };
    underlays.set(element, state);
  }
  state.leases++;
  let alive = true;
  const refresh = () => {
    if (!alive) {
      return;
    }
    const covered = !coverage.accepts();
    request(covered);
    if (covered) {
      state.owners.add(owner);
    } else {
      state.owners.delete(owner);
    }
    if (state.owners.size > 0) {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    } else {
      element.inert = state.inert;
      if (state.hidden === null) {
        element.removeAttribute("aria-hidden");
      } else {
        element.setAttribute("aria-hidden", state.hidden);
      }
    }
  };
  const stop = coverage.subscribe(refresh);
  refresh();
  return Object.assign(
    () => {
      if (!alive) {
        return;
      }
      state.owners.delete(owner);
      request(false);
      // Restore through the same ownership rule without acquiring another request.
      if (state.owners.size === 0) {
        element.inert = state.inert;
        if (state.hidden === null) {
          element.removeAttribute("aria-hidden");
        } else {
          element.setAttribute("aria-hidden", state.hidden);
        }
      }
      alive = false;
      state.leases--;
      if (state.leases === 0) {
        underlays.delete(element);
      }
      stop();
    },
    { refresh },
  );
}
