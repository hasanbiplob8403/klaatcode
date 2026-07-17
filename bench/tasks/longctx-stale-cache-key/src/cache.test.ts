import { test, expect, beforeEach } from "bun:test";
import { cacheClear } from "./cache/store";
import { getProfile } from "./api";
import { dbUserReads } from "./db/users";

beforeEach(() => cacheClear());

test("two users in the same org get their own profiles", async () => {
  const a = await getProfile("u1");
  const b = await getProfile("u2");
  expect(a.name).toBe("Ada");
  expect(a.userId).toBe("u1");
  expect(b.name).toBe("Bram");
  expect(b.userId).toBe("u2");
});

test("profile cache serves repeat reads for the same user", async () => {
  await getProfile("u1");
  const before = dbUserReads();
  const again = await getProfile("u1");
  expect(again.name).toBe("Ada");
  // Only the user lookup itself may hit the DB; profile assembly must be cached.
  expect(dbUserReads()).toBe(before + 1);
});

test("cross-org users are isolated too", async () => {
  const a = await getProfile("u1");
  const c = await getProfile("u3");
  expect(a.orgName).toBe("Initrode");
  expect(c.orgName).toBe("Globex");
});
