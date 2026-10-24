import { NextResponse } from 'next/server';
import { generateNamePairs } from '@/lib/names';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const count = Math.min(Math.max(parseInt(searchParams.get('count') || '10', 10), 1), 50);
    const category = searchParams.get('category') || 'all';

    const pairs = generateNamePairs(count, category);
    return NextResponse.json({
      success: true,
      category,
      count: pairs.length,
      pairs: pairs.map((p, idx) => ({
        index: idx + 1,
        fullName: p.fullName,
        firstName: p.firstName,
        lastName: p.lastName,
        suggestedEmail: `${p.suggestedPrefix}@slmails.com`,
        category: p.category
      }))
    });
  } catch (error) {
    console.error('Error in /api/preview:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
