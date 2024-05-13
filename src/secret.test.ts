import { expect, test } from "vitest"
import * as Secret from "effect/Secret"
import * as Schema from "@effect/schema/Schema"

const User = Schema.Struct({
    Id: Schema.String,
    Token: Schema.Secret,
})

const encodeUser = Schema.encodeSync(User)
const decodeUser = Schema.decodeUnknownSync(User)

test("secret to string", () => {
    const user = User.make({
        Id: "123",
        Token: Secret.fromString("my-secret"),
    })

    expect(user.Token.toString()).toStrictEqual("Secret(<redacted>)")
})

test("decode secret", () => {
    const user = decodeUser({
        Id: "123",
        Token: "my-secret",
    })

    expect(user).toStrictEqual(
        User.make({
            Id: "123",
            Token: Secret.fromString("my-secret"),
        }),
    )
})

test("encode secret", () => {
    const user = User.make({
        Id: "123",
        Token: Secret.fromString("my-secret"),
    })

    expect(encodeUser(user)).toStrictEqual({
        Id: "123",
        Token: "my-secret",
    })
})
