import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vwvsfuvdatdtjlrredvu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_L7--J6HSa9X8FLb7SVc5gQ_AYy9zngU'
);

function parseXMLTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's'));
  return match ? match[1].trim() : null;
}

export async function POST(request) {
  try {
    const xmlText = await request.text();
    console.log('Incoming Webhook XML:', xmlText);

    const msgType = parseXMLTag(xmlText, 'msg_type');
    const tranId = parseXMLTag(xmlText, 'tran_id');
    const sid = parseXMLTag(xmlText, 'sid');
    const accessNumber = parseXMLTag(xmlText, 'access_number');

    if (!msgType) {
      return NextResponse.json({ status: 'error', message: 'Missing msg_type' }, { status: 400 });
    }

    // Handle all active call progression states and test results
    if (
      msgType === 'outbound_notify' || 
      msgType === 'result' || 
      msgType === 'agent_call_customer.ack' || 
      msgType === 'ringing' || 
      msgType === 'answer'
    ) {
      if (tranId) {
        const { data, error } = await supabase.from('active_calls').upsert({
          tran_id: tranId,
          sid: sid || null,
          access_number: accessNumber || null,
          status: msgType === 'result' || msgType === 'answer' ? 'ANSWERED' : 'RINGING'
        }, { onConflict: 'tran_id' });

        if (error) {
          console.error('Supabase active_calls upsert failed:', error);
          return NextResponse.json({ status: 'db_error', details: error.message }, { status: 500 });
        }
      }
    } 
    else if (msgType === 'cdr' || msgType === 'hangup') {
      const { error } = await supabase.from('call_logs').insert({
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
        hangup_reason: parseXMLTag(xmlText, 'hangup') || parseXMLTag(xmlText, 'hangup_reason'),
        recording_url: parseXMLTag(xmlText, 'recording_url')
      });

      if (error) {
        console.error('Supabase call_logs insert failed:', error);
      }

      if (tranId) {
        await supabase.from('active_calls').delete().eq('tran_id', tranId);
      }
    }

    return NextResponse.json({ status: 'success', received_msg_type: msgType });
  } catch (error) {
    console.error('Webhook Fatal Error:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'active', message: 'Webhook endpoint is online and accepting POST requests' });
}
