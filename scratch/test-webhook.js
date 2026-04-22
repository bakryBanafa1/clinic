async function test() {
  try {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'TEST_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '123456789',
                  phone_number_id: '987654321'
                },
                contacts: [
                  {
                    profile: { name: 'Test User' },
                    wa_id: '966500000000'
                  }
                ],
                messages: [
                  {
                    from: '966500000000',
                    id: 'wamid.TEST_' + Date.now(),
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    text: { body: 'Hello this is a test message' },
                    type: 'text'
                  }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    };

    console.log('Sending webhook...');
    const res = await fetch('http://localhost:5000/api/whatsapp-cloud/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log('Status:', res.status);
    console.log('Body:', await res.text());
  } catch (err) {
    console.error(err);
  }
}

test();
