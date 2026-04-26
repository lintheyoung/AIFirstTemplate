import { auth } from '@clerk/nextjs/server';
import { ApiError } from '../request/errors';
import type { PlatformActor } from './actors';

const starterWorkspaceId = 1;

export async function requireClerkActor(): Promise<PlatformActor> {
  const session = await auth();

  if (!session.userId) {
    throw new ApiError({
      code: 'AUTH_UNAUTHORIZED',
      message: 'Authentication is required.',
      status: 401,
    });
  }

  return {
    actorType: 'user',
    actorId: session.userId,
    workspaceId: starterWorkspaceId,
    scopes: ['*'],
  };
}
