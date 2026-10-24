import { NextResponse } from 'next/server';
import { loadHistory } from '@/lib/names';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format');
    const history = loadHistory();

    if (format === 'csv') {
      const headers = ['Full Name', 'Email Alias', 'Category', 'Created At', 'ID'];
      const rows = history.map(h => [
        `"${(h.full_name || '').replace(/"/g, '""')}"`,
        `"${(h.alias || '').replace(/"/g, '""')}"`,
        `"${(h.category || '').replace(/"/g, '""')}"`,
        `"${(h.created_at || '').replace(/"/g, '""')}"`,
        `"${(h.id || '').replace(/"/g, '""')}"`
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="nigerian_aliases_history_${new Date().toISOString().slice(0, 10)}.csv"`
        }
      });
    }

    return NextResponse.json({
      success: true,
      count: history.length,
      history: history.slice().reverse() // newest first
    });
  } catch (error) {
    console.error('Error in /api/history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
