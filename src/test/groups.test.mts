import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calls, loadService, socketEvent } from "./helpers.mts";

describe("groups", () => {
  it("adds users to a group, in Enonic XP as well", async () => {
    const { service, websocket } = await loadService();

    service.addUserToGroup("global", "s1");
    service.addUserToGroup("global", "s2");

    assert.deepEqual(service.getGroupUsers("global"), ["s1", "s2"]);
    assert.deepEqual(calls(websocket.addToGroup), [
      ["global", "s1"],
      ["global", "s2"],
    ]);
  });

  it("does not list a user twice", async () => {
    const { service } = await loadService();

    service.addUserToGroup("global", "s1");
    service.addUserToGroup("global", "s1");

    assert.deepEqual(service.getGroupUsers("global"), ["s1"]);
  });

  it("returns undefined for a group that does not exist", async () => {
    const { service } = await loadService();

    assert.equal(service.getGroupUsers("nope"), undefined);
  });

  it("returns a copy of the user list", async () => {
    const { service } = await loadService();
    service.addUserToGroup("global", "s1");

    service.getGroupUsers("global")?.push("hacker");

    assert.deepEqual(service.getGroupUsers("global"), ["s1"]);
  });

  it("removes users, and the group when the last user is removed", async () => {
    const { service, websocket } = await loadService();
    service.addUserToGroup("global", "s1");
    service.addUserToGroup("global", "s2");

    service.removeUserFromGroup("global", "s1");
    assert.deepEqual(service.getGroupUsers("global"), ["s2"]);
    assert.deepEqual(calls(websocket.removeFromGroup), [["global", "s1"]]);

    service.removeUserFromGroup("global", "s2");
    assert.equal(service.getGroupUsers("global"), undefined);
  });

  it("removes a user that disconnects from the groups created with autoRemove", async () => {
    const { service, websocket } = await loadService();
    service.createGroup("auto", true);
    service.addUserToGroup("auto", "s1");
    service.addUserToGroup("auto", "s2");
    service.addUserToGroup("manual", "s1");

    service.webSocketEvent(socketEvent("close", "s1"));

    assert.deepEqual(service.getGroupUsers("auto"), ["s2"]);
    assert.deepEqual(service.getGroupUsers("manual"), ["s1"]);
    assert.deepEqual(calls(websocket.removeFromGroup), [["auto", "s1"]]);
  });

  it("only uses autoRemove when addUserToGroup creates the group", async () => {
    const { service } = await loadService();

    service.addUserToGroup("auto", "s1", true);
    service.addUserToGroup("auto", "s2", false); // The group exists, so this flag is ignored
    service.createGroup("auto", false); // And so is this one

    service.webSocketEvent(socketEvent("close", "s2"));

    assert.deepEqual(service.getGroupUsers("auto"), ["s1"]);
  });

  it("keeps the groups of two services apart", async () => {
    const { ws } = await loadService();
    const chat = ws.createWebSocketService({ service: "chat" });
    const news = ws.createWebSocketService({ service: "news" });

    chat.addUserToGroup("global", "s1");

    assert.deepEqual(chat.getGroupUsers("global"), ["s1"]);
    assert.equal(news.getGroupUsers("global"), undefined);
  });
});
