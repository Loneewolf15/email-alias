import { NextResponse } from 'next/server';
import { getAllRecentActivities, getActiveAliases } from '@/lib/simplelogin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [activities, aliases] = await Promise.all([
      getAllRecentActivities(),
      getActiveAliases()
    ]);

    const totalForwarded = aliases.reduce((acc, a) => acc + (a.nb_forward || 0), 0);
    const totalBlocked = aliases.reduce((acc, a) => acc + (a.nb_block || 0), 0);

    return NextResponse.json({
      success: true,
      destinationMailbox: 'loneewolf15@protonmail.com',
      totalForwarded,
      totalBlocked,
      count: activities.length,
      activities
    });
  } catch (error) {
    console.error('Error in /api/activities:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
