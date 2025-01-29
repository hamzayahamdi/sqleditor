"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Send, Clipboard, Play } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface QueryAssistantProps {
  onSelectQuery: (query: string) => void
}

export function QueryAssistant({ onSelectQuery }: QueryAssistantProps) {
  const [prompt, setPrompt] = useState("")
  const [response, setResponse] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateQuery = async () => {
    if (!prompt.trim()) return

    setLoading(true)
    setError(null)
    setResponse("")

    try {
      const response = await fetch("/api/generate-query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`)
      }

      if (!data.content) {
        throw new Error('No response received from AI')
      }

      setResponse(data.content)

    } catch (err) {
      console.error("Failed to generate query:", err)
      setError(err instanceof Error ? err.message : "Failed to generate query")
    } finally {
      setLoading(false)
    }
  }

  const extractQueryAndExplanation = (response: string) => {
    const queryMatch = response.match(/```sql\n([\s\S]*?)\n```/);
    const query = queryMatch ? queryMatch[1].trim() : '';
    
    // Get explanation by removing the SQL code block
    let explanation = response.replace(/```sql[\s\S]*?```/, '').trim();
    
    return { query, explanation };
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 border-l border-slate-800">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-lg font-semibold text-slate-200">AI Query Assistant</h2>
        <p className="text-sm text-slate-400 mt-1">
          Describe the query you want to create
        </p>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="E.g., Show me all invoices from last month with their total amounts"
            className="min-h-[100px] bg-slate-800/50 border-slate-700 text-slate-200"
          />

          <div className="flex justify-end gap-2">
            <Button
              onClick={generateQuery}
              disabled={loading || !prompt.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Generate Query
                </>
              )}
            </Button>
          </div>

          {response && (
            <div className="mt-6 space-y-4">
              {/* Explanation Section */}
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <h3 className="text-sm font-medium text-slate-200 mb-2">Explanation</h3>
                <div className="text-sm text-slate-300 whitespace-pre-wrap">
                  {extractQueryAndExplanation(response).explanation}
                </div>
              </div>

              {/* Query Section */}
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-200">Generated Query</h3>
                  <Button
                    size="sm"
                    onClick={() => onSelectQuery(extractQueryAndExplanation(response).query)}
                    className="h-7 bg-blue-500 hover:bg-blue-600 text-slate-100 gap-2 font-medium"
                  >
                    <Play className="h-4 w-4" />
                    Use this query
                  </Button>
                </div>
                <pre className="text-sm text-slate-200 whitespace-pre-wrap bg-slate-900/50 p-3 rounded-md">
                  {extractQueryAndExplanation(response).query}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 