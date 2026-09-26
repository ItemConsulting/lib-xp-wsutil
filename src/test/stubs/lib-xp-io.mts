// Stub for "/lib/xp/io". A test sets what readText() returns with `readText.mock.mockImplementation()`.

import { mock } from "node:test";
import type { ResourceKey } from "@enonic-types/core";

export const getResource = mock.fn((key: string | ResourceKey) => ({ getStream: () => key }));
export const readText = mock.fn((_stream: unknown): string => "");
