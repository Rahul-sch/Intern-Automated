import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublic = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/clerk(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublic(req)) return NextResponse.next();
  const { userId, redirectToSignIn } = await auth();
  if (!userId) {
    // API surfaces get a JSON 401 (matches the existing AppError envelope);
    // pages bounce to Clerk's hosted sign-in.
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "VALIDATION", message: "Sign in to continue." },
        },
        { status: 401 },
      );
    }
    return redirectToSignIn();
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
