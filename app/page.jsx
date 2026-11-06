'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function CTIConsole() {
  const [apiUrl, setApiUrl] = useState('https://conference.simple2call.in/ab_api.php');
  const [un, setUn] = useState('sachin_admin');
  const [pw, setPw] = useState('Ashu@7979');
  const [svr, setSvr] = useState('conference.simple2call.in');
  const [sbTag, setSbTag] = useState('TestTag');
  
  const [cli, setCli] = useState('918452080008');
  const [customerPhone, setCustomerPhone] = useState('916359115000');
  const [customerName, setCustomerName] = useState('Mittal Patel');
  
  const [activeTranId, setActiveTranId] = useState('');
  const [callStatus, setCallStatus] = useState('IDLE');
  
  const [thirdPartyCli, setThirdPartyCli] = useState('13216930000');
  const [thirdPartyDigits, setThirdPartyDigits] = useState('19084444455');

  const [logs, setLogs] = useState('');
  const [callHistory, setCallHistory] = useState([]);

  useEffect(() => {
    fetchCallHistory();
    const subscription = supabase
      .channel('public:call_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_logs' }, payload => {
        setCallHistory(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  async function fetchCallHistory() {
    const { data } = await supabase.from('call_logs').select('*').order('created_at', { ascending: false }).limit(10);
    if (data) setCallHistory(data);
  }

  function generateTranId() {
    return 'NP' + Math.random().toString(36).substring(2, 8) + Date.now().toString().slice(-4);
  }

  const logAction = (action, data) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => `[${time}] ${action}\n` + JSON.stringify(data, null, 2) + "\n\n" + prev);
  };

  async function handleAgentCallCustomer() {
    const tranId = generateTranId();
    setActiveTranId(tranId);
    setCallStatus('INITIATED');

    const payload = {
      msg_type: "agent_call_customer",
      tran_id: tranId,
      un, pw, svr,
      sb_tag: sbTag,
      routed_name: "NeerajDemo",
      cli,
      hold_duration: 120,
      dest_count: 1,
      digits_1: customerPhone,
      name_1: customerName
    };

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      logAction("agent_call_customer", data);
      if(data.result === 200) setCallStatus('RINGING');
    } catch (err) {
      logAction("agent_call_customer ERROR", { error: err.message });
    }
  }

  async function sendControlCommand(commandName) {
    if (!activeTranId) {
      alert("No active Transaction ID (tran_id) found!");
      return;
    }

    const payload = {
      msg_type: "control",
      tran_id: activeTranId,
      un, pw, svr,
      command: commandName
    };

    if (commandName === 'Dial3rdParty') {
      payload.cli = thirdPartyCli;
      payload.digits = thirdPartyDigits;
    }

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      logAction(`control [${commandName}]`, data);

      if (commandName === 'Hangup' && data.result === 200) {
        setCallStatus('ENDED');
        setActiveTranId('');
      }
    } catch (err) {
      logAction(`control [${commandName}] ERROR`, { error: err.message });
    }
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', background: '#f4f6f9', minHeight: '100vh' }}>
      <h1>Simple2Call CTI & CRM Web Console</h1>
      
      <div style={{ background: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
        <div><label>API URL</label><input value={apiUrl} onChange={e => setApiUrl(e.target.value)} style={{width:'100%'}} /></div>
        <div><label>Username</label><input value={un} onChange={e => setUn(e.target.value)} style={{width:'100%'}} /></div>
        <div><label>Password</label><input type="password" value={pw} onChange={e => setPw(e.target.value)} style={{width:'100%'}} /></div>
        <div><label>Server</label><input value={svr} onChange={e => setSvr(e.target.value)} style={{width:'100%'}} /></div>
        <div><label>Sub-Tag</label><input value={sbTag} onChange={e => setSbTag(e.target.value)} style={{width:'100%'}} /></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <h2>1. Click-to-Call Dialer</h2>
            <div style={{ marginBottom: '10px' }}><label>Agent Number (CLI)</label><input value={cli} onChange={e => setCli(e.target.value)} style={{width:'100%'}} /></div>
            <div style={{ marginBottom: '10px' }}><label>Customer Phone (digits_1)</label><input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} style={{width:'100%'}} /></div>
            <div style={{ marginBottom: '15px' }}><label>Customer Name</label><input value={customerName} onChange={e => setCustomerName(e.target.value)} style={{width:'100%'}} /></div>
            <button onClick={handleAgentCallCustomer} style={{ background: '#28a745', color: '#fff', padding: '12px', width: '100%', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Initiate Call</button>
          </div>

          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px' }}>
            <h2>2. Active Call Control Panel</h2>
            <div style={{ background: '#fff3cd', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>
              <strong>Active Tran ID: </strong> 
              <input value={activeTranId} onChange={e => setActiveTranId(e.target.value)} placeholder="Auto-synced or paste tran_id" style={{width: '100%', marginTop: '5px'}} />
              <small>Status: <b>{callStatus}</b></small>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
              <button onClick={() => sendControlCommand('HoldOn')} style={{background:'#ffc107', padding:'10px', border:'none', borderRadius:'4px', cursor:'pointer'}}>Hold On</button>
              <button onClick={() => sendControlCommand('HoldOff')} style={{background:'#28a745', color:'#fff', padding:'10px', border:'none', borderRadius:'4px', cursor:'pointer'}}>Hold Off</button>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <input placeholder="3rd Party CLI" value={thirdPartyCli} onChange={e => setThirdPartyCli(e.target.value)} style={{width:'48%', marginRight:'4%'}} />
              <input placeholder="3rd Party Digits" value={thirdPartyDigits} onChange={e => setThirdPartyDigits(e.target.value)} style={{width:'48%'}} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
              <button onClick={() => sendControlCommand('Dial3rdParty')} style={{padding:'10px', background:'#0056b3', color:'#fff', border:'none', borderRadius:'4px'}}>Dial 3rd Party</button>
              <button onClick={() => sendControlCommand('3Way')} style={{padding:'10px', background:'#17a2b8', color:'#fff', border:'none', borderRadius:'4px'}}>Bridge 3-Way</button>
              <button onClick={() => sendControlCommand('Disconnect3rdParty')} style={{padding:'10px', background:'#ffc107', border:'none', borderRadius:'4px'}}>Drop 3rd Party</button>
              <button onClick={() => sendControlCommand('Transfer')} style={{padding:'10px', background:'#6c757d', color:'#fff', border:'none', borderRadius:'4px'}}>Transfer & Exit</button>
            </div>

            <button onClick={() => sendControlCommand('Hangup')} style={{background:'#dc3545', color:'#fff', padding:'12px', width:'100%', border:'none', borderRadius:'4px', fontWeight:'bold', cursor:'pointer'}}>Hangup Call</button>
          </div>
        </div>

        <div>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <h2>API Response Log</h2>
            <pre style={{ background: '#1e1e1e', color: '#00ff66', padding: '15px', borderRadius: '6px', height: '200px', overflowY: 'auto', fontSize: '0.8rem' }}>{logs || '// API responses will appear here...'}</pre>
          </div>

          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px' }}>
            <h2>Live Call History & Recordings (CDR)</h2>
            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#e9ecef', textAlign: 'left' }}>
                    <th style={{padding:'6px'}}>Tran ID</th>
                    <th style={{padding:'6px'}}>Customer</th>
                    <th style={{padding:'6px'}}>Duration</th>
                    <th style={{padding:'6px'}}>Recording</th>
                  </tr>
                </thead>
                <tbody>
                  {callHistory.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{padding:'6px'}}>{c.tran_id}</td>
                      <td style={{padding:'6px'}}>{c.customer_number}</td>
                      <td style={{padding:'6px'}}>{c.duration}s</td>
                      <td style={{padding:'6px'}}>{c.recording_url ? <a href={c.recording_url} target="_blank">Listen</a> : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
