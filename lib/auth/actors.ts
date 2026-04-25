import type { ActorTypeValue } from '../db/schema';

export type ActorType = ActorTypeValue;

export type PlatformActor = {
  actorType: ActorType;
  actorId: string;
  workspaceId: number;
  scopes: string[];
};

export function hasScope(actor: PlatformActor, scope: string) {
  return actor.scopes.includes(scope) || actor.scopes.includes('*');
}
