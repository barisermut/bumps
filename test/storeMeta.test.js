const {
  readStoreMetaValue,
  decodeStoreMetaRow,
} = require("../src/lib/storeMeta");

describe("readStoreMetaValue", () => {
  it("parses plain JSON string", () => {
    const obj = { latestRootBlobId: "abc", name: "Hi" };
    const out = readStoreMetaValue(JSON.stringify(obj));
    expect(out).toEqual(obj);
  });

  it("parses JSON from UTF-8 buffer", () => {
    const obj = { foo: 1 };
    const out = readStoreMetaValue(Buffer.from(JSON.stringify(obj), "utf8"));
    expect(out).toEqual(obj);
  });

  it("parses hex-encoded JSON string", () => {
    const json = '{"latestRootBlobId":"deadbeef"}';
    let hex = "";
    for (let i = 0; i < json.length; i++) {
      hex += json.charCodeAt(i).toString(16).padStart(2, "0");
    }
    const out = readStoreMetaValue(hex);
    expect(out).toEqual({ latestRootBlobId: "deadbeef" });
  });

  it("returns null for garbage", () => {
    expect(readStoreMetaValue("not-json")).toBeNull();
    expect(readStoreMetaValue(null)).toBeNull();
  });
});

describe("decodeStoreMetaRow", () => {
  it("reads row.value", () => {
    expect(decodeStoreMetaRow({ value: '{"a":1}' })).toEqual({ a: 1 });
    expect(decodeStoreMetaRow(null)).toBeNull();
  });
});
