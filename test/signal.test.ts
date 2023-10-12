import { expect, test } from 'vitest'
import { signal, computed, effect, Signal, batchSet } from '../src'

test('signal getter', () => {
  const s = signal(5)
  expect(s()).toBe(5)
})

test('computed', () => {
  const a = signal(5)
  const b = signal(3)
  const c = computed(() => a() + b())
  expect(c()).toBe(8)

  b.set(1)
  expect(c()).toBe(6)
})

test('effect', () => {
  const a = signal(1)
  const b = signal(2)
  const c = computed(() => a() + b())
  
  // When any signal changes, the effect should be updated
  let effectResult: number[] = []
  const e = effect(() => effectResult.push(c()))

  expect(effectResult).toEqual([3])

  // Chaning either signal should update the side effect
  a.set(3)
  b.set(4)
  expect(effectResult).toEqual([3,5,7])

  // Destroying should stop the effect from being invoked
  e.destroy()
  a.set(10)
  expect(effectResult).toEqual([3,5,7])
})

type ExtractSignalType<Type> = Type extends Signal<infer X> ? X : never

test('mutate', () => {
  const a = signal({foo: 1})
  const effectResult: ExtractSignalType<typeof a>[] = []
  const e = effect(() => effectResult.push(a()))

  expect(effectResult).toEqual([{foo: 1}])

  a.mutate(value => value.foo = 2)

  // Mutating changes the first value but does not trigger effects again
  expect(effectResult).toEqual([{foo: 2}])

  e.destroy()
})


test('update', () => {
  const a = signal(1)
  expect(a()).toEqual(1)
  a.update(value => value + 1)
  expect(a()).toEqual(2)
})


test('batch', () => {
  const a = signal(1)
  const b = signal(1)
  
  let effectResult: number[] = []
  const e = effect(() => effectResult.push(a() + b()))

  expect(effectResult).toEqual([2])

  // Batch signal updates so effect only trigger once
  batchSet(() => {
    a.set(2)
    b.set(3)  
  })
  
  expect(effectResult).toEqual([2, 5])

})


test('multiple effects on a computed value has te same result', () => {
  const s = signal(5)
  const c = computed(() => s() + 3)
  const result: number[] = []
  const result2: number[] = []
  const result3: number[] = []
  const e = effect(() => result.push(c()))
  const e2 = effect(() => result2.push(c()))
  const e3 = effect(() => result3.push(c()))
  s.set(9)
  s.set(10)
  expect(result).toEqual(result2)
  expect(result2).toEqual(result3)
})