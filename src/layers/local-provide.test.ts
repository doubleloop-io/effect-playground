import { expect, test } from "vitest"
import * as Layer from "effect/Layer"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Random from "effect/Random"

test("same Tag, different layers locally provided - no shadowing", () => {
    const result = Effect.gen(function* () {
        const { foo } = yield* FooDependency
        const { bar } = yield* BarDependency
        return { foo: yield* foo, bar: yield* bar }
    }).pipe(
        Effect.provide(FooLive(Layer.succeed(BaseDependency, { value: "base for foo" }))),
        Effect.provide(BarLive(Layer.succeed(BaseDependency, { value: "base for bar" }))),
        Effect.runSync,
    )

    expect(result).toEqual({ foo: "base for foo", bar: "base for bar" })
})

test("same Tag, same layer locally provided - multiple creation", () => {
    const result = Effect.gen(function* () {
        const { foo } = yield* FooDependency
        const { bar } = yield* BarDependency
        return { foo: yield* foo, bar: yield* bar }
    }).pipe(Effect.provide(FooLive(BaseDependencyLive)), Effect.provide(BarLive(BaseDependencyLive)), Effect.runSync)

    expect(result.foo).not.toEqual(result.bar)
})

test("same Tag, layers locally and globally provided", () => {
    const result = Effect.gen(function* () {
        const { foo } = yield* FooDependency
        const { bar } = yield* BarDependency
        return { foo: yield* foo, bar: yield* bar }
    }).pipe(
        Effect.provide(FooLive(BaseDependencyLive)),
        Effect.provide(BarLive(BaseDependencyLive)),
        Effect.provide(Layer.succeed(BaseDependency, { value: "global" })),
        Effect.runSync,
    )

    expect(result.foo).not.toEqual("global")
    expect(result.bar).not.toEqual("global")
})

interface BaseDependency {
    value: string
}
const BaseDependency = Context.GenericTag<BaseDependency>("BaseDependency")

interface FooDependency {
    foo: Effect.Effect<string>
}
const FooDependency = Context.GenericTag<FooDependency>("FooDependency")
const FooLive = (baseLayer: Layer.Layer<BaseDependency>) =>
    Layer.effect(
        FooDependency,
        Effect.gen(function* () {
            const context = yield* Effect.context<BaseDependency>()
            return {
                foo: Effect.gen(function* () {
                    const base = yield* BaseDependency
                    return base.value
                }).pipe(Effect.provide(context)),
            }
        }).pipe(Effect.provide(baseLayer)),
    )

interface BarDependency {
    bar: Effect.Effect<string>
}
const BarDependency = Context.GenericTag<BarDependency>("BarDependency")
const BarLive = (baseLayer: Layer.Layer<BaseDependency>) =>
    Layer.effect(
        BarDependency,
        Effect.gen(function* () {
            const context = yield* Effect.context<BaseDependency>()
            return {
                bar: Effect.gen(function* () {
                    const base = yield* BaseDependency
                    return base.value
                }).pipe(Effect.provide(context)),
            }
        }).pipe(Effect.provide(baseLayer)),
    )

const BaseDependencyLive = Layer.effect(
    BaseDependency,
    Effect.gen(function* () {
        const rand = yield* Random.next
        return { value: `base ${rand}` }
    }),
)
