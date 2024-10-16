import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Array from "effect/Array"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Request from "effect/Request"
import * as RequestResolver from "effect/RequestResolver"
import * as Stream from "effect/Stream"

class ProcessItemDeps extends Context.Tag("ProcessItemDeps")<
    ProcessItemDeps,
    {
        saveItem: (item: string) => Effect.Effect<void>
    }
>() {}

const processItem = (item: number) =>
    Effect.gen(function* (_) {
        const { saveItem } = yield* _(ProcessItemDeps)

        const processed = Array.replicate(`batch-${item}`, item)

        yield* _(Effect.forEach(processed, (x) => saveItem(x), { batching: "inherit" }))
    })

const program = Effect.gen(function* (_) {
    yield* _(Effect.logInfo("Processing items..."))
    yield* _(
        Stream.make(1, 2, 3, 4, 5),
        Stream.mapEffect((item) => processItem(item)),
        Stream.runDrain,
    )
    yield* _(Effect.logInfo("Done"))
})

class SaveItem extends Request.TaggedClass("SaveItem")<void, never, { item: string }> {}

const SaveItemResolver = RequestResolver.makeBatched((requests: Array.NonEmptyArray<SaveItem>) =>
    Effect.gen(function* (_) {
        const items = requests.map((x) => x.item).join(", ")
        yield* _(Effect.logInfo(`Saving ${requests.length} items (${items})`))
        yield* _(Effect.forEach(requests, (request) => Request.completeEffect(request, Effect.void)))
    }),
).pipe(RequestResolver.batchN(5))

const ProcessItemDepsLive = Layer.succeed(
    ProcessItemDeps,
    ProcessItemDeps.of({
        saveItem: (item) => Effect.request(new SaveItem({ item }), SaveItemResolver),
    }),
)

const main = pipe(program, Effect.withRequestBatching(true), Effect.provide(ProcessItemDepsLive))

NodeRuntime.runMain(main)
