import { describe, it, expect } from "vitest";
import { parseEnvFile } from "@/lib/env-parser/parse-dotenv";

describe("parseEnvFile", () => {
  it("parses simple KEY=VALUE pairs", () => {
    expect(parseEnvFile("FOO=bar\nBAZ=qux")).toEqual([
      { key: "FOO", value: "bar" },
      { key: "BAZ", value: "qux" },
    ]);
  });

  it("strips double-quoted values", () => {
    expect(parseEnvFile('KEY="hello world"')).toEqual([{ key: "KEY", value: "hello world" }]);
  });

  it("strips single-quoted values", () => {
    expect(parseEnvFile("KEY='hello world'")).toEqual([{ key: "KEY", value: "hello world" }]);
  });

  it("skips comment lines starting with #", () => {
    expect(parseEnvFile("# comment\nFOO=bar")).toEqual([{ key: "FOO", value: "bar" }]);
  });

  it("skips inline comments after value (unquoted)", () => {
    expect(parseEnvFile("FOO=bar # comment")).toEqual([{ key: "FOO", value: "bar" }]);
  });

  it("preserves inline # inside quoted values", () => {
    expect(parseEnvFile('FOO="bar # not a comment"')).toEqual([{ key: "FOO", value: "bar # not a comment" }]);
  });

  it("skips blank lines", () => {
    expect(parseEnvFile("FOO=bar\n\nBAZ=qux")).toEqual([
      { key: "FOO", value: "bar" },
      { key: "BAZ", value: "qux" },
    ]);
  });

  it("handles values with = signs", () => {
    expect(parseEnvFile("FOO=a=b=c")).toEqual([{ key: "FOO", value: "a=b=c" }]);
  });

  it("trims whitespace around keys", () => {
    expect(parseEnvFile("  FOO = bar")).toEqual([{ key: "FOO", value: "bar" }]);
  });

  it("skips lines without = sign", () => {
    expect(parseEnvFile("INVALID\nFOO=bar")).toEqual([{ key: "FOO", value: "bar" }]);
  });

  it("returns empty array for empty input", () => {
    expect(parseEnvFile("")).toEqual([]);
  });
});
