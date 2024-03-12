import * as React from "react";

// #region targets

const targetEmitter = new EventTarget();

/**
 * Loads data from a promise and revalidates when an action targets it
 */
export function useTarget<T>(getPromise: () => Promise<T>, id: string) {
  const ref = React.useRef<Promise<T> | null>(null);
  if (!ref.current) ref.current = getPromise();
  const [, forceUpdate] = React.useState({});
  const value = React.use(ref.current);
  const deferredValue = React.useDeferredValue(value);

  React.useEffect(() => {
    const listener = (e: Event) => {
      // @ts-expect-error Should be CustomEvent but the types are wrong
      const detail = e.detail as string[] | undefined;
      if (
        detail == undefined ||
        (Array.isArray(detail) && detail.includes(id))
      ) {
        ref.current = null;
        forceUpdate({});
      }
    };
    targetEmitter.addEventListener("change", listener);
    return () => targetEmitter.removeEventListener("change", listener);
  }, [id]);

  return deferredValue || value;
}

function revalidateTargets(targets?: string[]) {
  targetEmitter.dispatchEvent(new CustomEvent("change", { detail: targets }));
}
// #endregion

export type FormAction<T = unknown> = (formData: FormData) => Promise<T>;

// #region actions
const inflightEmitter = new EventTarget();
const inflight = new Map<FormAction, Set<FormData>>();

function addInflight(action: FormAction, formData: FormData) {
  let inflightForAction = inflight.get(action);
  if (!inflightForAction) {
    inflightForAction = new Set();
    inflight.set(action, inflightForAction);
  }
  inflightForAction.add(formData);
  inflightEmitter.dispatchEvent(new CustomEvent("change", { detail: action }));
}

function removeInflight(action: FormAction, formData: FormData) {
  const inflightForAction = inflight.get(action);
  if (inflightForAction) {
    inflightForAction.delete(formData);
    if (inflightForAction.size === 0) {
      inflight.delete(action);
    }
  }
  inflightEmitter.dispatchEvent(new CustomEvent("change", { detail: action }));
}

/**
 * Returns all pending states for a specific action
 */
export function useActionStates(action: FormAction) {
  const [, forceUpdate] = React.useState({});
  React.useEffect(() => {
    const listener = () => forceUpdate({});
    inflightEmitter.addEventListener("change", listener);
    return () => inflightEmitter.removeEventListener("change", listener);
  }, [action]);
  return Array.from(inflight.get(action) || []);
}

/**
 * Wraps an action to co-locate pending states and final result instead of
 * useFormStatus and useFormState that separate them and limit access
 */
export function useAction<T extends FormAction>(action: T, targets?: string[]) {
  // allows us to cancel the previous action when interrupted
  const controllerRef = React.useRef<AbortController | null>(null);

  // form data to read during the transition for optimistic UI, React provides
  // this on useFormStatus but only in the tree below the form, this surfaces it
  // to wherever the action is being used
  const [formData, setFormData] = React.useOptimistic<FormData | null>(null);

  // since all react transitions are "entangled", and state updates are delayed
  // until the transition is over, you can't render the result of the action
  // that is complete if any other transition is pending, they all settle
  // together (?). However, useOptimistic values *can* update during a
  // transition so we need an optimistic value to update the UI when this action
  // completes without waiting on any other transition
  const [earlyResult, setEarlyResult] = React.useOptimistic<unknown>(null);

  // the final result of the action to persist after all entangled transitions
  // are complete
  const [result, setResult] = React.useState<unknown>(null);

  // run all of our updates in React's transition
  const [, startTransition] = React.useTransition();

  const actionWrapper: FormAction = async f => {
    if (controllerRef.current) controllerRef.current.abort();

    const abortController = new AbortController();
    abortController.signal.addEventListener("abort", () => {
      // if interrupted, might want to replace the old action with the new one
      // so the order is preserved? Can't think of why you'd want to do this yet
      // though, just a hunch
      removeInflight(action, f);
    });
    controllerRef.current = abortController;

    // don't await here so we can set some states
    const actionPromise = action(f);

    setEarlyResult(null);
    startTransition(async () => {
      // track globally so useActionStates can read it
      addInflight(action, f);
      setFormData(f);

      const result = await actionPromise;
      // if interrupted, ignore the result, the UI has new states
      if (abortController.signal.aborted) return;

      setEarlyResult(result);
      setFormData(null);
      setResult(result);
      removeInflight(action, f);
      if (targets) revalidateTargets(targets);
    });

    return actionPromise;
  };

  return [
    actionWrapper as FormAction<T>,
    formData,
    (earlyResult || result) as Awaited<ReturnType<T>> | null,
  ] as const;
}

// #endregion
