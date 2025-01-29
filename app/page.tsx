"use client"

import { useState, useEffect } from "react"
import { Editor } from "@monaco-editor/react"
import { Button } from "@/components/ui/button"
import { 
  Loader2, 
  Play, 
  Table as TableIcon, 
  AlertCircle, 
  Copy, 
  History, 
  Code2,
  FileDown,
  LogOut
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DataTable } from "@/components/DataTable"
import { SchemaExplorer } from "@/components/SchemaExplorer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QueryAssistant } from "@/components/QueryAssistant"
import { useRouter } from "next/navigation"
import type { editor, languages, Position } from 'monaco-editor'
import type { Monaco } from '@monaco-editor/react'

interface TableRow {
  [key: string]: string
}

interface APIResponse {
  success: boolean
  data: TableRow[]
  error?: string
}

interface QueryResult {
  [key: string]: string | number
}

export default function SQLEditor() {
  const [sql, setSql] = useState("")
  const [result, setResult] = useState<QueryResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [queryHistory, setQueryHistory] = useState<{ sql: string, timestamp: string }[]>([])
  const [activeTab, setActiveTab] = useState("results")
  const [tableNames, setTableNames] = useState<string[]>([])
  const router = useRouter()

  // Authentication check
  useEffect(() => {
    const isAuth = sessionStorage.getItem("sqlEditorAuth") || 
                  document.cookie.includes("sqlEditorAuth=true")
    if (!isAuth) router.push("/login")
  }, [router])

  // Fetch table names
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const response = await fetch("https://phpstack-937973-4976355.cloudwaysapps.com/sqleditor.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sql: "SHOW TABLES;" })
        })
        const result: APIResponse = await response.json()
        if (result.success && Array.isArray(result.data)) {
          const tables = result.data.map((row: TableRow) => Object.values(row)[0] as string)
          setTableNames(tables)
        }
      } catch (err) {
        console.error("Failed to fetch tables:", err)
      }
    }
    fetchTables()
  }, [])

  // Execute SQL query
  const executeQuery = async () => {
    if (!sql.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch("https://phpstack-937973-4976355.cloudwaysapps.com/sqleditor.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: sql.trim() })
      })
      const result = await response.json()
      
      if (!result.success) throw new Error(result.error || 'Query failed')
      
      setResult(result.data)
      setQueryHistory(prev => [{
        sql: sql.trim(),
        timestamp: new Date().toISOString()
      }, ...prev].slice(0, 50))
      setActiveTab("results")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute query")
    } finally {
      setLoading(false)
    }
  }

  // Editor configuration
  const editorOptions: editor.IStandaloneEditorConstructionOptions = {
    minimap: { enabled: false },
    fontSize: 14,
    padding: { top: 16 },
    lineNumbers: "on",
    scrollBeyondLastLine: false,
    wordWrap: "on",
    wrappingIndent: "indent",
    automaticLayout: true,
    suggestOnTriggerCharacters: true,
    quickSuggestions: true,
    suggest: {
      preview: true,
      showIcons: true,
      showStatusBar: true,
      showInlineDetails: true,
      filterGraceful: false,
      snippetsPreventQuickSuggestions: false
    }
  }

  // Editor setup function with proper types
  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (
        model: editor.ITextModel,
        position: Position
      ): languages.ProviderResult<languages.CompletionList> => {
        const wordInfo = model.getWordUntilPosition(position)
        const word = wordInfo.word.toLowerCase()
        
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endColumn: wordInfo.endColumn
        }

        const suggestions: languages.CompletionItem[] = [
          // Table suggestions
          ...tableNames
            .filter(name => name.toLowerCase().includes(word))
            .map(name => ({
              label: name,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: name,
              sortText: '0' + name,
              range: range
            })),
          // SQL Keywords
          ...['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'GROUP BY', 'ORDER BY', 'LIMIT']
            .filter(kw => kw.toLowerCase().includes(word))
            .map(kw => ({
              label: kw,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: kw + ' ',
              sortText: '1' + kw,
              range: range
            })),
          // SQL Functions
          ...['COUNT(*)', 'SUM', 'AVG', 'MAX', 'MIN', 'NOW()']
            .filter(fn => fn.toLowerCase().includes(word))
            .map(fn => ({
              label: fn,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: fn,
              sortText: '2' + fn,
              range: range
            }))
        ]

        return { suggestions }
      },
      triggerCharacters: [' ', '.', '`']
    })
  }

  const formatSQL = () => {
    const formatted = sql
      .replace(/\s+/g, ' ')
      .replace(/ (SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT)/gi, '\n$1')
      .replace(/ (LEFT|RIGHT|INNER|OUTER) JOIN/gi, '\n$1 JOIN')
      .trim()
    setSql(formatted)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sql)
  }

  const downloadResults = () => {
    if (!result) return
    const csv = [
      Object.keys(result[0]).join(','),
      ...result.map(row => Object.values(row).join(','))
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'query-results.csv'
    a.click()
  }

  const handleLogout = () => {
    document.cookie = "sqlEditorAuth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
    sessionStorage.removeItem("sqlEditorAuth")
    router.refresh()
    router.push("/login")
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 to-gray-950">
      {/* Left Sidebar - Schema Explorer */}
      <div className="hidden md:block h-screen">
        <SchemaExplorer onSelectTable={(query) => setSql(query)} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="h-14 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={formatSQL}
              className="hover:bg-gradient-to-r hover:from-indigo-500 hover:to-indigo-700 text-slate-200"
            >
              <Code2 className="h-4 w-4 mr-2" />
              Format
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={copyToClipboard}
              className="hover:bg-gradient-to-r hover:from-indigo-500 hover:to-indigo-700 text-slate-200"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={executeQuery}
              disabled={loading}
              className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Execute Query
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="hover:bg-gradient-to-r hover:from-red-500 hover:to-red-700 text-slate-200"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Split View Container */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Editor and Assistant Split */}
          <div className="h-[30vh] flex border-b border-gray-800">
            {/* Editor Panel */}
            <div className="flex-1">
              <Editor
                value={sql}
                onChange={(value) => setSql(value || "")}
                language="sql"
                theme="sqlTheme"
                onMount={handleEditorDidMount}
                options={editorOptions}
              />
            </div>

            {/* AI Assistant Panel */}
            <div className="w-96">
              <QueryAssistant onSelectQuery={(query) => setSql(query)} />
            </div>
          </div>

          {/* Results Panel - Now takes remaining space */}
          <div className="flex-1 min-h-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="border-b border-gray-800 bg-gray-900/50">
                <div className="flex items-center justify-between px-4">
                  <TabsList className="h-12">
                    <TabsTrigger value="results" className="gap-2">
                      <TableIcon className="h-4 w-4" />
                      Results
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-2">
                      <History className="h-4 w-4" />
                      History
                    </TabsTrigger>
                  </TabsList>
                  {result && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={downloadResults}
                      className="hover:bg-gradient-to-r hover:from-emerald-500 hover:to-emerald-700 text-slate-200"
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  )}
                </div>
              </div>

              <TabsContent value="results" className="flex-1 overflow-auto p-4">
                {error ? (
                  <div className="mb-4">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </div>
                ) : result ? (
                  <DataTable 
                    data={result} 
                    columns={Object.keys(result[0] || {}).map(key => ({
                      accessorKey: key,
                      header: key
                    }))}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <TableIcon className="h-8 w-8 mb-2 mx-auto text-gray-500" />
                      <p>Execute a query to see results</p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="flex-1 overflow-auto p-4">
                <div className="space-y-2">
                  {queryHistory.map((item, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-lg bg-gray-800/50 border border-gray-700 cursor-pointer hover:bg-gray-800"
                      onClick={() => {
                        setSql(item.sql);
                        setActiveTab("results");
                      }}
                    >
                      <div className="text-sm text-gray-400 mb-2">
                        {new Date(item.timestamp).toLocaleString()}
                      </div>
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                        {item.sql}
                      </pre>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}

