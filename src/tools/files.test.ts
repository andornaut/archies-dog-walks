import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { writeOrCheck } from "./files";

let root: string;
const argv = process.argv;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "files-test-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
});

afterEach(async () => {
  process.argv = argv;
  vi.restoreAllMocks();
  await rm(root, { force: true, recursive: true });
});

function run(...args: string[]) {
  process.argv = ["node", "cli.ts", ...args];
  return writeOrCheck("npm run gen", "out.txt", new Map([["out.txt", "text\n"]]));
}

describe("writeOrCheck", () => {
  it("writes the files with no arguments and checks them with --check", async () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    expect(await run("--check")).toBe(1);
    expect(await run()).toBe(0);
    expect(await readFile(join(root, "out.txt"), "utf8")).toBe("text\n");
    expect(await run("--check")).toBe(0);
  });

  it.each([["--chek"], ["extra"], ["--check", "extra"]])(
    "prints the usage line and fails for %s, writing nothing",
    async (...args: string[]) => {
      const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      expect(await run(...args)).toBe(1);
      expect(stderr).toHaveBeenCalledWith("npm run gen [-- --check]\n");
      await expect(readFile(join(root, "out.txt"))).rejects.toMatchObject({ code: "ENOENT" });
    },
  );
});
