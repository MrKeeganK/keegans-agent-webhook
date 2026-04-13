const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Health check
app.get('/', (req, res) => {
  res.send('Keegans Agent Webhook Server is running.');
});

// Vapi sends call data here when a call ends
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    // Only process end-of-call-report events
    if (body.message?.type !== 'end-of-call-report') {
      return res.status(200).json({ received: true });
    }

    const call = body.message;
    const analysis = call.analysis || {};
    const artifact = call.artifact || {};

    // Parse the structured summary Vapi collected
    const summary = analysis.summary || '';

    // Extract fields from summary text (best effort)
    const extract = (label, text) => {
      const regex = new RegExp(`${label}[:\\-]?\\s*([^\\n]+)`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : 'Not provided';
    };

    const callData = {
      caller_name:        extract('Caller name', summary),
      shop_name:          extract('Shop name', summary),
      call_reason:        extract('Reason for calling', summary),
      part_details:       extract('Part requested', summary),
      order_number:       extract('Order number', summary),
      callback_number:    extract('Callback number', summary),
      summary:            summary,
      transcript:         artifact.transcript || '',
      call_duration_seconds: Math.round(call.durationSeconds || 0),
    };

    const { error } = await supabase
      .from('Call_Logs')
      .insert([callData]);

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('Call log saved successfully');
    res.status(200).json({ received: true });

  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
