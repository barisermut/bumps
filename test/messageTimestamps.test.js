const {
  assignSyntheticMessageTimestamps,
} = require("../src/lib/messageTimestamps");

describe("assignSyntheticMessageTimestamps", () => {
  it("fills null createdAt monotonically from anchor", () => {
    const anchor = new Date("2020-01-01T00:00:00.000Z").getTime();
    const messages = [{ createdAt: null }, { createdAt: null }];
    assignSyntheticMessageTimestamps(messages, anchor);
    expect(messages[0].createdAt).toBe("2020-01-01T00:00:00.000Z");
    expect(messages[1].createdAt).toBe("2020-01-01T00:00:00.001Z");
  });

  it("advances after existing timestamps by 1ms", () => {
    const messages = [
      { createdAt: "2020-01-01T00:00:05.000Z" },
      { createdAt: null },
    ];
    assignSyntheticMessageTimestamps(messages, 0);
    expect(new Date(messages[1].createdAt).getTime()).toBe(
      new Date("2020-01-01T00:00:05.000Z").getTime() + 1
    );
  });
});
