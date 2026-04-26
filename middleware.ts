import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedApiRoute = createRouteMatcher(['/api/v1(.*)']);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedApiRoute(request)) {
    const session = await auth();

    if (!session.userId) {
      const requestId =
        request.headers.get('x-request-id')?.trim() ||
        `req_${crypto.randomUUID().replace(/-/g, '')}`;

      return Response.json(
        {
          error: {
            code: 'AUTH_UNAUTHORIZED',
            message: 'Authentication is required.',
            details: {},
          },
          request_id: requestId,
        },
        { status: 401 },
      );
    }
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
