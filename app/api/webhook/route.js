import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Server Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vwvsfuvdatdtjlrredvu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_L7--J6HSa9X8FLb7SVc5gQ_AYy9zngU'
);

function parseXMLTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's'));
  return match ? match[1].trim() : null;
}

// THIS IS THE CRITICAL EXPORT THAT FIXES 405 METHOD NOT ALLOWED
export async function POST(request) {
  try {
    const xmlText = await request.text();
    const msgType = parseXMLTag(xmlText, 'msg_type');
    const tranId = parseXMLTag(xmlText, 'tran_id');
    const sid = parseXMLTag(xmlText, 'sid');

    if (!msgType) {
      return NextResponse.json({ status: 'error', message: 'Missing msg_type' }, { status: 400 });
    }

    // 1. Handle outbound call notification or ringing state
    if (msgType === 'outbound_notify' || msgType === 'result') {
      await supabase.from('active_calls').upsert({
        tran_id: tranId,
        sid: sid,
        status: msgType === 'result' ? 'ANSWERED' : 'RINGING'
      }, { onConflict: 'tran_id' });
    } 
    // 2. Handle CDR (Call Completion & Logging)
    else if (msgType === 'cdr') {
      await supabase.from('call_logs').insert({
        tran_id: tranId,
        sid: sid,
        start_time: parseXMLTag(xmlText, 'start_time'),
        answer_time: parseXMLTag(xmlText, 'answer_time'),
        end_time: parseXMLTag(xmlText, 'end_time'),
        cli: parseXMLTag(xmlText, 'cli'),
        customer_number: parseXMLTag(xmlText, 'customer_number'),
        status: parseXMLTag(xmlText, 'status'),
        duration: parseInt(parseXMLTag(xmlText, 'duration') || '0', 10),
        charge: parseFloat(parseXMLTag(xmlText, 'charge') || '0.00'),
        hangup_reason: parseXMLTag(xmlText, 'hangup'),
        recording_url: parseXMLTag(xmlText, 'recording_url')
      });

      // Clear from active_calls once completed
      if (tranId) {
        await supabase.from('active_calls').delete().eq('tran_id', tranId);
      }
    }

    return NextResponse.json({ status: 'success', received_msg_type: msgType });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

// Optional: Handle GET requests so browser checks don't break
export async function GET() {
  return NextResponse.json({ status: 'active', message: 'Webhook endpoint is ready for POST requests' });
}
