import { NextResponse } from 'next/server';
import { getUserInfo, getActiveAliases as getSLAliases } from '@/lib/simplelogin';
import { getAccountDetails as getAddyAccount, getActiveAliases as getAddyAliases } from '@/lib/addy';
import { loadHistory, loadRegistry, getPoolsByCategory } from '@/lib/names';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const customSLKey = req.headers.get('x-simplelogin-key') || '';
    const customAddyKey = req.headers.get('x-addy-key') || '';

    const effectiveSLKey = customSLKey || process.env.SIMPLELOGIN_API_KEY || '';
    const effectiveAddyKey = customAddyKey || process.env.ANONADDR_API_KEY || '';

    const hasSLKey = Boolean(effectiveSLKey);
    const hasAddyKey = Boolean(effectiveAddyKey);

    const [slUser, slAliases, addyAccount, addyAliases] = await Promise.all([
      hasSLKey ? getUserInfo(effectiveSLKey) : null,
      hasSLKey ? getSLAliases(effectiveSLKey) : [],
      hasAddyKey ? getAddyAccount(effectiveAddyKey) : null,
      hasAddyKey ? getAddyAliases(effectiveAddyKey) : []
    ]);

    const localRegistry = loadRegistry();
    const history = loadHistory();
    const pools = getPoolsByCategory('all');

    // Local breakdown by provider
    const inboxLocal = localRegistry.filter(a => a.provider === 'inbox');
    const slLocal = localRegistry.filter(a => a.provider === 'simplelogin' || !a.provider);
    const addyLocal = localRegistry.filter(a => a.provider === 'addy');

    // SimpleLogin metrics
    const slConnected = Boolean(slUser && !slUser.error && slUser.email);
    const slQuotaMax = slUser?.is_premium ? 10000 : (slUser?.max_alias_free_plan || 10);
    const slActiveCount = slConnected ? slAliases.length : slLocal.length;
    const slAvailableSlots = Math.max(0, slQuotaMax - slActiveCount);

    // addy.io metrics
    const addyConnected = Boolean(addyAccount && addyAccount.username);
    const addySharedLimit = addyAccount?.active_shared_domain_alias_limit || 10;
    const addyActiveCount = addyConnected ? addyAliases.length : addyLocal.length;
    const addyAvailableSlots = Math.max(0, 20 - addyActiveCount);

    // In-App Inbox metrics (Zero domain, direct body read, unlimited)
    const inboxActiveCount = inboxLocal.length;

    // Combined metrics
    const totalActiveAliases = slActiveCount + addyActiveCount + inboxActiveCount;

    return NextResponse.json({
      status: 'ok',
      providers: {
        inbox: {
          name: 'Direct In-App Inbox',
          type: 'in-app',
          connected: true,
          activeCount: inboxActiveCount,
          availableSlots: 999,
          canReadFullBody: true,
          requiresCustomDomain: false,
          description: 'Instant Nigerian inboxes with full HTML/plaintext message reader directly on this dashboard.'
        },
        simplelogin: {
          name: 'SimpleLogin',
          type: 'relay',
          hasKey: hasSLKey,
          connected: slConnected,
          email: slUser?.email || 'loneewolf15@protonmail.com',
          destinationMailbox: 'loneewolf15@protonmail.com',
          activeCount: slActiveCount,
          quotaMax: slQuotaMax,
          availableSlots: slAvailableSlots,
          canReadFullBody: false,
          requiresCustomDomain: false
        },
        addy: {
          name: 'addy.io (AnonAddy)',
          type: 'relay',
          hasKey: hasAddyKey,
          connected: addyConnected,
          username: addyAccount?.username || 'uniben',
          destinationMailbox: 'anonymoux7x@gmail.com',
          activeCount: addyActiveCount,
          sharedDomainLimit: addySharedLimit,
          totalLimit: 20,
          availableSlots: addyAvailableSlots,
          canReadFullBody: false,
          requiresCustomDomain: false
        }
      },
      combined: {
        totalActiveCount: totalActiveAliases,
        totalHistoricalCreated: history.length,
        inboxCount: inboxActiveCount,
        simpleloginCount: slActiveCount,
        addyCount: addyActiveCount
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
