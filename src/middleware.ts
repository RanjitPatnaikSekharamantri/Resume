import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const protectedPaths = [
  "/dashboard",
  "/applications",
  "/ai-studio",
  "/resume-library",
  "/analytics",
  "/profile",
  "/settings",
];

const protectedApiPaths = [
  "/api/applications",
  "/api/resumes",
  "/api/resume-versions",
  "/api/profile",
  "/api/cover-letters",
  "/api/ai",
  "/api/ai-providers",
  "/api/analytics",
];

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = request.nextUrl;

  // Protect API routes — return 401 JSON instead of redirect
  const isProtectedApi = protectedApiPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (isProtectedApi && !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Protect page routes — redirect to login
  const isProtectedPage = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (isProtectedPage && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages
  if ((pathname === "/login" || pathname === "/signup") && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/applications/:path*",
    "/ai-studio/:path*",
    "/resume-library/:path*",
    "/analytics/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/login",
    "/signup",
    "/api/applications/:path*",
    "/api/resumes/:path*",
    "/api/profile/:path*",
    "/api/cover-letters/:path*",
    "/api/ai/:path*",
    "/api/ai-providers/:path*",
    "/api/resume-versions/:path*",
    "/api/analytics/:path*",
  ],
};
