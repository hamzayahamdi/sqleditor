"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Lock, Database } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function LoginPage() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (password === "sketch123!!!") {
        // Set both cookie and session storage
        document.cookie = "sqlEditorAuth=true; path=/";
        sessionStorage.setItem("sqlEditorAuth", "true");
        
        // Force a router refresh and navigation
        router.refresh();
        router.push("/");
      } else {
        setError("Invalid password")
      }
    } catch {
      setError("An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="w-full max-w-md">
        <div className="bg-slate-800/50 rounded-lg shadow-xl border border-slate-700 backdrop-blur-sm">
          {/* Header */}
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Database className="h-8 w-8 text-blue-500" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                SQL Editor
              </h1>
            </div>
            <p className="text-center text-slate-400">
              Enter master password to access the SQL editor
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  type="password"
                  placeholder="Enter master password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-slate-900/50 border-slate-700 text-slate-200 placeholder:text-slate-500"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="p-6 border-t border-slate-700 bg-slate-900/30 rounded-b-lg">
            <p className="text-center text-sm text-slate-500">
              Protected SQL Editor for Database Management
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 