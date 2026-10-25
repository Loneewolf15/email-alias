import { NextResponse } from 'next/server';
import {
  getActiveAliases as getSLAliases,
  createNameAlias as createSLAlias,
  deleteAlias as deleteSLAlias
} from '@/lib/simplelogin';
import {
  getActiveAliases as getAddyAliases,
  createNameAlias as createAddyAlias,
  deleteAlias as deleteAddyAlias
} from '@/lib/addy';
import {
  createInboxAlias
} from '@/lib/inbox';
import {
  generateNamePairs,
  loadRegistry,
  saveRegistry,
  appendHistory
} from '@/lib/names';

export const dynamic = 'force-dynamic';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const providerFilter = searchParams.get('provider') || 'all';

    const customSLKey = req.headers.get('x-simplelogin-key') || searchParams.get('slKey') || '';
    const customAddyKey = req.headers.get('x-addy-key') || searchParams.get('addyKey') || '';
    const effectiveSLKey = customSLKey || process.env.SIMPLELOGIN_API_KEY || '';
    const effectiveAddyKey = customAddyKey || process.env.ANONADDR_API_KEY || '';

    const hasSLKey = Boolean(effectiveSLKey);
    const hasAddyKey = Boolean(effectiveAddyKey);

    const [slRemote, addyRemote] = await Promise.all([
      hasSLKey ? getSLAliases(effectiveSLKey) : [],
      hasAddyKey ? getAddyAliases(effectiveAddyKey) : []
    ]);

    const localRegistry = loadRegistry();

    // Map local registry by ID and alias
    const localById = new Map();
    const localByEmail = new Map();
    for (const item of localRegistry) {
      if (item.id) localById.set(String(item.id), item);
      if (item.alias) localByEmail.set(item.alias.toLowerCase(), item);
    }

    const mergedList = [];

    // 1. In-App Direct Inbox Aliases (stored in localRegistry)
    const inboxItems = localRegistry.filter(item => item.provider === 'inbox');
    for (const item of inboxItems) {
      mergedList.push({
        id: String(item.id),
        alias: item.alias,
        full_name: item.full_name || 'Nigerian Identity',
        first_name: item.first_name || '',
        last_name: item.last_name || '',
        category: item.category || 'all',
        note: item.note || '',
        created_at: item.created_at || new Date().toISOString(),
        enabled: true,
        provider: 'inbox',
        provider_name: 'In-App Direct Inbox',
        forward_to: 'In-App Direct Reader (No forward needed)',
        can_read_body: true,
        token: item.token || item.sid_token || '',
        nb_forward: 0,
        nb_received: item.nb_received || 0
      });
    }

    // 2. SimpleLogin Aliases
    for (const remote of slRemote) {
      const idStr = String(remote.id);
      const emailLower = (remote.email || '').toLowerCase();
      const local = localById.get(idStr) || localByEmail.get(emailLower);

      mergedList.push({
        id: idStr,
        alias: remote.email,
        full_name: local?.full_name || remote.name || remote.note || 'Nigerian Identity',
        first_name: local?.first_name || '',
        last_name: local?.last_name || '',
        category: local?.category || 'nigerian',
        note: remote.note || local?.note || '',
        created_at: remote.creation_timestamp
          ? new Date(remote.creation_timestamp * 1000).toISOString()
          : (local?.created_at || new Date().toISOString()),
        enabled: remote.enabled !== false,
        provider: 'simplelogin',
        provider_name: 'SimpleLogin',
        forward_to: remote.mailboxes?.map(m => m.email).join(', ') || 'loneewolf15@protonmail.com',
        can_read_body: false,
        nb_forward: remote.nb_forward || 0,
        nb_block: remote.nb_block || 0,
        nb_reply: remote.nb_reply || 0,
      });
    }

    // 3. addy.io Aliases
    for (const remote of addyRemote) {
      const idStr = String(remote.id);
      const emailLower = (remote.email || '').toLowerCase();
      const local = localById.get(idStr) || localByEmail.get(emailLower);

      mergedList.push({
        id: idStr,
        alias: remote.email,
        full_name: local?.full_name || remote.description || 'Nigerian Identity',
        first_name: local?.first_name || '',
        last_name: local?.last_name || '',
        category: local?.category || 'nigerian',
        note: remote.description || local?.note || '',
        created_at: remote.created_at || local?.created_at || new Date().toISOString(),
        enabled: remote.active !== false,
        provider: 'addy',
        provider_name: 'addy.io',
        forward_to: 'anonymoux7x@gmail.com',
        can_read_body: false,
        nb_forward: remote.emails_forwarded || 0,
        nb_block: remote.emails_blocked || 0,
        nb_reply: remote.emails_replied || 0,
      });
    }

    // Filter by provider if specified
    const filtered = providerFilter === 'all'
      ? mergedList
      : mergedList.filter(a => a.provider === providerFilter);

    return NextResponse.json({
      aliases: filtered,
      count: filtered.length,
      totalCount: mergedList.length,
      countsByProvider: {
        inbox: mergedList.filter(a => a.provider === 'inbox').length,
        simplelogin: mergedList.filter(a => a.provider === 'simplelogin').length,
        addy: mergedList.filter(a => a.provider === 'addy').length
      }
    });
  } catch (error) {
    console.error('Error in GET /api/aliases:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      count = 1,
      category = 'all',
      label = '',
      provider = 'inbox', // 'inbox' | 'simplelogin' | 'addy' | 'auto'
      fillRemaining = false,
      simpleloginKey = '',
      addyKey = '',
      profileId = '',
      profileName = ''
    } = body;

    const customSLKey = req.headers.get('x-simplelogin-key') || simpleloginKey || '';
    const customAddyKey = req.headers.get('x-addy-key') || addyKey || '';
    const effectiveSLKey = customSLKey || process.env.SIMPLELOGIN_API_KEY || '';
    const effectiveAddyKey = customAddyKey || process.env.ANONADDR_API_KEY || '';
    const effectiveProfileName = req.headers.get('x-profile-name') || profileName || '';

    const requestedCount = Math.max(1, parseInt(count, 10) || 1);

    // Validate provider API keys early with helpful messages for Vercel users
    if (provider === 'simplelogin' && !effectiveSLKey) {
      return NextResponse.json({
        success: false,
        error: 'SimpleLogin API key is missing. Set your key in User Profiles (top bar) or in Vercel Environment Variables.'
      }, { status: 400 });
    }

    if (provider === 'addy' && !effectiveAddyKey) {
      return NextResponse.json({
        success: false,
        error: 'addy.io API key is missing. Set your key in User Profiles (top bar) or in Vercel Environment Variables.'
      }, { status: 400 });
    }

    const pairs = generateNamePairs(requestedCount, category);

    const createdItems = [];
    const errors = [];
    let hitRateLimit = false;

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const noteText = label ? `${label} - ${pair.fullName}` : pair.fullName;

      let result = null;

      // PROVIDER: In-App Direct Inbox
      if (provider === 'inbox') {
        result = await createInboxAlias({
          firstName: pair.firstName,
          lastName: pair.lastName,
          fullName: pair.fullName,
          note: noteText
        });
      }
      // PROVIDER: SimpleLogin
      else if (provider === 'simplelogin') {
        result = await createSLAlias({
          firstName: pair.firstName,
          lastName: pair.lastName,
          fullName: pair.fullName,
          note: noteText
        }, effectiveSLKey);
      }
      // PROVIDER: addy.io
      else if (provider === 'addy') {
        result = await createAddyAlias({
          firstName: pair.firstName,
          lastName: pair.lastName,
          fullName: pair.fullName,
          note: noteText
        }, effectiveAddyKey);
      }
      // PROVIDER: Auto (Inbox first for guaranteed zero limit & direct body read)
      else {
        result = await createInboxAlias({
          firstName: pair.firstName,
          lastName: pair.lastName,
          fullName: pair.fullName,
          note: noteText
        });
      }

      if (result && result.success) {
        const item = {
          id: String(result.id),
          alias: result.alias,
          full_name: pair.fullName,
          first_name: pair.firstName,
          last_name: pair.lastName,
          category: category,
          note: noteText,
          created_at: new Date().toISOString(),
          provider: result.provider || provider,
          token: result.token || result.sid_token || '',
          profile_id: profileId || '',
          profile_name: effectiveProfileName || ''
        };
        createdItems.push(item);
      } else {
        errors.push({
          name: pair.fullName,
          error: result?.error || 'Failed to create alias'
        });

        if (result?.isRateLimit) {
          hitRateLimit = true;
          break;
        }
      }

      if (i < pairs.length - 1) {
        await sleep(provider === 'inbox' ? 200 : 800);
      }
    }

    if (createdItems.length === 0) {
      return NextResponse.json({
        success: false,
        createdCount: 0,
        requestedCount: requestedCount,
        errors: errors,
        error: errors[0]?.error || `Failed to create aliases on ${provider.toUpperCase()}`
      }, { status: 400 });
    }

    if (createdItems.length > 0) {
      const currentRegistry = loadRegistry();
      const updatedRegistry = [
        ...currentRegistry.filter(r => !createdItems.some(c => c.id === r.id)),
        ...createdItems
      ];
      saveRegistry(updatedRegistry);
      appendHistory(createdItems);
    }

    return NextResponse.json({
      success: createdItems.length > 0,
      created: createdItems,
      createdCount: createdItems.length,
      requestedCount: requestedCount,
      provider: provider,
      profile: effectiveProfileName,
      errors: errors,
      hitRateLimit: hitRateLimit,
      message: hitRateLimit
        ? `Created ${createdItems.length} alias(es). Rate limit reached on provider. Please wait 60s.`
        : `Successfully created ${createdItems.length} alias(es) on ${provider.toUpperCase()}.`
    });
  } catch (error) {
    console.error('Error in POST /api/aliases:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const deleteId = searchParams.get('id');
    const targetProvider = searchParams.get('provider');
    const deleteAll = searchParams.get('all') === 'true';

    let body = {};
    try {
      body = await req.json();
    } catch (e) {}

    const customSLKey = req.headers.get('x-simplelogin-key') || body.slKey || '';
    const customAddyKey = req.headers.get('x-addy-key') || body.addyKey || '';
    const effectiveSLKey = customSLKey || process.env.SIMPLELOGIN_API_KEY || '';
    const effectiveAddyKey = customAddyKey || process.env.ANONADDR_API_KEY || '';

    const isAll = deleteAll || body.all === true;
    const targetId = deleteId || body.id;
    const provider = targetProvider || body.provider || 'all';

    const localRegistry = loadRegistry();

    // Handle Delete All
    if (isAll) {
      let deletedCount = 0;
      const errors = [];

      // 1. Delete all SimpleLogin if matching
      if (provider === 'all' || provider === 'simplelogin') {
        const slRemote = await getSLAliases(effectiveSLKey);
        for (const alias of slRemote) {
          const ok = await deleteSLAlias(alias.id, effectiveSLKey);
          if (ok) deletedCount++;
          else errors.push(`SimpleLogin ${alias.email}`);
          await sleep(200);
        }
      }

      // 2. Delete all addy.io if matching
      if (provider === 'all' || provider === 'addy') {
        const addyRemote = await getAddyAliases(effectiveAddyKey);
        for (const alias of addyRemote) {
          const ok = await deleteAddyAlias(alias.id, effectiveAddyKey);
          if (ok) deletedCount++;
          else errors.push(`addy.io ${alias.email}`);
          await sleep(200);
        }
      }

      // 3. Clear from local registry
      const remainingLocal = provider === 'all'
        ? []
        : localRegistry.filter(r => r.provider !== provider);

      if (provider === 'inbox' || provider === 'all') {
        const inboxCount = localRegistry.filter(r => r.provider === 'inbox').length;
        deletedCount += inboxCount;
      }

      saveRegistry(remainingLocal);

      return NextResponse.json({
        success: true,
        deletedCount,
        errors,
        message: `Deleted ${deletedCount} alias(es). Slots freed up!`
      });
    }

    // Handle Delete Single
    if (!targetId) {
      return NextResponse.json({ error: 'Missing alias id' }, { status: 400 });
    }

    const item = localRegistry.find(r => String(r.id) === String(targetId));
    const itemProvider = item?.provider || provider;

    if (itemProvider === 'simplelogin') {
      await deleteSLAlias(targetId, effectiveSLKey);
    } else if (itemProvider === 'addy') {
      await deleteAddyAlias(targetId, effectiveAddyKey);
    }

    // Always remove from local registry
    const updated = localRegistry.filter(r => String(r.id) !== String(targetId));
    saveRegistry(updated);

    return NextResponse.json({
      success: true,
      deletedId: targetId,
      message: 'Alias deleted successfully.'
    });
  } catch (error) {
    console.error('Error in DELETE /api/aliases:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
