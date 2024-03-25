import { expect, test, describe } from "vitest"
import * as S from "@effect/schema/Schema"
import * as AST from "@effect/schema/AST"
import * as Effect from "effect/Effect"
import * as EV from "@effect/vitest"
import * as E from "effect/Either"

const Person = S.struct({
    name: S.string,
    age: S.number,
})

test("decode either", () => {
    const decode = S.decodeUnknownEither(Person)

    const result = decode({ name: "John", age: 42 })

    expect(result).toEqual(E.right({ name: "John", age: 42 }))
})

test("decode either fails", () => {
    const decode = S.decodeUnknownEither(Person)

    const result = decode({ name: 42, age: "John" })

    expect(E.isLeft(result)).toBeTruthy()
})

EV.effect("excess properties are removed", () =>
    Effect.gen(function* (_) {
        const decode = S.decodeUnknown(Person)
        const encode = S.encode(Person)

        const result = yield* _(decode({ name: "John", age: 42, surname: "Doe" }))

        expect(result).toEqual({ name: "John", age: 42 })

        const encoded = yield* _(encode(result))
        expect(encoded).toEqual({ name: "John", age: 42 })
    }),
)

EV.effect("excess properties are preserved", () =>
    Effect.gen(function* (_) {
        const options: AST.ParseOptions = { onExcessProperty: "preserve" }
        const decode = S.decodeUnknown(Person, options)
        const encode = S.encode(Person, options)

        const input = { name: "John", age: 42, surname: "Doe" }

        const result = yield* _(decode(input))
        expect(result).toEqual({ name: "John", age: 42, surname: "Doe" })

        const encoded = yield* _(encode(result))
        expect(encoded).toEqual(input)
    }),
)

describe("encode", () => {
    const Age = S.NumberFromString

    const Person = S.struct({
        name: S.NonEmpty,
        age: Age,
    })

    test("encode errors", () => {
        const encode = S.encodeSync(Person)

        expect(() => encode({ name: "", age: 42 })).toThrowError(/Expected NonEmpty/)
    })
})
