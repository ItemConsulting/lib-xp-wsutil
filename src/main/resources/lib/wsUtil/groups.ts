import { addToGroup, removeFromGroup } from "/lib/xp/websocket";
import type { Events } from "./events";
import type { WebSocketService } from "./types";
import { hasOwn } from "./util";

export type Groups = Pick<WebSocketService, "createGroup" | "addUserToGroup" | "removeUserFromGroup" | "getGroupUsers">;

/**
 * The groups of one websocket service. Users that close their connection leave every group created with the
 * autoRemove flag, so this needs the events of the service.
 */
export function createGroups(events: Events): Groups {
  const groups: Record<string, { users: string[]; autoRemove: boolean }> = {};

  const api: Groups = {
    createGroup(group, autoRemove) {
      if (!hasOwn(groups, group)) {
        groups[group] = { users: [], autoRemove: !!autoRemove };
      }
    },

    addUserToGroup(group, id, autoRemove) {
      api.createGroup(group, autoRemove);

      if (groups[group].users.indexOf(id) === -1) {
        groups[group].users.push(id);
      }

      addToGroup(group, id);
    },

    removeUserFromGroup(group, id) {
      const users = groups[group]?.users;

      if (users) {
        const index = users.indexOf(id);

        if (index > -1) {
          users.splice(index, 1);
        }

        if (users.length === 0) {
          delete groups[group];
        }
      }

      removeFromGroup(group, id);
    },

    getGroupUsers(group) {
      return groups[group]?.users.slice();
    },
  };

  events.addHandler("close", (event) => {
    const id = event.session.id;

    for (const group of Object.keys(groups)) {
      if (groups[group].autoRemove && groups[group].users.indexOf(id) > -1) {
        api.removeUserFromGroup(group, id);
      }
    }
  });

  return api;
}
