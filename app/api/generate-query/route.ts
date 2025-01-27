import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

// Initialize OpenAI with API key
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

// Define company entities
const COMPANIES = {
  1: "SKETCH CASA",
  2: "SKETCH RABAT",
  5: "SKETCH TANGER",
  6: "SKETCH MARRAKECH",
  7: "SKE",
  8: "OUTDOORZ",
  10: "OUTLET RABAT",
  11: "COMPTA_CASA",
  12: "COMPTA_RABAT",
  13: "COMPTA_TANGER"
};

// Function to fetch table structure
async function getTableStructure(tableName: string) {
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
    const tables = tablesData.data?.map((row: any) => Object.values(row)[0] as string) || [];

    // Fetch structure for relevant tables
    const relevantTables = tables.filter(table => 
      table.startsWith('llx_') && 
      (prompt.toLowerCase().includes(table) || 
       prompt.toLowerCase().includes(table.replace('llx_', '')))
    );

    let schemaInfo = '';
    for (const table of relevantTables) {
      const structure = await getTableStructure(table);
      if (structure.length > 0) {
        schemaInfo += `\nTable ${table} structure:\n`;
        schemaInfo += structure.map((col: any) => 
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
            schemaInfo += structure.map((col: any) => 
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

          Available Companies (entity IDs):
          - 1: SKETCH CASA
          - 2: SKETCH RABAT
          - 5: SKETCH TANGER
          - 6: SKETCH MARRAKECH
          - 7: SKE
          - 8: OUTDOORZ
          - 10: OUTLET RABAT
          - 11: COMPTA_CASA
          - 12: COMPTA_RABAT
          - 13: COMPTA_TANGER
          
          Database Schema Information:
          ${schemaInfo}
          
          Important notes for multi-company queries:
          - When filtering by company, ALWAYS use the 'entity' column with the specific entity ID
          - Do NOT use llx_societe to filter by company - use the entity IDs directly
          - Each record in the tables has an 'entity' column that corresponds to the company IDs above
          - Example: To get data for SKETCH CASA, use "WHERE entity = 1"
          - Example: To get data for multiple SKETCH stores, use "WHERE entity IN (1, 2, 5, 6)"
          - For accounting data, use the COMPTA entities (11, 12, 13)
          
          Company Groups:
          - SKETCH Stores: entities 1, 2, 5, 6 (Casa, Rabat, Tanger, Marrakech)
          - COMPTA Entities: entities 11, 12, 13 (Casa, Rabat, Tanger)
          - Special Entities: SKE (7), OUTDOORZ (8), OUTLET RABAT (10)
          
          Keep responses focused and format SQL queries within \`\`\`sql code blocks.
          Always explain:
          1. Which companies/entities are being queried
          2. Why those specific entity IDs were chosen
          3. Any multi-company considerations
          
          Use proper table aliases and JOIN conditions.`
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

  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to generate query',
        details: error.response?.data || error 
      },
      { status: error.status || 500 }
    );
  }
}

// Add CORS headers
export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 