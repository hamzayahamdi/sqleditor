"use client"

import { useState, useEffect } from "react"
import { ChevronRight, Database, Table, KeyRound, Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface SchemaExplorerProps {
  onSelectTable?: (query: string) => void
}

interface TableRow {
  [key: string]: string;
}

interface ColumnData {
  Field: string;
  Type: string;
  Null: string;
  Key: string;
}

interface TableDetails {
  [tableName: string]: ColumnData[];
}

export function SchemaExplorer({ onSelectTable }: SchemaExplorerProps) {
  const [tables, setTables] = useState<string[]>([])
  const [tableDetails, setTableDetails] = useState<TableDetails>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedTable, setExpandedTable] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTables = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch("https://phpstack-937973-4976355.cloudwaysapps.com/sqleditor.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sql: "SHOW TABLES;" })
        })

        const data = await response.json()
        
        if (data.data) {
          const tableNames = data.data.map((row: TableRow) => Object.values(row)[0] as string)
          setTables(tableNames)
          
          // Fetch details for first table immediately
          if (tableNames.length > 0) {
            await fetchTableColumns(tableNames[0])
          }
        }
      } catch (err) {
        console.error('Failed to fetch tables:', err)
        setError('Failed to load tables')
      } finally {
        setLoading(false)
      }
    }

    fetchTables()
  }, [])

  const fetchTableColumns = async (tableName: string) => {
    try {
      const response = await fetch("https://phpstack-937973-4976355.cloudwaysapps.com/sqleditor.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: `SHOW COLUMNS FROM \`${tableName}\`;` })
      })

      const data = await response.json()
      if (data.data) {
        setTableDetails(prev => ({
          ...prev,
          [tableName]: data.data
        }))
      }
    } catch (err) {
      console.error(`Failed to fetch columns for ${tableName}:`, err)
    }
  }

  const handleTableClick = async (tableName: string) => {
    setExpandedTable(expandedTable === tableName ? null : tableName)
    if (!tableDetails[tableName]) {
      await fetchTableColumns(tableName)
    }
  }

  const filteredTables = tables.filter(table => 
    table.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="w-64 md:w-72 flex-shrink-0 h-full bg-slate-900/50 border-r border-slate-800 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-4">
          <Database className="h-5 w-5 text-indigo-400" />
          <h2 className="font-semibold text-slate-200">Database Explorer</h2>
        </div>
        <Input
          placeholder="Search tables..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-slate-800/50 border-slate-700 text-slate-200"
        />
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center p-4 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading schema...
          </div>
        ) : error ? (
          <div className="p-4 text-red-400 text-center">
            {error}
          </div>
        ) : tables.length === 0 ? (
          <div className="p-4 text-slate-400 text-center">
            No tables found
          </div>
        ) : (
          <div className="p-2">
            {filteredTables.map((tableName) => (
              <div key={tableName} className="mb-2">
                <div
                  className="flex items-center p-2 rounded-md hover:bg-slate-800/50 cursor-pointer group"
                  onClick={() => handleTableClick(tableName)}
                >
                  <ChevronRight
                    className={`h-4 w-4 text-slate-400 transition-transform ${
                      expandedTable === tableName ? "rotate-90" : ""
                    }`}
                  />
                  <Table className="h-4 w-4 text-slate-400 mx-2" />
                  <span className="text-slate-200 text-sm flex-1">{tableName}</span>
                  <Button
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 h-7 bg-blue-500 hover:bg-blue-600 text-slate-100 gap-2 font-medium"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectTable?.(`SELECT * FROM \`${tableName}\` LIMIT 100;`)
                    }}
                  >
                    <Play className="h-4 w-4" />
                    Query
                  </Button>
                </div>

                {expandedTable === tableName && tableDetails[tableName] && (
                  <div className="ml-9 mt-1 border-l border-slate-800 pl-4">
                    {tableDetails[tableName].map((column: ColumnData) => (
                      <div
                        key={column.Field}
                        className="py-1 px-2 text-sm flex items-center gap-2"
                      >
                        {column.Key === 'PRI' && (
                          <KeyRound className="h-3 w-3 text-yellow-500" />
                        )}
                        <span className="text-slate-300">{column.Field}</span>
                        <span className="text-slate-500 text-xs">{column.Type}</span>
                        {column.Null === 'YES' && (
                          <span className="text-slate-500 text-xs">nullable</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 