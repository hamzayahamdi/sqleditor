"use client"

import { useState, useEffect } from "react"
import { Editor, BeforeMount } from "@monaco-editor/react"
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
  LogOut,
  Database
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DataTable } from "@/components/DataTable"
import { SchemaExplorer } from "@/components/SchemaExplorer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QueryAssistant } from "@/components/QueryAssistant"
import { useRouter } from "next/navigation"
import type { editor, languages, Position } from 'monaco-editor'
import type { Monaco } from '@monaco-editor/react'

// Enhanced SQL Keywords with descriptions
const SQL_COMPLETIONS = {
  keywords: [
    { label: 'SELECT', detail: 'Retrieve data from tables', insertText: 'SELECT ' },
    { label: 'FROM', detail: 'Specify the table to query', insertText: 'FROM ' },
    { label: 'WHERE', detail: 'Filter records', insertText: 'WHERE ' },
    { label: 'JOIN', detail: 'Combine rows from tables', insertText: 'JOIN ' },
    { label: 'LEFT JOIN', detail: 'Keep all records from left table', insertText: 'LEFT JOIN ' },
    { label: 'GROUP BY', detail: 'Group rows by columns', insertText: 'GROUP BY ' },
    { label: 'ORDER BY', detail: 'Sort the result set', insertText: 'ORDER BY ' },
    { label: 'HAVING', detail: 'Filter grouped records', insertText: 'HAVING ' },
    { label: 'LIMIT', detail: 'Limit the number of records', insertText: 'LIMIT ' },
  ],
  functions: [
    { label: 'COUNT', detail: 'Count rows', insertText: 'COUNT(${1:*})' },
    { label: 'SUM', detail: 'Calculate sum', insertText: 'SUM(${1:column})' },
    { label: 'AVG', detail: 'Calculate average', insertText: 'AVG(${1:column})' },
    { label: 'MAX', detail: 'Find maximum value', insertText: 'MAX(${1:column})' },
    { label: 'MIN', detail: 'Find minimum value', insertText: 'MIN(${1:column})' },
    { label: 'CONCAT', detail: 'Concatenate strings', insertText: 'CONCAT(${1:str1}, ${2:str2})' },
    { label: 'DATE', detail: 'Convert to date', insertText: 'DATE(${1:expression})' },
    { label: 'NOW', detail: 'Current timestamp', insertText: 'NOW()' },
  ]
};

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
  } catch {
    console.error('Raw response:', text);
    throw new Error('Invalid response from server');
  }
};

// Add proper types
interface QueryResult {
  [key: string]: string | number;
}

interface TableRow {
  [key: string]: string;
}

export default function SQLEditor() {
  const [sql, setSql] = useState("")
  const [result, setResult] = useState<QueryResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [queryHistory, setQueryHistory] = useState<{ sql: string, timestamp: string }[]>([])
  const [activeTab, setActiveTab] = useState("results")
  const [tableNames, setTableNames] = useState<string[]>([])
  const [monacoInstance, setMonacoInstance] = useState<Monaco | null>(null)
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

  useEffect(() => {
    const fetchTableNames = async () => {
      try {
        const isAuth = sessionStorage.getItem("sqlEditorAuth") || 
                      document.cookie.includes("sqlEditorAuth=true");
        
        if (!isAuth) {
          router.push("/login");
          return;
        }

        const result = await executeSQL("SHOW TABLES;");
        console.log("Table fetch result:", result);

        if (result && result.data && Array.isArray(result.data)) {
          const names = result.data.map((row: TableRow) => {
            if (typeof row === 'string') return row;
            if (typeof row === 'object') {
              return Object.values(row)[0] as string;
            }
            return null;
          }).filter((name: string | null): name is string => name !== null);

          console.log("Processed table names:", names);
          setTableNames(names);

          names.forEach(async (tableName: string) => {
            try {
              const columnsResult = await executeSQL(`SHOW COLUMNS FROM \`${tableName}\`;`);
              if (columnsResult.data) {
                const columns = columnsResult.data.map((row: TableRow) => ({
                  table: tableName,
                  column: row.Field,
                  type: row.Type
                }));
                console.log(`Columns for ${tableName}:`, columns);
              }
            } catch (err) {
              console.error(`Failed to fetch columns for ${tableName}:`, err);
            }
          });
        }
      } catch (err) {
        console.error("Failed to fetch schema:", err);
      }
    };

    fetchTableNames();
  }, [router]);

  useEffect(() => {
    if (!monacoInstance || !tableNames.length) return;

    const disposable = monacoInstance.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (
        model: editor.ITextModel,
        position: Position
      ): languages.ProviderResult<languages.CompletionList> => {
        const wordInfo = model.getWordUntilPosition(position);
        const word = wordInfo.word.toLowerCase();
        
        console.log('Current word:', word);
        console.log('Available tables:', tableNames);

        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endColumn: wordInfo.endColumn
        };

        const suggestions: languages.CompletionItem[] = [
          // Table suggestions
          ...tableNames
            .filter(name => name.toLowerCase().includes(word))
            .map(name => ({
              label: name,
              kind: monacoInstance.languages.CompletionItemKind.Class,
              insertText: name,
              sortText: '0' + name,
              range: range,
              detail: 'Table',
              documentation: `Table: ${name}`
            })),
          // SQL Keywords
          ...SQL_COMPLETIONS.keywords
            .filter(kw => kw.label.toLowerCase().includes(word))
            .map(kw => ({
              label: kw.label,
              kind: monacoInstance.languages.CompletionItemKind.Keyword,
              insertText: kw.insertText,
              sortText: '1' + kw.label,
              range: range,
              detail: kw.detail
            })),
          // SQL Functions
          ...SQL_COMPLETIONS.functions
            .filter(fn => fn.label.toLowerCase().includes(word))
            .map(fn => ({
              label: fn.label,
              kind: monacoInstance.languages.CompletionItemKind.Function,
              insertText: fn.insertText,
              sortText: '2' + fn.label,
              range: range,
              detail: fn.detail,
              insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet
            }))
        ];

        return { suggestions };
      },
      triggerCharacters: ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
        'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
        '_', ' ', '.']
    });

    return () => {
      disposable.dispose();
    };
  }, [monacoInstance, tableNames]);

  const handleEditorDidMount = (
    editor: editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    setMonacoInstance(monaco);
  }

  const handleEditorBeforeMount: BeforeMount = (monaco) => {
    // Only define theme here, move completion provider to useEffect
    monaco.editor.defineTheme('sqlTheme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'operator', foreground: 'D4D4D4' },
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
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 to-gray-950">
      {/* Top Navigation Bar - Removed Run Query button */}
      <div className="h-14 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Database className="h-5 w-5 text-indigo-400" />
          <h1 className="text-lg font-semibold text-slate-200">SQL Editor</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="hover:bg-red-500/10 text-slate-200"
          >
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-72 border-r border-gray-800 flex flex-col bg-gray-900/30">
          <SchemaExplorer onSelectTable={(query) => setSql(query)} />
        </div>

        {/* Center Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Query Editor Section with Run Query button */}
          <div className="h-1/2 border-b border-gray-800 flex flex-col">
            {/* Editor Toolbar */}
            <div className="h-10 border-b border-gray-800 bg-gray-900/30 flex items-center px-3 gap-2">
              <Button 
                size="sm" 
                onClick={formatSQL}
                className="h-7 bg-indigo-500 hover:bg-indigo-600 text-slate-100 gap-2 font-medium"
              >
                <Code2 className="h-4 w-4" />
                Format
              </Button>
              <Button 
                size="sm" 
                onClick={copyToClipboard}
                className="h-7 bg-emerald-500 hover:bg-emerald-600 text-slate-100 gap-2 font-medium"
              >
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              <Button
                size="sm"
                onClick={executeQuery}
                disabled={loading}
                className="h-7 bg-blue-500 hover:bg-blue-600 text-slate-100 gap-2 ml-auto font-medium disabled:bg-blue-500/50 disabled:text-slate-300"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    <span>Run Query</span>
                  </>
                )}
              </Button>
            </div>
            
            {/* Editor */}
            <div className="flex-1 min-h-0">
              <Editor
                value={sql}
                onChange={(value) => setSql(value || "")}
                language="sql"
                theme="sqlTheme"
                beforeMount={handleEditorBeforeMount}
                onMount={handleEditorDidMount}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  padding: { top: 8 },
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  automaticLayout: true
                }}
              />
            </div>
          </div>

          {/* Results Section */}
          <div className="h-1/2 flex flex-col min-h-0">
            {/* Results Toolbar */}
            <div className="h-10 border-b border-gray-800 bg-gray-900/30 flex items-center justify-between px-3">
              <div className="flex items-center gap-2">
                <TableIcon className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-200">Query Results</span>
              </div>
              {result && (
                <Button
                  size="sm"
                  onClick={downloadResults}
                  className="h-7 bg-emerald-500 hover:bg-emerald-600"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Export
                </Button>
              )}
            </div>

            {/* Results Content */}
            <div className="flex-1 overflow-auto p-4">
              {error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
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
            </div>
          </div>
        </div>

        {/* Right Sidebar - AI Assistant */}
        <div className="w-80 border-l border-gray-800 bg-gray-900/30">
          <QueryAssistant onSelectQuery={(query) => setSql(query)} />
        </div>
      </div>
    </div>
  )
}

