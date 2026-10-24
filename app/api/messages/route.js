import { NextResponse } from 'next/server';
import { loadRegistry } from '@/lib/names';
import { checkInboxMessages, fetchInboxMessageBody } from '@/lib/inbox';
import { getAliasActivities } from '@/lib/simplelogin';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const aliasId = searchParams.get('aliasId');
    const messageId = searchParams.get('messageId');

    const registry = loadRegistry();
    const aliasRecord = registry.find(a => String(a.id) === String(aliasId));

    if (!aliasRecord) {
      return NextResponse.json({
        error: 'Alias not found in active registry',
        aliasId
      }, { status: 404 });
    }

    // 1. In-App Direct Inbox with full body content
    if (aliasRecord.provider === 'inbox') {
      const sidToken = aliasRecord.token || aliasRecord.sid_token;
      if (!sidToken) {
        return NextResponse.json({ error: 'Missing session token for inbox alias' }, { status: 400 });
      }

      if (messageId) {
        // Fetch specific message with complete formatted body
        const fullMessage = await fetchInboxMessageBody(sidToken, messageId);
        return NextResponse.json({
          provider: 'inbox',
          alias: aliasRecord.alias,
          fullName: aliasRecord.full_name,
          message: fullMessage
        });
      }

      // Check inbox message list
      const messages = await checkInboxMessages(sidToken);
      return NextResponse.json({
        provider: 'inbox',
        alias: aliasRecord.alias,
        fullName: aliasRecord.full_name,
        messages,
        count: messages.length,
        canReadBodyDirectly: true
      });
    }

    // 2. SimpleLogin Relay Activities
    if (aliasRecord.provider === 'simplelogin' || !aliasRecord.provider) {
      const activities = await getAliasActivities(aliasId);
      return NextResponse.json({
        provider: 'simplelogin',
        alias: aliasRecord.alias,
        fullName: aliasRecord.full_name,
        activities,
        count: activities.length,
        canReadBodyDirectly: false,
        forwardDestination: 'loneewolf15@protonmail.com'
      });
    }

    // 3. addy.io
    return NextResponse.json({
      provider: 'addy',
      alias: aliasRecord.alias,
      fullName: aliasRecord.full_name,
      messages: [],
      count: 0,
      canReadBodyDirectly: false,
      forwardDestination: 'anonymoux7x@gmail.com'
    });

  } catch (err) {
    console.error('Error in /api/messages:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
