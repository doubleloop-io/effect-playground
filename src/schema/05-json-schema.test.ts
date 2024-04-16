import { expect, test, describe } from "vitest"
import * as S from "@effect/schema/Schema"
import * as JSONSchema from "@effect/schema/JSONSchema"

const Person = S.Struct({
    name: S.String,
    age: S.NumberFromString,
})

test("generate JSON Schema", () => {
    const personJsonSchema = JSONSchema.make(Person)

    const result = JSON.stringify(personJsonSchema)

    expect(result).toEqual(
        '{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","required":["name","age"],"properties":{"name":{"type":"string","description":"a string","title":"string"},"age":{"$ref":"#/$defs/NumberFromString"}},"additionalProperties":false,"$defs":{"NumberFromString":{"type":"number","description":"a number","title":"number"}}}',
    )
})

test("generate JSON Schema from Schema.Encoded", () => {
    const personEncodedJsonSchema = JSONSchema.make(S.encodedSchema(Person))

    const result = JSON.stringify(personEncodedJsonSchema)

    expect(result).toEqual(
        '{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","required":["name","age"],"properties":{"name":{"type":"string","description":"a string","title":"string"},"age":{"type":"string","description":"a string","title":"string"}},"additionalProperties":false}',
    )
})
