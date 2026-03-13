interface Env {
  DB: D1Database;
}

interface TaskRow {
  id: string;
  wbs: string;
  name: string;
  start: string;
  end: string;
  duration: number;
  dependencies: string;
  parent_id: string | null;
  progress: number;
  color: string | null;
  sort_order: number;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { results } = await context.env.DB.prepare(
      'SELECT * FROM tasks ORDER BY sort_order ASC'
    ).all<TaskRow>();

    const tasks = (results || []).map((row) => ({
      id: row.id,
      wbs: row.wbs,
      name: row.name,
      start: row.start,
      end: row.end,
      duration: row.duration,
      dependencies: JSON.parse(row.dependencies),
      parentId: row.parent_id || undefined,
      progress: row.progress,
      color: row.color || undefined,
    }));

    return new Response(JSON.stringify(tasks), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const tasks = await context.request.json() as any[];

    const stmts = [
      context.env.DB.prepare('DELETE FROM tasks'),
      ...tasks.map((task, index) =>
        context.env.DB.prepare(
          `INSERT INTO tasks (id, wbs, name, start, end, duration, dependencies, parent_id, progress, color, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          task.id,
          task.wbs || '',
          task.name,
          task.start,
          task.end,
          task.duration,
          JSON.stringify(task.dependencies || []),
          task.parentId || null,
          task.progress || 0,
          task.color || null,
          index
        )
      ),
    ];

    await context.env.DB.batch(stmts);

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
