const cp = require("child_process");
const {
  getMentorState,
  checkAgentInstalled,
  checkAgentLoggedIn,
} = require("../src/lib/mentorState");

describe("mentorState", () => {
  let spawnSyncSpy;

  beforeEach(() => {
    spawnSyncSpy = vi.spyOn(cp, "spawnSync");
  });

  afterEach(() => {
    spawnSyncSpy.mockRestore();
  });

  it("getMentorState: agent not on PATH", () => {
    spawnSyncSpy.mockImplementation((cmd, args) => {
      if (cmd === "agent" && args[0] === "--version") {
        return {
          status: null,
          error: Object.assign(new Error("spawnSync ENOENT"), {
            code: "ENOENT",
          }),
        };
      }
      if (cmd === "agent" && args[0] === "whoami") {
        return {
          status: null,
          error: Object.assign(new Error("spawnSync ENOENT"), {
            code: "ENOENT",
          }),
        };
      }
      throw new Error(`unexpected spawnSync: ${cmd} ${args.join(" ")}`);
    });

    expect(getMentorState()).toEqual({
      installed: false,
      loggedIn: false,
      email: "",
      ready: false,
    });
  });

  it("getMentorState: installed but not logged in", () => {
    spawnSyncSpy.mockImplementation((cmd, args) => {
      if (cmd === "agent" && args[0] === "--version") {
        return { status: 0, error: undefined };
      }
      if (cmd === "agent" && args[0] === "whoami") {
        return {
          status: 0,
          stdout: "Not logged in\n",
          error: undefined,
        };
      }
      throw new Error(`unexpected spawnSync: ${cmd} ${args.join(" ")}`);
    });

    expect(getMentorState()).toEqual({
      installed: true,
      loggedIn: false,
      email: "",
      ready: false,
    });
  });

  it("getMentorState: installed and logged in with email", () => {
    spawnSyncSpy.mockImplementation((cmd, args) => {
      if (cmd === "agent" && args[0] === "--version") {
        return { status: 0, error: undefined };
      }
      if (cmd === "agent" && args[0] === "whoami") {
        return {
          status: 0,
          stdout: "Logged in as user@example.com\n",
          error: undefined,
        };
      }
      throw new Error(`unexpected spawnSync: ${cmd} ${args.join(" ")}`);
    });

    expect(getMentorState()).toEqual({
      installed: true,
      loggedIn: true,
      email: "user@example.com",
      ready: true,
    });
  });

  it("getMentorState: whoami non-zero exit is not logged in", () => {
    spawnSyncSpy.mockImplementation((cmd, args) => {
      if (cmd === "agent" && args[0] === "--version") {
        return { status: 0, error: undefined };
      }
      if (cmd === "agent" && args[0] === "whoami") {
        return {
          status: 1,
          stdout: "",
          error: undefined,
        };
      }
      throw new Error(`unexpected spawnSync: ${cmd} ${args.join(" ")}`);
    });

    expect(getMentorState()).toEqual({
      installed: true,
      loggedIn: false,
      email: "",
      ready: false,
    });
  });

  it("getMentorState: whoami timeout does not crash", () => {
    spawnSyncSpy.mockImplementation((cmd, args) => {
      if (cmd === "agent" && args[0] === "--version") {
        return { status: 0, error: undefined };
      }
      if (cmd === "agent" && args[0] === "whoami") {
        return {
          status: null,
          stdout: "",
          error: Object.assign(new Error("ETIMEDOUT"), { code: "ETIMEDOUT" }),
        };
      }
      throw new Error(`unexpected spawnSync: ${cmd} ${args.join(" ")}`);
    });

    expect(getMentorState()).toEqual({
      installed: true,
      loggedIn: false,
      email: "",
      ready: false,
    });
  });

  it("checkAgentInstalled uses spawnSync with expected args", () => {
    spawnSyncSpy.mockReturnValue({ status: 0 });
    expect(checkAgentInstalled()).toBe(true);
    expect(spawnSyncSpy).toHaveBeenCalledWith("agent", ["--version"], {
      stdio: "ignore",
      timeout: 3000,
    });
  });

  it("checkAgentLoggedIn parses email from stdout", () => {
    spawnSyncSpy.mockReturnValue({
      status: 0,
      stdout: "Account: user@example.com\n",
    });
    expect(checkAgentLoggedIn()).toEqual({
      loggedIn: true,
      email: "user@example.com",
    });
  });
});
