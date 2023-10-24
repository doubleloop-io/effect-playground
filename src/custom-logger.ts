import * as F from "effect/Function"
import * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import * as Config from "effect/Config"
import * as LogLevel from "effect/LogLevel"
import * as Exit from "effect/Exit"
import * as Cause from "effect/Cause"

const customLogger = Logger.make(({ logLevel, message }) => {
    console.log(`[${logLevel.label}] ${message}`)
})

type Deps = { name: string }
const Deps = Context.Tag<Deps>()

const greet = Effect.map(Deps, ({ name }) => `Hello${name}`)

type Suffix = { suffix: string }
const Suffix = Context.Tag<Suffix>()
const SuffixLive = Layer.succeed(Suffix, { suffix: "!" })

type Prefix = { prefix: string }
const Prefix = Context.Tag<Prefix>()
const PrefixLive = Layer.effect(
    Prefix,
    Effect.map(Effect.config(Config.string("PREFIX")), (x) => Prefix.of({ prefix: x })),
)

const DepsLive = Layer.effect(
    Deps,
    F.pipe(
        Effect.logInfo("DepsLive init"),
        Effect.flatMap(() =>
            Effect.all({
                prefix: Effect.map(Prefix, (x) => x.prefix),
                suffix: Effect.map(Suffix, (x) => x.suffix),
                name: Effect.config(Config.string("NAME")),
            }),
        ),
        Effect.map(({ name, prefix, suffix }) => Deps.of({ name: `${prefix}${name}${suffix}` })),
    ),
)

const main = async (): Promise<void> => {
    const result = await F.pipe(
        greet,
        Effect.tap((message) => Effect.logInfo(message)),
        Effect.asUnit,
        Effect.provide(
            F.pipe(
                DepsLive,
                Layer.use(PrefixLive),
                Layer.use(SuffixLive),
                Layer.useMerge(Logger.replace(Logger.defaultLogger, customLogger)),
            ),
        ),
        Logger.withMinimumLogLevel(LogLevel.Debug),
        Effect.runPromiseExit,
    )

    if (Exit.isFailure(result)) {
        console.error(`[APP_ERROR] ${Cause.pretty(result.cause)}`)
        throw new Error("AppError")
    }
}

main().catch(() => {
    process.exit(1)
})
