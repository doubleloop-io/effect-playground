import * as Logger from "effect/Logger"
import * as Match from "effect/Match"
import * as F from "effect/Function"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Effect from "effect/Effect"
import * as HashMap from "effect/HashMap"
import * as O from "effect/Option"

type CustomMessage = { message: string; __error?: Error } & Record<string, unknown>

const formatAnnotations = (annotations: HashMap.HashMap<string, unknown>) => {
    const ret: Record<string, string> = {}
    for (const [key, value] of annotations) ret[key] = serializeUnknown(value)
    return ret
}
const serializeUnknown = (u: unknown): string => {
    try {
        return typeof u === "object" ? JSON.stringify(u) : String(u)
    } catch (_) {
        return String(u)
    }
}

const unknownToCustomMessage = Logger.mapInputOptions((options) => {
    const __error = F.pipe(
        HashMap.get(options.annotations, "__error"),
        O.flatMap((x) => (x instanceof Error ? O.some(x) : O.none())),
        O.getOrUndefined,
    )
    const params = HashMap.remove(options.annotations, "__error")

    return {
        ...options,
        message: {
            message: `${options.message}`,
            ...(__error ? { __error } : {}),
            ...formatAnnotations(params),
        },
    }
})

const ConsoleLogger = Logger.make<CustomMessage, void>(({ logLevel, message }) => {
    F.pipe(
        Match.value(logLevel),
        Match.tag("Debug", "Trace", () => console.debug(message)),
        Match.tag("Info", () => console.debug(message)),
        Match.tag("Warning", () => console.debug(message)),
        Match.tag("Error", "Fatal", () => console.error(message)),
        Match.tag("All", "None", F.constVoid),
        Match.exhaustive,
    )
}).pipe(unknownToCustomMessage)

const externalServiceLogs: unknown[] = []
const externalService = {
    debug: (message: string, ...args: any[]) => {
        externalServiceLogs.push({ logLevel: "debug", message, args })
    },
    info: (message: string, ...args: any[]) => {
        externalServiceLogs.push({ logLevel: "info", message, args })
    },
    warn: (message: string, ...args: any[]) => {
        externalServiceLogs.push({ logLevel: "warn", message, args })
    },
    error: (message: string, error?: Error, ...args: any[]) => {
        externalServiceLogs.push({ logLevel: "error", message, args, error })
    },
}

const ExternalServiceLogger = Logger.make<CustomMessage, void>((options) => {
    const { __error, message, ...params } = options.message

    F.pipe(
        Match.value(options.logLevel),
        Match.tag("Debug", "Trace", () => externalService.debug(message, params)),
        Match.tag("Info", () => externalService.info(message, params)),
        Match.tag("Warning", () => externalService.warn(message, params)),
        Match.tag("Error", "Fatal", () => externalService.error(message, __error, params)),
        Match.tag("All", "None", F.constVoid),
        Match.exhaustive,
    )
}).pipe(unknownToCustomMessage)

const program = Effect.gen(function* () {
    yield* Effect.logDebug("Start program")
    yield* Effect.logInfo("Processing tasks").pipe(Effect.annotateLogs({ id: "abc2025", code: 12345 }))

    yield* Effect.logWarning("Some warn message with params").pipe(Effect.annotateLogs({ a: "a", b: true }))
    yield* Effect.logError("Some error message").pipe(
        Effect.annotateLogs({ __error: new Error("Any error message!!"), code: 6788, type: "TaskFailed" }),
    )

    yield* Effect.logInfo("Program finished!")

    console.log("\nExternal service logs dump:")
    console.dir(externalServiceLogs, { depth: 10 })
})

const AppLogger = Logger.zip(ConsoleLogger, ExternalServiceLogger)

const main = F.pipe(program, Effect.provide(Logger.replace(Logger.defaultLogger, AppLogger)))

NodeRuntime.runMain(main, { disableErrorReporting: true, disablePrettyLogger: true })
