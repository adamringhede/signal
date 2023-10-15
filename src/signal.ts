export type Signal<T> = () => T

export type WritableSignal<T> = {
  set(value: T): void
  update(updateFn: (value: T) => T): void
  mutate(mutateFn: (value: T) => void): void
} & Signal<T>

export type ValueEqualityFn<T> = (a: T, b: T) => boolean;
export type CreateSignalOptions<T> = {
  equal?: ValueEqualityFn<T>
}

type EffectTrigger = () => void
type EffectContext = {
  trigger: EffectTrigger
  onDestroy: (() => void)[] 
  options?: EffectOptions
  childEffects: EffectRef[]
}

type ComputedContext = {
  cacheInvalidation: () => void,
  // Set by signal
  onLateEffects?: ((ectx: EffectContext) => void)[] 
}

type BatchContext = {
  // a reference to all unique trigger functions
  triggers: Set<EffectTrigger>
}

const batchContextStack: BatchContext[] = []
const computedContextStack: ComputedContext[] = []
const effectContextStack: EffectContext[] = []

export function signal<T>(value: T, options?: CreateSignalOptions<T>): WritableSignal<T> {
  let current = value
  const triggers = new Set<EffectTrigger>()
  const cacheInvalidators: (()=>void)[] = []
  const getter = function () {
    const effectContext = effectContextStack[effectContextStack.length-1]
    if (effectContext != null) {
      const trigger = effectContext.trigger
      triggers.add(trigger)
      effectContext.onDestroy.push(() => triggers.delete(trigger))
    }
      
    if (computedContextStack.length > 0) {
      for (const ctx of computedContextStack) {
        cacheInvalidators.push(ctx.cacheInvalidation)
        ctx.onLateEffects?.push(ectx => {
          const trigger = ectx.trigger
          triggers.add(trigger)
          ectx.onDestroy.push(() => triggers.delete(trigger))
        })
      }
    } 
    return current 
  }
  const isEqual = options?.equal ?? ((a: T, b: T) => a === b)
  const propagateChanges = () => {
    cacheInvalidators.forEach((fn) => fn())
    if (batchContextStack.length > 0) {
      const batchContext = batchContextStack[batchContextStack.length-1]
      triggers.forEach(trigger => batchContext.triggers.add(trigger))
      return
    }
    triggers.forEach((fn) => fn())
  }
  const set = (updated: T) => {
    const effectContext = effectContextStack[effectContextStack.length-1]
    if (effectContext != null && effectContext.options?.allowSignalWrites !== true) {
      throw "Can't update a signal from an effect"
    }
    if (isEqual(updated, current)) {
      return
    }
    current = updated
    propagateChanges()
  }
  const update = (updateFn: (value: T) => T) => {
    set(updateFn(current))
  }
  const mutate = (mutateFn: (value: T) => void) => {
    mutateFn(current)
    propagateChanges()
  }
  return Object.assign(getter, { set, update, mutate })
}

export function computed<R>(fn: () => R): Signal<R> {
  let hasCache = false
  let cached: R|undefined
  const context: ComputedContext = {
    cacheInvalidation: () => {
      hasCache = false
    },
    onLateEffects: []
  }
  return () => {
    if (hasCache) {
      // if this is being called in any new effect, then 
      // new trigger functions need to be added
      const effectContext = effectContextStack[effectContextStack.length-1]
      if (effectContext) {
        context.onLateEffects?.forEach(callback => callback(effectContext!)) 
      }
      return cached as R
    }
    computedContextStack.push(context)
    const result = cached = fn()
    hasCache = true
    computedContextStack.pop()  
    return result
  }
}

type EffectOptions =  {
  allowSignalWrites?: boolean
}

type EffectRef = {
  destroy(): void
}

export function effect(fn: () => void, options?: EffectOptions): EffectRef {
  const parentContext = effectContextStack.length > 0 ? effectContextStack[effectContextStack.length-1] : null
  const childEffects: EffectRef[] = []
  const trigger = () => {
    // Destory any previous effects to avoid subscribing multiple times
    childEffects.forEach(e => e.destroy())
    fn()
  }
  const effectContext: EffectContext = {trigger, onDestroy: [], options, childEffects}
  effectContextStack.push(effectContext)
  fn()
  effectContextStack.pop()
  const effectRef: EffectRef = {
    destroy() {
      effectContext.onDestroy?.forEach(cb => cb())
    }
  }
  if (parentContext != null) {
    parentContext.childEffects.push(effectRef)
  }
  return effectRef
}

export function batchSet(fn: () => void) {
  const context: BatchContext = {
    triggers: new Set()
  }
  batchContextStack.push(context)
  fn()
  batchContextStack.pop()
  context.triggers.forEach(t => t())
}