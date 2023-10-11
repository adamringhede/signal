# Signal

A reactive primitive for updating state in an application. 

Signals represent state which can be derived using computations. 
These computations will hold on to the last computed value until signals it depend
on change value. Signals and the reuslt of computations are functions that can be
called to return their current value. 

Effects can be used to subscribe to signals or computations and be triggered 
automatically whenever signals it or any of its upstream computations depend on
change value. 

The syntax is inspired by [Angular Signals](https://angular.io/guide/signals).

## Install

```
npm i @adamringhede/signal
```

## Usage

### Creating signals
Signals are created using the `signal<T>(value: T)` function. This returns a function. 

### Reading signals
The value from a signal can be extrated by invoking the signal function. 

```ts
const amount = signal(5)
amount() // 5
```

### Updating signals
The signal can 

```ts
const amount = signal(5)
amount.set(10)
amount() // 10
```

The signal can also be updated with regards to its current value using the `.update(updateFn: (value) => T)` method.

```ts
const amount = signal(5)
amount.update(value => value + 1)
amount() // 6
```

If the signal contains an object that you just want to update, you can use the `.mutate(mutateFn: (value) => void)` method to change the value. Note that this will not trigger effects to be called. 

```ts
const amount = signal({a: 1})
amount.update(value => value.a += 1)
amount().a // 2
```

### Computations
You can apply computations on one or more signals or even other computations by using the `compute(fn: () => void)` function. The computation will hold on to the most recently computed value.

### Effects
You can trigger any kind of side effect whenever any upstream signal changes value. This is illustrated in the code below. 

```ts
const a = signal(1)
const b = signal(2)
const c = computed(() => a() + b())

let effectResult: number[] = []
const e = effect(() => effectResult.push(c()))

expect(effectResult).toEqual([3])

a.set(3)
b.set(4)
expect(effectResult).toEqual([3,5,7])

e.destroy()
```
Remember to destroy effects when you want it to stop reacting to changes in signals. 