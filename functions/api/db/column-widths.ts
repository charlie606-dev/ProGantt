interface Env {
  DB: D1Database;
}

interface ColumnWidthsRow {
  id: string;
  wbs: number;
  name: number;
  start: number;
  end: number;
  duration: number;
  action: number;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const row = await context.env.DB.prepare(
      "SELECT * FROM column_widths WHERE id = 'default'"
    ).first<ColumnWidthsRow>();

    if (!row) {
      return new Response(
        JSON.stringify({ wbs: 60, name: 200, start: 100, end: 100, duration: 60, action: 80 }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        wbs: row.wbs,
        name: row.name,
        start: row.start,
        end: row.end,
        duration: row.duration,
        action: row.action,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const widths = await context.request.json() as any;

    await context.env.DB.prepare(
      `INSERT OR REPLACE INTO column_widths (id, wbs, name, start, end, duration, action)
       VALUES ('default', ?, ?, ?, ?, ?, ?)`
    )
      .bind(widths.wbs, widths.name, widths.start, widths.end, widths.duration, widths.action)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
