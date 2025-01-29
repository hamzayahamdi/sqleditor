import OpenAI from 'openai';
import { NextResponse } from 'next/server';

// Check for API key
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set in environment variables');
}

// Initialize OpenAI with API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1", // Make sure we're using the correct base URL
});

interface TableColumn {
  Field: string;
  Type: string;
  Null: string;
  Key: string;
}

interface TableRow {
  [key: string]: string;
}

// Function to fetch table structure
async function getTableStructure(tableName: string): Promise<TableColumn[]> {
  try {
    const response = await fetch("https://phpstack-937973-4976355.cloudwaysapps.com/sqleditor.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql: `DESCRIBE \`${tableName}\`;` })
    });
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error(`Error fetching structure for ${tableName}:`, error);
    return [];
  }
}

export async function POST(req: Request) {
  try {
    // Check for API key before making requests
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Fetch tables first
    const tablesResponse = await fetch("https://phpstack-937973-4976355.cloudwaysapps.com/sqleditor.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql: "SHOW TABLES;" })
    });
    
    const tablesData = await tablesResponse.json();
    const tables = tablesData.data?.map((row: TableRow) => Object.values(row)[0] as string) || [];

    // Fetch structure for relevant tables
    const relevantTables = tables.filter((table: string) => 
      table.startsWith('llx_') && 
      (prompt.toLowerCase().includes(table) || 
       prompt.toLowerCase().includes(table.replace('llx_', '')))
    );

    let schemaInfo = '';
    for (const table of relevantTables) {
      const structure = await getTableStructure(table);
      if (structure.length > 0) {
        schemaInfo += `\nTable ${table} structure:\n`;
        schemaInfo += structure.map((col: TableColumn) => 
          `- ${col.Field} (${col.Type})${col.Key === 'PRI' ? ' PRIMARY KEY' : ''}${col.Null === 'YES' ? ' nullable' : ''}`
        ).join('\n');
      }
    }

    // If no specific tables mentioned, include common tables
    if (relevantTables.length === 0) {
      const commonTables = ['llx_societe', 'llx_facture', 'llx_user', 'llx_entity'];
      for (const table of commonTables) {
        if (tables.includes(table)) {
          const structure = await getTableStructure(table);
          if (structure.length > 0) {
            schemaInfo += `\nTable ${table} structure:\n`;
            schemaInfo += structure.map((col: TableColumn) => 
              `- ${col.Field} (${col.Type})${col.Key === 'PRI' ? ' PRIMARY KEY' : ''}${col.Null === 'YES' ? ' nullable' : ''}`
            ).join('\n');
          }
        }
      }
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a SQL expert assistant helping users write queries for a Dolibarr ERP database with multi-company module enabled. 

          Entity/Company Mapping (use these entity IDs, NOT llx_societe):
          - SKETCH CASA (entity = 1)
          - SKETCH RABAT (entity = 2)
          - SKETCH TANGER (entity = 5)
          - SKETCH MARRAKECH (entity = 6)
          - SKE (entity = 7)
          - OUTDOORZ (entity = 8)
          - OUTLET RABAT (entity = 10)
          - COMPTA_CASA (entity = 11)
          - COMPTA_RABAT (entity = 12)
          - COMPTA_TANGER (entity = 13)
          
          Important Rules:
          1. When filtering by company/store, ALWAYS use the 'entity' column with the specific entity ID
          2. DO NOT use llx_societe to filter by company - use the entity IDs directly
          3. Each record in the tables has an 'entity' column that corresponds to the company IDs above
          4. When user mentions a store/company name, use the corresponding entity ID
          
          Examples:
          - For SKETCH CASA data: WHERE entity = 1
          - For SKETCH RABAT data: WHERE entity = 2
          - For all SKETCH stores: WHERE entity IN (1, 2, 5, 6)
          - For all COMPTA entities: WHERE entity IN (11, 12, 13)
          
          Company Groups:
          - SKETCH Stores: entities 1, 2, 5, 6 (Casa, Rabat, Tanger, Marrakech)
          - COMPTA Entities: entities 11, 12, 13 (Casa, Rabat, Tanger)
          - Special Entities: SKE (7), OUTDOORZ (8), OUTLET RABAT (10)
          
          Format your response as:
          1. Brief explanation of what the query does
          2. SQL query in a code block using \`\`\`sql
          3. Additional notes if needed
          
          Always use proper table aliases and JOIN conditions.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    return NextResponse.json({
      content: completion.choices[0].message.content
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to generate query',
        details: error instanceof Error ? error : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Add CORS headers
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 