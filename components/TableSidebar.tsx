import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar"
import { ChevronRight, ChevronDown, Search } from "lucide-react"

interface TableSidebarProps {
  onSelectTable: (tableName: string) => void
}

interface TableInfo {
  name: string
  fields: string[]
}

export function TableSidebar({ onSelectTable }: TableSidebarProps) {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { open } = useSidebar()

  useEffect(() => {
    const fetchTables = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch("https://phpstack-937973-4976355.cloudwaysapps.com/sqleditor.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sql: "SHOW TABLES" }),
        })

        if (!response.ok) {
          throw new Error("Failed to fetch tables")
        }

        const data = await response.json()
        const tableNames = data.data.map((row: any) => Object.values(row)[0] as string)

        const tablesWithFields = await Promise.all(
          tableNames.map(async (tableName: string) => {
            const fieldsResponse = await fetch("https://phpstack-937973-4976355.cloudwaysapps.com/sqleditor.php", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ sql: `DESCRIBE ${tableName}` }),
            })
            const fieldsData = await fieldsResponse.json()
            const fields = fieldsData.data.map((field: any) => field.Field)
            return { name: tableName, fields }
          }),
        )

        setTables(tablesWithFields)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred")
      } finally {
        setIsLoading(false)
      }
    }

    fetchTables()
  }, [])

  const toggleTableExpansion = (tableName: string) => {
    setExpandedTables((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(tableName)) {
        newSet.delete(tableName)
      } else {
        newSet.add(tableName)
      }
      return newSet
    })
  }

  const filteredTables = tables.filter((table) => table.name.toLowerCase().includes(searchTerm.toLowerCase()))

  if (!open) {
    return null
  }

  return (
    <Sidebar className="w-64 border-r">
      <SidebarContent>
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Database Tables</h2>
          <div className="relative mb-4">
            <Input
              type="text"
              placeholder="Search tables..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
          {isLoading && <p>Loading tables...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {!isLoading && !error && (
            <ScrollArea className="h-[calc(100vh-8rem)]">
              {filteredTables.map((table) => (
                <div key={table.name} className="mb-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start mb-1 px-2"
                    onClick={() => toggleTableExpansion(table.name)}
                  >
                    {expandedTables.has(table.name) ? (
                      <ChevronDown className="h-4 w-4 mr-2" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-2" />
                    )}
                    {table.name}
                  </Button>
                  {expandedTables.has(table.name) && (
                    <div className="ml-6 space-y-1">
                      {table.fields.map((field) => (
                        <Button
                          key={field}
                          variant="ghost"
                          className="w-full justify-start text-sm py-1 px-2"
                          onClick={() => onSelectTable(`SELECT ${field} FROM ${table.name} LIMIT 10`)}
                        >
                          {field}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </ScrollArea>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  )
}

