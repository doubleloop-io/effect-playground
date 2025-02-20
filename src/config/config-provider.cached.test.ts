import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Config from "effect/Config"
import * as ConfigError from "effect/ConfigError"
import * as ConfigProvider from "effect/ConfigProvider"
import * as ConfigProviderPathPatch from "effect/ConfigProviderPathPatch"
import * as Cache from "effect/Cache"
import { expect, test } from "vitest"

const CachedFlatProvider = (...values: string[]) => {
    let index = 0

    return Effect.gen(function* () {
        const cache = yield* Cache.make({
            lookup: (key: string) =>
                key === "TEST"
                    ? Effect.succeed(values[index++])
                    : Effect.fail(ConfigError.Unsupported([key], "Unknown config")),
            timeToLive: "5 minutes",
            capacity: 100,
        })

        return Layer.setConfigProvider(
            ConfigProvider.fromFlat(
                ConfigProvider.makeFlat({
                    load: (path, config, split) =>
                        cache.get(path[0]).pipe(
                            Effect.flatMap(config.parse),
                            Effect.map((x) => [x]),
                        ),
                    enumerateChildren: (path) => Effect.fail(ConfigError.Unsupported([...path], "TBI")),
                    patch: ConfigProviderPathPatch.empty,
                }),
            ),
        )
    }).pipe(Layer.unwrapEffect)
}

test("resolve config is cached", async () => {
    const program = Effect.gen(function* () {
        const test = yield* Config.string("TEST")
        const test2 = yield* Config.string("TEST")

        return [test, test2] as const
    })

    const result = await program.pipe(
        Effect.provide(CachedFlatProvider("test value 1", "test value 2")),
        Effect.runPromise,
    )

    expect(result).toEqual(["test value 1", "test value 1"])
})
