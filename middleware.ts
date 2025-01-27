import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const isAuthenticated = request.cookies.has('sqlEditorAuth') || 
                         request.headers.get('authorization') === 'true'
  const isLoginPage = request.nextUrl.pathname === '/login'

  // If not authenticated and not on login page, redirect to login
  if (!isAuthenticated && !isLoginPage) {
    const url = new URL('/login', request.url)
    return NextResponse.redirect(url)
  }

  // If authenticated and on login page, redirect to home
  if (isAuthenticated && isLoginPage) {
    const url = new URL('/', request.url)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

// Configure which routes to protect
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
} 