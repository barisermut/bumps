const {
  extractAttachedFilePathsFromTranscriptText,
} = require("../src/lib/transcriptAttachedFiles");

describe("extractAttachedFilePathsFromTranscriptText", () => {
  it("collects path attributes from attached_files block", () => {
    const raw = `Hello<attached_files>
<file path="src/a.ts" />
<file path="src/b.ts"></file>
</attached_files>tail`;
    expect(extractAttachedFilePathsFromTranscriptText(raw)).toEqual([
      "src/a.ts",
      "src/b.ts",
    ]);
  });

  it("returns empty when no block", () => {
    expect(extractAttachedFilePathsFromTranscriptText("no files")).toEqual([]);
  });
});
