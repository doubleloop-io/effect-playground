import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Request from "effect/Request"
import * as RequestResolver from "effect/RequestResolver"
import * as Stream from "effect/Stream"
import * as Console from "effect/Console"

const saveItem = (item: string) => Effect.request(new SaveItem({ item }), SaveItemResolver)

const processItem = (item: number) =>
    Effect.gen(function* (_) {
        const processed = pipe(
            Array.replicate(`batch-${item}`, item),
            Array.map((x, i) => `${x}-${i + 1}`),
        )

        yield* _(Effect.forEach(processed, (x) => saveItem(x), { batching: "inherit" }))
    })

const program = Effect.gen(function* (_) {
    yield* _(
        Stream.make(1, 2, 3, 4, 5),
        Stream.mapEffect((item) => processItem(item)),
        Stream.runDrain,
    )
})

class SaveItem extends Request.TaggedClass("SaveItem")<void, never, { item: string }> {}

const SaveItemResolver = RequestResolver.makeBatched((requests: Array.NonEmptyArray<SaveItem>) =>
    Effect.gen(function* (_) {
        const items = requests.map((x) => x.item).join(", ")
        yield* _(Console.log(`Saving ${items}`))
        yield* _(Effect.forEach(requests, (request) => Request.completeEffect(request, Effect.void)))
    }),
).pipe(RequestResolver.batchN(5))

const main = pipe(program, Effect.withRequestBatching(true))

NodeRuntime.runMain(main)
