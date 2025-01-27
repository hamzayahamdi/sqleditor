"use client"

import { useState, useEffect } from "react"
import { Editor, BeforeMount } from "@monaco-editor/react"
import { Button } from "@/components/ui/button"
import { 
  Loader2, 
  Play, 
  Table as TableIcon, 
  AlertCircle, 
  Download, 
  Copy, 
  History, 
  Save,
  Code2,
  FileDown,
  LogOut
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DataTable } from "@/components/DataTable"
import { SchemaExplorer } from "@/components/SchemaExplorer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Resizable } from "re-resizable"
import { QueryAssistant } from "@/components/QueryAssistant"
import { useRouter } from "next/navigation"

// SQL Keywords for autocomplete
const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER",
  "TABLE", "DATABASE", "INDEX", "VIEW", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER",
  "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET", "AS", "IN", "BETWEEN", "LIKE",
  "IS NULL", "IS NOT NULL", "ASC", "DESC", "DISTINCT", "COUNT", "SUM", "AVG", "MAX",
  "MIN", "AND", "OR", "NOT", "CASE", "WHEN", "THEN", "ELSE", "END", "UNION", "ALL"
]

const executeSQL = async (sql: string) => {
  const response = await fetch("https://phpstack-937973-4976355.cloudwaysapps.com/sqleditor.php", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const text = await response.text();
  
  try {
    const data = JSON.parse(text);
    if (!data.success) {
      throw new Error(data.error || 'Query failed');
    }
    return data;
  } catch (e) {
    console.error('Raw response:', text);
    throw new Error('Invalid response from server');
  }
};

export default function SQLEditor() {
  const [sql, setSql] = useState("")
  const [result, setResult] = useState<any[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [queryHistory, setQueryHistory] = useState<{ sql: string, timestamp: string }[]>([])
  const [editorHeight, setEditorHeight] = useState("60vh")
  const [activeTab, setActiveTab] = useState("results")
  const [tableNames, setTableNames] = useState<string[]>([])
  const router = useRouter()

  useEffect(() => {
    const checkAuth = () => {
      const isAuth = sessionStorage.getItem("sqlEditorAuth") || 
                    document.cookie.includes("sqlEditorAuth=true");
      
      if (!isAuth) {
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  // Add useEffect to fetch table names on mount
  useEffect(() => {
    fetchTableNames()
  }, [])

  const fetchTableNames = async () => {
    try {
      const result = await executeSQL("SHOW TABLES;")
      if (result.data) {
        const names = result.data.map((row: any) => Object.values(row)[0] as string)
        setTableNames(names)
      }
    } catch (err) {
      console.error("Failed to fetch table names:", err)
    }
  }

  // Configure Monaco Editor before mounting
  const handleEditorBeforeMount: BeforeMount = (monaco) => {
    // Register SQL language features
    monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        // Get text before cursor to determine context
        const lineContent = model.getLineContent(position.lineNumber);
        const textUntilPosition = lineContent.substring(0, position.column - 1).toLowerCase();

        let suggestions = [];

        // Add table name suggestions after FROM or JOIN
        if (textUntilPosition.includes('from') || textUntilPosition.includes('join')) {
          suggestions.push(...tableNames.map(tableName => ({
            label: tableName,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: tableName,
            range: range,
            detail: 'Table',
            documentation: `Table: ${tableName}`
          })));
        }

        // Add SQL keywords
        suggestions.push(...SQL_KEYWORDS.map(keyword => ({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          range: range
        })));

        // Add common SQL functions
        const SQL_FUNCTIONS = [
          'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'CONCAT', 'UPPER', 'LOWER',
          'DATE', 'NOW', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND'
        ];

        suggestions.push(...SQL_FUNCTIONS.map(func => ({
          label: func,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: func,
          range: range
        })));

        return { suggestions };
      },
      triggerCharacters: [' ', '.', '`']
    });

    // Add custom SQL theme
    monaco.editor.defineTheme('sqlTheme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' }
      ],
      colors: {
        'editor.background': '#1E1E1E',
        'editor.foreground': '#D4D4D4',
        'editor.lineHighlightBackground': '#2F2F2F',
        'editorCursor.foreground': '#569CD6',
        'editor.selectionBackground': '#264F78'
      }
    });
  }

  const executeQuery = async () => {
    if (!sql.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const result = await executeSQL(sql.trim());
      setResult(result.data);
      
      // Add to history
      setQueryHistory(prev => [{
        sql: sql.trim(),
        timestamp: new Date().toISOString()
      }, ...prev].slice(0, 50));
      
      setActiveTab("results");
    } catch (err) {
      console.error("Query execution error:", err);
      setError(err instanceof Error ? err.message : "Failed to execute query");
    } finally {
      setLoading(false);
    }
  };

  const formatSQL = () => {
    // Basic SQL formatting (you might want to use a proper SQL formatter library)
    const formatted = sql
      .replace(/\s+/g, ' ')
      .replace(/ (SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT)/gi, '\n$1')
      .replace(/ (LEFT|RIGHT|INNER|OUTER) JOIN/gi, '\n$1 JOIN')
      .trim();
    setSql(formatted);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sql);
  };

  const downloadResults = () => {
    if (!result) return;
    
    const csv = [
      Object.keys(result[0]).join(','),
      ...result.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query-results.csv';
    a.click();
  };

  const handleLogout = () => {
    // Clear both cookie and session storage
    document.cookie = "sqlEditorAuth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    sessionStorage.removeItem("sqlEditorAuth");
    
    // Force a router refresh and navigation
    router.refresh();
    router.push("/login");
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
                beforeMount={handleEditorBeforeMount}
                options={{
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
                  tabSize: 2,
                }}
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

