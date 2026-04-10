const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Helper function to format Evolution URL
const formatEvolutionUrl = (url) => {
  if (!url) return '';
  let formatted = url.trim().replace(/\/$/, '');
  if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
    formatted = 'https://' + formatted;
  }
  return formatted;
};

// GET: Fetch Evolution Configuration
router.get('/config', authMiddleware, async (req, res) => {
  try {
    let settings = await prisma.clinicSettings.findFirst();
    if (!settings) {
      settings = await prisma.clinicSettings.create({ data: {} });
    }
    res.json({
      evolutionApiUrl: settings.evolutionApiUrl || '',
      evolutionApiKey: settings.evolutionApiKey || '',
      evolutionInstanceName: settings.evolutionInstanceName || ''
    });
  } catch (err) {
    console.error('Error fetching Evolution config:', err);
    res.status(500).json({ error: 'خطأ في الخادم أثناء جلب الإعدادات' });
  }
});

// POST: Save Evolution Configuration
router.post('/config', authMiddleware, async (req, res) => {
  try {
    const { evolutionApiUrl, evolutionApiKey, evolutionInstanceName } = req.body;
    let settings = await prisma.clinicSettings.findFirst();
    
    if (!settings) {
      settings = await prisma.clinicSettings.create({ data: {} });
    }

    const updated = await prisma.clinicSettings.update({
      where: { id: settings.id },
      data: {
        evolutionApiUrl: formatEvolutionUrl(evolutionApiUrl),
        evolutionApiKey,
        evolutionInstanceName
      }
    });

    res.json({
      success: true,
      evolutionApiUrl: updated.evolutionApiUrl,
      evolutionApiKey: updated.evolutionApiKey,
      evolutionInstanceName: updated.evolutionInstanceName
    });
  } catch (err) {
    console.error('Error saving Evolution config:', err);
    res.status(500).json({ error: 'خطأ في حفظ الإعدادات' });
  }
});

// GET: Check Connection Status
router.get('/instance/status', authMiddleware, async (req, res) => {
  try {
    const settings = await prisma.clinicSettings.findFirst();
    if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
      return res.status(400).json({ error: 'إعدادات EvolutionAPI غير مكتملة' });
    }

    let evolutionUrl = settings.evolutionApiUrl;
    if (!evolutionUrl.startsWith('http')) {
      evolutionUrl = 'https://' + evolutionUrl;
    }
    const globalApiKey = settings.evolutionApiKey;
    const instanceName = settings.evolutionInstanceName;

    // Check instance connection state
    const response = await fetch(`${evolutionUrl}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': globalApiKey
      }
    });

    if (!response.ok) {
       // If instance not found, it returns 404
       if (response.status === 404) {
         return res.json({ state: 'close', statusReason: 'Instance not found' });
       }
       throw new Error(`Evolution API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // data.instance.state => "open", "close", "connecting"
    res.json({
      state: data?.instance?.state || 'close',
      statusReason: data?.instance?.statusReason || ''
    });

  } catch (err) {
    console.error('Error checking instance status:', err);
    res.status(500).json({ error: 'فشل الاتصال بـ EvolutionAPI', details: err.message });
  }
});

// POST: Create Instance / Generate QR Code
router.post('/instance/create', authMiddleware, async (req, res) => {
  try {
    const settings = await prisma.clinicSettings.findFirst();
    if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
      return res.status(400).json({ error: 'إعدادات EvolutionAPI غير مكتملة' });
    }

    let evolutionUrl = settings.evolutionApiUrl;
    if (!evolutionUrl.startsWith('http')) {
      evolutionUrl = 'https://' + evolutionUrl;
    }
    const globalApiKey = settings.evolutionApiKey;
    const instanceName = settings.evolutionInstanceName;

    // Call evolution API to create or fetch instance
    const response = await fetch(`${evolutionUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': globalApiKey
      },
      body: JSON.stringify({
        instanceName: instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      })
    });

    const data = await response.json();
    if (!response.ok) {
        // sometimes 403 means instance already exists, but for evolution it might be ok.
        throw new Error(data.message || 'Error creating instance');
    }

    res.json({
      qrcode: data.qrcode?.base64 || '',
      state: data.instance?.status || 'connecting'
    });

  } catch (err) {
    console.error('Error creating instance:', err);
    // If instance already exists, we could try to fetch just the QR code
    try {
        const settings = await prisma.clinicSettings.findFirst();
        let fallbackUrl = settings.evolutionApiUrl;
        if (!fallbackUrl.startsWith('http')) fallbackUrl = 'https://' + fallbackUrl;
        const response2 = await fetch(`${fallbackUrl}/instance/connect/${settings.evolutionInstanceName}`, {
            method: 'GET',
            headers: {
                'apikey': settings.evolutionApiKey
            }
        });
        const data2 = await response2.json();
        return res.json({
            qrcode: data2.base64 || '',
            state: 'qr_pending'
        });
    } catch(err2) {
        res.status(500).json({ error: 'فشل في إنشاء الجلسة أو جلب رمز الاستجابة السريعة', details: err.message });
    }
  }
});

// DELETE: Logout Instance
router.delete('/instance/logout', authMiddleware, async (req, res) => {
  try {
    const settings = await prisma.clinicSettings.findFirst();
    if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
      return res.status(400).json({ error: 'إعدادات EvolutionAPI غير مكتملة' });
    }

    let evolutionUrl = settings.evolutionApiUrl;
    if (!evolutionUrl.startsWith('http')) {
      evolutionUrl = 'https://' + evolutionUrl;
    }
    const globalApiKey = settings.evolutionApiKey;
    const instanceName = settings.evolutionInstanceName;

    const response = await fetch(`${evolutionUrl}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: {
        'apikey': globalApiKey
      }
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || `Evolution API Error: ${response.status}`);
    }

    res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
  } catch (err) {
    console.error('Error logging out instance:', err);
    res.status(500).json({ error: 'فشل في تسجيل الخروج من الواتساب', details: err.message });
  }
});

module.exports = router;
