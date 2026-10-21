// Stub for "/lib/xp/websocket". The real module is Java-backed and has no Node implementation, so
// the tests get mocks that record their calls.
import { mock } from "node:test";

export const addToGroup = mock.fn((_group: string, _id: string): void => undefined);
export const removeFromGroup = mock.fn((_group: string, _id: string): void => undefined);
export const send = mock.fn((_id: string, _message: string): void => undefined);
export const sendToGroup = mock.fn((_group: string, _message: string): void => undefined);
export const getGroupSize = mock.fn((_group: string): number => 0);
