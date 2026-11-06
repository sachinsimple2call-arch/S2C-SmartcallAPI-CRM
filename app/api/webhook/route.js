import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient'; // Adjusted relative path

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let bodyData = {};

    if (contentType.includes('application/json')) {
      bodyData = await request.json();
    } else {
      // Handle form-urlencoded or XML payload text conversion
      const text = await request.text();
      // Basic fallback parser if gateway sends XML/Form strings
      bodyData = { raw_payload: text };
    }

    const msgType = bodyData.msg_type || 'unknown';
    const tranId = bodyData.tran_id;
    const sid = bodyData.sid;

    // Handle different SmartCall event types
    if (msgType === 'outbound_notify') {
      await supabase.from('active_calls').upsert({
        tran_id: tranId,
        sid: sid,
        agent_number: bodyData.cli,
        customer_number: bodyData.dnis,
        status: 'RINGING',
        start_time: new Date()
      }, { onConflict: 'tran_id' });
    } 
    else if (msgType === 'result' && bodyData.answered == '1') {
      await supabase.from('active_calls').update({
        status: 'ANSWERED',
        answer_time: new Date()
      }).eq('tran_id', tranId);
    } 
    else if (msgType === 'cdr') {
      // Insert into call logs and remove from active calls
      await supabase.from('call_logs').insert({
        tran_id: tranId,
        sid: sid,
        start_time: bodyData.start_time,
        answer_time: bodyData.answer_time,
        end_time: bodyData.end_time,
        cli: bodyData.cli,
        dnis: bodyData.dnis,
        customer_number: bodyData.customer_number,
        agent_number: bodyData.agent_number,
        status: bodyData.status,
        duration: parseInt(bodyData.duration || 0),
        charge: parseFloat(bodyData.charge || 0),
        hangup_reason: bodyData.hangup,
        recording_url: bodyData.recording_url
      });

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
