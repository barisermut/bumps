const path = require("path");
const os = require("os");
const { pathToFileURL } = require("url");
const {
  inferProjectFromFileSelections,
  inferProjectFromMessageText,
  fileSelectionKeyToAbsolutePath,
} = require("../src/lib/cursorPaths");

describe("fileSelectionKeyToAbsolutePath", () => {
  it("resolves file URL to path", () => {
    const p = fileSelectionKeyToAbsolutePath("file:///tmp/myproject/foo.ts");
    expect(p).toBeTruthy();
    expect(path.basename(p)).toBe("foo.ts");
  });
});

describe("inferProjectFromFileSelections", () => {
  it("returns project directory from file URL under home", () => {
    const home = os.homedir();
    const abs = path.join(home, "myproject", "src", "a.ts");
    const key = pathToFileURL(abs).href;
    const r = inferProjectFromFileSelections({ [key]: {} });
    expect(r).not.toBeNull();
    expect(r.project).toBe("myproject");
    expect(r.workspacePath).toBe(path.join(home, "myproject"));
  });

  it("skips Desktop", () => {
    const home = os.homedir();
    const desktopFile = path.join(home, "Desktop", "notes.txt");
    const appFile = path.join(home, "app", "main.ts");
    const r = inferProjectFromFileSelections({
      [pathToFileURL(desktopFile).href]: {},
      [pathToFileURL(appFile).href]: {},
    });
    expect(r).not.toBeNull();
    expect(r.project).toBe("app");
  });

  it("skips generic container folders like projects", () => {
    const home = os.homedir();
    const abs = path.join(home, "projects", "bumps", "src", "a.ts");
    const key = pathToFileURL(abs).href;
    const r = inferProjectFromFileSelections({ [key]: {} });
    expect(r).not.toBeNull();
    expect(r.project).toBe("bumps");
    expect(r.workspacePath).toBe(path.join(home, "projects", "bumps"));
  });

  it("ignores hidden Cursor internals as projects", () => {
    const home = os.homedir();
    const abs = path.join(home, ".cursor", "agents", "teacher.md");
    const key = pathToFileURL(abs).href;
    const r = inferProjectFromFileSelections({ [key]: {} });
    expect(r).toBeNull();
  });
});

describe("inferProjectFromMessageText", () => {
  it("finds project path under home", () => {
    const home = require("os").homedir();
    const r = inferProjectFromMessageText(
      `see ${path.join(home, "myrepo", "src", "x.ts")} please`
    );
    expect(r.project).toBe("myrepo");
    expect(r.workspacePath).toBe(path.join(home, "myrepo"));
  });

  it("skips generic container folders in message text", () => {
    const home = require("os").homedir();
    const r = inferProjectFromMessageText(
      `see ${path.join(home, "projects", "bumps", "src", "x.ts")} please`
    );
    expect(r.project).toBe("bumps");
    expect(r.workspacePath).toBe(path.join(home, "projects", "bumps"));
  });

  it("stops at the real path instead of consuming the rest of the sentence", () => {
    const home = require("os").homedir();
    const r = inferProjectFromMessageText(
      `review ${path.join(home, "projects", "bumps")}. Focus only on packaging/docs issues`
    );
    expect(r.project).toBe("bumps");
    expect(r.workspacePath).toBe(path.join(home, "projects", "bumps"));
  });

  it("ignores internal Cursor agent paths in message text", () => {
    const home = require("os").homedir();
    const r = inferProjectFromMessageText(
      `read ${path.join(home, ".cursor", "agents", "teacher.md")}`
    );
    expect(r).toEqual({ project: null, workspacePath: null });
  });

  it("ignores Downloads paths instead of promoting download folder names to projects", () => {
    const home = require("os").homedir();
    const r = inferProjectFromMessageText(
      `see ${path.join(home, "Downloads", "x-logo", "file.png")}`
    );
    expect(r).toEqual({ project: null, workspacePath: null });
  });
});
