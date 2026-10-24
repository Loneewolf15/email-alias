import { NextResponse } from 'next/server';
import {
  getActiveAliases,
  createNameAlias,
  deleteAlias,
  getUserInfo
} from '@/lib/simplelogin';
import {
  generateNamePairs,
  loadRegistry,
  saveRegistry,
  appendHistory
} from '@/lib/names';

export const dynamic = 'force-dynamic';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET() {
  try {
    const remoteAliases = await getActiveAliases();
    const localRegistry = loadRegistry();

    // Map local registry by id and email for fast lookup
    const localById = new Map();
    const localByEmail = new Map();
    for (const item of localRegistry) {
      if (item.id) localById.set(String(item.id), item);
      if (item.alias) localByEmail.set(item.alias.toLowerCase(), item);
    }

    const merged = remoteAliases.map(remote => {
      const idStr = String(remote.id);
      const emailLower = (remote.email || '').toLowerCase();
      const local = localById.get(idStr) || localByEmail.get(emailLower);

      return {
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
        forward_to: remote.mailboxes?.map(m => m.email).join(', ') || 'Primary Mailbox',
        nb_forward: remote.nb_forward || 0,
        nb_block: remote.nb_block || 0,
        nb_reply: remote.nb_reply || 0,
      };
    });

    return NextResponse.json({
      aliases: merged,
      count: merged.length,
      quotaMax: 10,
      remainingSlots: Math.max(0, 10 - merged.length)
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
      fillRemaining = false
    } = body;

    const remoteAliases = await getActiveAliases();
    const currentCount = remoteAliases.length;
    const maxQuota = 10;
    const availableSlots = Math.max(0, maxQuota - currentCount);

    if (availableSlots <= 0) {
      return NextResponse.json({
        success: false,
        error: `SimpleLogin free quota full (${currentCount}/${maxQuota} active). Please delete existing aliases first to free up slots.`
      }, { status: 400 });
    }

    const targetCount = fillRemaining
      ? availableSlots
      : Math.min(parseInt(count, 10) || 1, availableSlots);

    if (targetCount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Target count must be at least 1.'
      }, { status: 400 });
    }

    // Generate historically unique name pairs
    const pairs = generateNamePairs(targetCount, category);
    const createdItems = [];
    const errors = [];
    let hitRateLimit = false;

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const noteText = label ? `${label} - ${pair.fullName}` : pair.fullName;

      const result = await createNameAlias({
        firstName: pair.firstName,
        lastName: pair.lastName,
        fullName: pair.fullName,
        note: noteText,
      });

      if (result.success) {
        const item = {
          id: String(result.id),
          alias: result.alias,
          full_name: pair.fullName,
          first_name: pair.firstName,
          last_name: pair.lastName,
          category: category,
          note: noteText,
          created_at: new Date().toISOString(),
          provider: 'simplelogin'
        };
        createdItems.push(item);
      } else {
        errors.push({
          name: pair.fullName,
          error: result.error || 'Failed to create alias'
        });

        if (result.isRateLimit) {
          hitRateLimit = true;
          // SimpleLogin imposes a 5/minute limit. Stop this batch immediately.
          break;
        }
      }

      // Small delay between calls to ease server load
      if (i < pairs.length - 1) {
        await sleep(800);
      }
    }

    // Save created items to registry and history
    if (createdItems.length > 0) {
      const currentRegistry = loadRegistry();
      // Remove any duplicate IDs before saving
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
      requestedCount: targetCount,
      errors: errors,
      hitRateLimit: hitRateLimit,
      message: hitRateLimit
        ? `Created ${createdItems.length} alias(es). Hit SimpleLogin rate limit (max 5 creations per minute). Please wait 60 seconds before generating more.`
        : `Successfully created ${createdItems.length} alias(es).`
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
    const deleteAll = searchParams.get('all') === 'true';

    let body = {};
    try {
      body = await req.json();
    } catch (e) {}

    const targetAll = deleteAll || body.all === true;
    const targetId = deleteId || body.id;

    if (targetAll) {
      // Fetch all active aliases from SimpleLogin
      const remoteAliases = await getActiveAliases();
      let deletedCount = 0;
      const errors = [];

      for (const alias of remoteAliases) {
        const ok = await deleteAlias(alias.id);
        if (ok) {
          deletedCount++;
        } else {
          errors.push(alias.email || alias.id);
        }
        await sleep(250);
      }

      // Clear local active registry (but leave history.json safe for duplicate protection!)
      saveRegistry([]);

      return NextResponse.json({
        success: true,
        deletedCount,
        errors,
        message: `Deleted ${deletedCount} active alias(es). Quota has been reset to 10 free slots! (Historical names preserved for uniqueness).`
      });
    }

    if (!targetId) {
      return NextResponse.json({ error: 'Missing alias id parameter or all=true' }, { status: 400 });
    }

    const ok = await deleteAlias(targetId);
    if (!ok) {
      return NextResponse.json({ error: `Failed to delete alias with id ${targetId} on SimpleLogin` }, { status: 500 });
    }

    // Remove from local active registry
    const currentRegistry = loadRegistry();
    const updated = currentRegistry.filter(item => String(item.id) !== String(targetId));
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
