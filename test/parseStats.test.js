const fs = require("fs");
const os = require("os");
const path = require("path");
const Database = require("better-sqlite3");
const {
  createParseStats,
  bumpParseStat,
  PARSE_STATS_KEYS,
} = require("../src/lib/parseStats");

describe("parseStats", () => {
  it("createParseStats initializes all known keys to 0", () => {
    const s = createParseStats();
    expect(Object.keys(s).sort()).toEqual([...PARSE_STATS_KEYS].sort());
    for (const k of PARSE_STATS_KEYS) {
      expect(s[k]).toBe(0);
    }
  });

  it("bumpParseStat increments only defined keys", () => {
    const s = createParseStats();
    bumpParseStat(s, "bubbleRowsJsonSkipped");
    bumpParseStat(s, "bubbleRowsJsonSkipped");
    expect(s.bubbleRowsJsonSkipped).toBe(2);
    bumpParseStat(s, "composerDataRowsJsonSkipped");
    expect(s.composerDataRowsJsonSkipped).toBe(1);
  });

  it("bumpParseStat ignores unknown keys and null stats", () => {
    const s = createParseStats();
    bumpParseStat(s, "notARealKey");
    expect(s.notARealKey).toBeUndefined();
    bumpParseStat(null, "bubbleRowsJsonSkipped");
    bumpParseStat(undefined, "bubbleRowsJsonSkipped");
    expect(s.bubbleRowsJsonSkipped).toBe(0);
  });
});

describe("parse() parseStats (fixture)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete require.cache[require.resolve("../src/parser.js")];
  });

  it("increments workspaceJsonInvalid for bad workspace.json under mocked homedir", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bumps-parse-"));
    const base = path.join(tmp, "Library/Application Support/Cursor/User");
    fs.mkdirSync(path.join(base, "globalStorage"), { recursive: true });
    fs.mkdirSync(path.join(base, "workspaceStorage", "ws1"), { recursive: true });
    fs.writeFileSync(
      path.join(base, "workspaceStorage", "ws1", "workspace.json"),
      "not-json",
      "utf8"
    );

    const dbPath = path.join(base, "globalStorage", "state.vscdb");
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value BLOB);
      INSERT INTO ItemTable VALUES ('composer.composerHeaders', '{"allComposers":[]}');
    `);
    db.close();

    vi.spyOn(os, "homedir").mockReturnValue(tmp);
    const { parse } = require("../src/parser.js");

    const result = parse();
    expect(result.parseStats).toBeDefined();
    expect(result.parseStats.workspaceJsonInvalid).toBe(1);
    expect(result.parserMeta).toBeDefined();
    expect(result.parserMeta.sourceSummary.workspaceHeaders).toBe(0);
    expect(result.totalConversations).toBe(0);
  });

  it("backfills project from message text when workspace metadata is missing", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bumps-parse-"));
    const base = path.join(tmp, "Library/Application Support/Cursor/User");
    fs.mkdirSync(path.join(base, "globalStorage"), { recursive: true });

    const dbPath = path.join(base, "globalStorage", "state.vscdb");
    const db = new Database(dbPath);
    const projectDir = path.join(tmp, "demo-project");
    fs.mkdirSync(projectDir, { recursive: true });
    const msg = JSON.stringify({
      bubbleId: "b1",
      type: 1,
      text: `Please inspect ${path.join(projectDir, "src/app.js")}`,
      createdAt: "2026-04-11T00:00:00.000Z",
    });
    db.exec(`
      CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value BLOB);
      INSERT INTO ItemTable VALUES ('composer.composerHeaders', '${JSON.stringify({
        allComposers: [
          {
            composerId: "c1",
            name: "test",
            createdAt: Date.parse("2026-04-11T00:00:00.000Z"),
            lastUpdatedAt: Date.parse("2026-04-11T00:00:00.000Z"),
            unifiedMode: "chat",
          },
        ],
      }).replace(/'/g, "''")}');
      INSERT INTO cursorDiskKV VALUES ('bubbleId:c1:b1', '${msg.replace(/'/g, "''")}');
    `);
    db.close();

    vi.spyOn(os, "homedir").mockReturnValue(tmp);
    const { parse } = require("../src/parser.js");

    const result = parse();
    expect(result.totalConversations).toBe(1);
    expect(result.conversations[0].project).toBe("demo-project");
    expect(result.conversations[0].workspacePath).toBe(projectDir);
  });
});
