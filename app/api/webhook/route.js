import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

function parseXMLTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's'));
  return match ? match[1].trim() : null;
}

export async function POST(request) {
  try {
    const xmlText = await request.text();
    const msgType = parseXMLTag(xmlText, 'msg_type');
    const tranId = parseXMLTag(xmlText, 'tran_id');
    const sid = parseXMLTag(xmlText, 'sid');

    if (!msgType) {
      return NextResponse.json({ status: 'error', message: 'Missing msg_type' }, { status: 400 });
    }

    // When call rings, store both tran_id and sid in active_calls
    if (msgType === 'outbound_notify') {
      await supabase.from('active_calls').upsert({
        tran_id: tranId,
        sid: sid,
        agent_number: parseXMLTag(xmlText, 'cli'),
        customer_number: parseXMLTag(xmlText, 'dnis'),
        status: 'RINGING'
      }, { onConflict: 'tran_id' });
    } 
    else if (msgType === 'result') {
      const answered = parseXMLTag(xmlText, 'answered');
      if (answered === '1') {
        await supabase.from('active_calls').update({ status: 'ANSWERED' }).eq('tran_id', tranId);
      }
    } 
    else if (msgType === 'cdr') {
      // Archive to call_logs table
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

      // Remove from active calls when finished
      if (tranId) {
        await supabase.from('active_calls').delete().eq('tran_id', tranId);
      }
    }

    return NextResponse.json({ status: 'success', received_msg_type: msgType });
  } catch (error) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
