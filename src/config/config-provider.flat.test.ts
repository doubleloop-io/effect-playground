import * as Effect from "effect/Effect"
import * as Config from "effect/Config"
import * as ConfigError from "effect/ConfigError"
import * as ConfigProvider from "effect/ConfigProvider"
import * as ConfigProviderPathPatch from "effect/ConfigProviderPathPatch"
import { expect, test } from "vitest"

const CustomFlatProvider = (...values: string[]) => {
    let index = 0

    return ConfigProvider.fromFlat(
        ConfigProvider.makeFlat({
            load: (path, config, split) =>
                Effect.gen(function* () {
                    if (!(path.length === 1 && path[0] === "TEST"))
                        return yield* Effect.fail(ConfigError.Unsupported([...path], "Unknown config"))
                    return [yield* config.parse(values[index++])]
                }),
            enumerateChildren: (path) => Effect.fail(ConfigError.Unsupported([...path], "TBI")),
            patch: ConfigProviderPathPatch.empty,
        }),
    )
}

test("resolve config", async () => {
    const program = Config.string("TEST")
    const result = await program.pipe(Effect.withConfigProvider(CustomFlatProvider("test value")), Effect.runPromise)

    expect(result).toEqual("test value")
})

test("resolve config does not cache", async () => {
    const program = Effect.gen(function* () {
        const test = yield* Config.string("TEST")
        const test2 = yield* Config.string("TEST")

        return [test, test2] as const
    })

    const result = await program.pipe(
        Effect.withConfigProvider(CustomFlatProvider("test value 1", "test value 2")),
        Effect.runPromise,
    )

    expect(result).toEqual(["test value 1", "test value 2"])
})
