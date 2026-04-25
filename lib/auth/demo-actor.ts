import type { PlatformActor } from './actors';

export function requireDemoActor(): PlatformActor {
  return {
    actorType: 'api_key',
    actorId: 'demo_api_key',
    workspaceId: 1,
    scopes: ['*'],
  };
}
