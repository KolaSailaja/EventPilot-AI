export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/events/:path*",
    "/account/:path*",
    "/ai/:path*",
  ],
};
