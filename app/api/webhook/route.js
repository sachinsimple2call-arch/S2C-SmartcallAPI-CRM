import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

// Helper function to extract values from incoming SmartCall XML tags
function parseXMLTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's'));
  return match ? match[1].trim() : null;
}

export async function POST(request) {
  try {
    // 1. Read the raw incoming XML text body from SmartCall
    const xmlText = await request.text();
    
    // 2. Extract key fields from the XML payload
    const msgType = parseXMLTag(xmlText, 'msg_type');
    const tranId = parseXMLTag(xmlText, 'tran_id');
    const sid = parseXMLTag(xmlText, 'sid');

    if (!msgType) {
      return NextResponse.json({ status: 'error', message: 'Invalid or missing msg_type in XML' }, { status: 400 });
    }

    // 3. Handle outbound_notify event
    if (msgType === 'outbound_notify') {
      await supabase.from('active_calls').upsert({
        tran_id: tranId,
        sid: sid,
        agent_number: parseXMLTag(xmlText, 'cli'),
        customer_number: parseXMLTag(xmlText, 'dnis'),
        status: 'RINGING',
        start_time: new Date()
      }, { onConflict: 'tran_id' });
    } 
    // 4. Handle result event (Call Answered / Ringing updates)
    else if (msgType === 'result') {
      const answered = parseXMLTag(xmlText, 'answered');
      if (answered === '1') {
        await supabase.from('active_calls').update({
          status: 'ANSWERED',
          answer_time: parseXMLTag(xmlText, 'when') || new Date()
        }).eq('tran_id', tranId);
      }
    } 
    // 5. Handle cdr event (Call Completion & Logging)
    else if (msgType === 'cdr') {
      await supabase.from('call_logs').insert({
        tran_id: tranId,
        sid: sid,
        start_time: parseXMLTag(xmlText, 'start_time'),
        answer_time: parseXMLTag(xmlText, 'answer_time'),
        end_time: parseXMLTag(xmlText, 'end_time'),
        cli: parseXMLTag(xmlText, 'cli'),
        dnis: parseXMLTag(xmlText, 'dnis'),
        customer_number: parseXMLTag(xmlText, 'customer_number'),
        agent_number: parseXMLTag(xmlText, 'agent_number'),
        status: parseXMLTag(xmlText, 'status'),
        duration: parseInt(parseXMLTag(xmlText, 'duration') || '0', 10),
        charge: parseFloat(parseXMLTag(xmlText, 'charge') || '0.00'),
        hangup_reason: parseXMLTag(xmlText, 'hangup'),
        recording_url: parseXMLTag(xmlText, 'recording_url')
      });

      // Remove from active calls when finished
      if (tranId) {
        await supabase.from('active_calls').delete().eq('tran_id', tranId);
      }
    }

    return NextResponse.json({ status: 'success', received_msg_type: msgType });
  } catch (error) {
    console.error('XML Webhook Parsing Error:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
