// Stub for "/lib/xp/portal"
import { mock } from "node:test";

export const serviceUrl = mock.fn(({ service }: { service: string }) => `/_/service/com.example.app/${service}`);
