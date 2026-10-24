import { NextResponse } from 'next/server';
import { getUserInfo, getActiveAliases } from '@/lib/simplelogin';
import { loadHistory, loadRegistry, getPoolsByCategory } from '@/lib/names';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const hasKey = Boolean(process.env.SIMPLELOGIN_API_KEY);
    const userInfo = hasKey ? await getUserInfo() : null;
    const activeRemoteAliases = hasKey ? await getActiveAliases() : [];
    const localRegistry = loadRegistry();
    const history = loadHistory();
    const pools = getPoolsByCategory('all');

    const isConnected = Boolean(userInfo && !userInfo.error && userInfo.email);
    const quotaMax = userInfo?.is_premium ? 10000 : (userInfo?.max_alias_free_plan || 10);
    const activeCount = isConnected ? activeRemoteAliases.length : localRegistry.length;

    return NextResponse.json({
      status: 'ok',
      hasApiKey: hasKey,
      connected: isConnected,
      account: {
        email: userInfo?.email || 'Not connected',
        name: userInfo?.name || '',
        isPremium: userInfo?.is_premium || false,
        quotaMax: quotaMax,
        activeCount: activeCount,
        availableSlots: Math.max(0, quotaMax - activeCount),
        inDirectory: userInfo?.in_directory || false,
      },
      stats: {
        totalHistoricalCreated: history.length,
        localActiveRegistry: localRegistry.length,
        namePools: {
          commonFirst: pools.counts.commonFirst,
          commonLast: pools.counts.commonLast,
          yorubaFirst: pools.counts.yorubaFirst,
          igboFirst: pools.counts.igboFirst,
          igboLast: pools.counts.igboLast,
          edoNames: pools.counts.edoNames,
          totalFirstNames: pools.counts.totalFirst,
          totalLastNames: pools.counts.totalLast,
          uniqueCombinations: pools.counts.totalFirst * pools.counts.totalLast
        }
      }
    });
  } catch (error) {
    console.error('Error in /api/status:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
