import * as Effect from "effect/Effect"
import * as Config from "effect/Config"
import * as ConfigError from "effect/ConfigError"
import * as ConfigProvider from "effect/ConfigProvider"
import * as ConfigProviderPathPatch from "effect/ConfigProviderPathPatch"
import { expect, test } from "vitest"

const FlatProvider = (values: { [key in string]: string }) => {
    let invocations = 0

    const get = (key: string) =>
        key in values
            ? Effect.succeed(`${values[key]}@${++invocations}`)
            : Effect.fail(ConfigError.Unsupported([key], "Unknown config"))
    return ConfigProvider.fromFlat(
        ConfigProvider.makeFlat({
            load: (path, config, split) =>
                get(path[0]).pipe(
                    Effect.flatMap(config.parse),
                    Effect.map((x) => [x]),
                ),
            enumerateChildren: (path) => Effect.fail(ConfigError.Unsupported([...path], "TBI")),
            patch: ConfigProviderPathPatch.empty,
        }),
    )
}

test("resolve config", async () => {
    const program = Config.string("TEST")
    const result = await program.pipe(
        Effect.withConfigProvider(FlatProvider({ TEST: "test value" })),
        Effect.runPromise,
    )

    expect(result).toEqual("test value@1")
})

test("resolve config does not cache", async () => {
    const program = Effect.gen(function* () {
        const test = yield* Config.string("TEST")
        const test2 = yield* Config.string("TEST")

        return [test, test2] as const
    })

    const result = await program.pipe(
        Effect.withConfigProvider(FlatProvider({ TEST: "test value" })),
        Effect.runPromise,
    )

    expect(result).toEqual(["test value@1", "test value@2"])
})
