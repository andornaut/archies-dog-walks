import { MODAL_BRIGHTNESS } from "../index.ts";

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
  // What covering changed, so uncovering restores only that: another owner of the root, such as
  // its own modal lifecycle, may change inertness or aria-hidden while it is covered.
  covered?: { readonly hidden: string | null | undefined; readonly inert: boolean };
}
const underlays = new WeakMap<HTMLElement, UnderlayState>();

function cover(element: HTMLElement, state: UnderlayState): void {
  if (state.covered !== undefined) {
    return;
  }
  const hidden = element.getAttribute("aria-hidden");
  state.covered = { hidden: hidden === "true" ? undefined : hidden, inert: !element.inert };
  element.inert = true;
  element.setAttribute("aria-hidden", "true");
}

function uncover(element: HTMLElement, state: UnderlayState): void {
  const changed = state.covered;
  if (changed === undefined) {
    return;
  }
  delete state.covered;
  if (changed.inert) {
    element.inert = false;
  }
  if (changed.hidden === null) {
    element.removeAttribute("aria-hidden");
  } else if (changed.hidden !== undefined) {
    element.setAttribute("aria-hidden", changed.hidden);
  }
}

export interface ModalUnderlay {
  (): void;
  refresh(): void;
}

// Covered native roots, the top bar included, dim once and turn inert; the current modal and
// world effects are not covered roots.
export function followModalUnderlay(
  coverage: { accepts(): boolean; subscribe(listener: () => void): () => void },
  element: HTMLElement,
): ModalUnderlay {
  const request = dimRequest(element);
  const owner = {};
  let state = underlays.get(element);
  if (state === undefined) {
    state = { leases: 0, owners: new Set() };
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
      cover(element, state);
    } else {
      uncover(element, state);
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
        uncover(element, state);
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
