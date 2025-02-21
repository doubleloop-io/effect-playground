import * as Effect from "effect/Effect"
import * as Config from "effect/Config"
import * as ConfigError from "effect/ConfigError"
import * as ConfigProvider from "effect/ConfigProvider"
import * as ConfigProviderPathPatch from "effect/ConfigProviderPathPatch"
import * as HashMap from "effect/HashMap"
import * as HashSet from "effect/HashSet"
import * as Array from "effect/Array"
import * as F from "effect/Function"
import { describe, expect, test } from "vitest"
import * as Exit from "effect/Exit"

const FlatProvider = (values: { [key in string]: string }, seqDelim: string = ",") => {
    let invocations = 0

    const get = (key: string): Effect.Effect<string, ConfigError.ConfigError> =>
        key in values
            ? Effect.succeed(`${values[key]}@${++invocations}`)
            : Effect.fail(ConfigError.Unsupported([key], "Unknown config"))

    const cannotHaveNestedConfigurations = () => HashSet.empty()

    return ConfigProvider.fromFlat(
        ConfigProvider.makeFlat({
            load: (path, config, split) =>
                get(path[0]).pipe(
                    Effect.map((value) => (split ? value.split(seqDelim) : [value])),
                    Effect.flatMap(Effect.forEach(config.parse)),
                    Effect.mapBoth({
                        onSuccess: (x) => x,
                        onFailure: ConfigError.prefixed([...path]),
                    }),
                ),
            enumerateChildren: (path) =>
                F.pipe(
                    path,
                    Array.match({
                        onEmpty: () => HashSet.make(...Object.keys(values)),
                        onNonEmpty: cannotHaveNestedConfigurations,
                    }),
                    Effect.succeed,
                ),
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

describe("enumerateChildren", () => {
    test("nested config", async () => {
        const configProvider = ConfigProvider.fromJson({
            TEST: { BAR: "BAR VALUE", FOO: "FOO VALUE" },
            TEST2: { BAR: "BAR VALUE 2", FOO: "FOO VALUE 2" },
        })

        const result = await Config.hashMap(Config.string(), "TEST").pipe(
            Effect.withConfigProvider(configProvider),
            Effect.runPromise,
        )

        expect(result).toEqual(
            HashMap.make(["FOO", expect.stringMatching("FOO VALUE")], ["BAR", expect.stringMatching("BAR VALUE")]),
        )
    })

    test("non empty path with non nested field", async () => {
        const configProvider = ConfigProvider.fromJson({ BAR: "BAR VALUE", FOO: "FOO VALUE" })

        const result = await Config.hashMap(Config.string(), "FOO").pipe(
            Effect.withConfigProvider(configProvider),
            Effect.runPromise,
        )

        expect(result).toEqual(HashMap.empty())
    })

    test("empty path - JSON config", async () => {
        const configProvider = ConfigProvider.fromJson({ BAR: "BAR VALUE", FOO: "FOO VALUE" })

        const result = await Config.hashMap(Config.string()).pipe(
            Effect.withConfigProvider(configProvider),
            Effect.runPromise,
        )

        expect(result).toEqual(
            HashMap.make(["FOO", expect.stringMatching("FOO VALUE")], ["BAR", expect.stringMatching("BAR VALUE")]),
        )
    })

    test("empty path", async () => {
        const configProvider = FlatProvider({ BAR: "BAR VALUE", FOO: "FOO VALUE" })
        const result = await Config.hashMap(Config.string()).pipe(
            Effect.withConfigProvider(configProvider),
            Effect.runPromise,
        )

        expect(result).toEqual(
            HashMap.make(["FOO", expect.stringMatching("FOO VALUE")], ["BAR", expect.stringMatching("BAR VALUE")]),
        )
    })
})

test("path in error", async () => {
    const program = Config.number("TEST")
    const result = await program.pipe(
        Effect.withConfigProvider(FlatProvider({ TEST: "not a number" })),
        Effect.runPromiseExit,
    )

    const cause = F.pipe(result, Exit.getOrElse(F.identity))
    expect((cause as any).error.path).toEqual(["TEST"])
})

describe("array", () => {
    test("use split param", async () => {
        const program = Config.array(Config.string(), "TEST")
        const result = await program.pipe(
            Effect.withConfigProvider(FlatProvider({ TEST: "A,B,C" }, ",")),
            Effect.runPromise,
        )

        expect(result).toEqual(["A", "B", "C@1"])
    })
})
