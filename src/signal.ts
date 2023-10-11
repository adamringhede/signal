export type Signal<T> = () => T

export type WritableSignal<T> = {
  set(value: T): void
  update(updateFn: (value: T) => T): void
  mutate(mutateFn: (value: T) => void): void
} & Signal<T>

type EffectContext = {
  trigger: () => void
  onDestroy: (() => void)[] 
  options?: EffectOptions
}

type ComputedContext = {
  cacheInvalidation: () => void
}

const computedContextStack: ComputedContext[] = []
let effectContext: EffectContext|undefined

export function signal<T>(value: T): WritableSignal<T> {
  let current = value
  const triggers: (()=>void)[] = []
  const cacheInvalidators: (()=>void)[] = []
  const getter = function () {
    if (effectContext != null) {
      const trigger = effectContext.trigger
      triggers.push(trigger)
      effectContext.onDestroy.push(() => triggers.splice(triggers.indexOf(trigger), 1))
    }
      
    if (computedContextStack.length > 0) 
      cacheInvalidators.push(...computedContextStack.map(ctx => ctx.cacheInvalidation))
    return current 
  }
  const set = (updated: T) => {
    if (effectContext != null && effectContext.options?.allowSignalWrites !== true) {
      throw "Can't update a signal from an effect"
    }
    if (updated === current) {
      return
    }
    cacheInvalidators.forEach((fn) => fn())
    current = updated
    triggers.forEach((fn) => fn())
  }
  const update = (updateFn: (value: T) => T) => {
    set(updateFn(current))
  }
  const mutate = (mutateFn: (value: T) => void) => {
    mutateFn(current)
    set(current)
  }
  return Object.assign(getter, { set, update, mutate })
}

export function computed<R>(fn: () => R): Signal<R> {
  let hasCache = false
  let cached: R|undefined
  const context = {
    cacheInvalidation: () => {
      hasCache = false
    }
  }
  return () => {
    if (hasCache) {
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
  effectContext = {trigger: fn, onDestroy: [], options}
  fn()
  const onDestroy = effectContext.onDestroy
  effectContext = undefined
  return {
    destroy() {
      onDestroy?.forEach(cb => cb())
    }
  }
}
