/* ============================================================
   ESSPEE ELECTRO POWER PRODUCTS – ORDER BACKEND (Email only)
   Google Apps Script — receives orders from the website and:
     1. Emails YOU the order + payment screenshot as an attachment
     2. Emails the CUSTOMER an order confirmation / receipt
     3. Saves a backup copy of the screenshot to Google Drive

   SECURITY NOTES (read this — see SECURITY-NOTES.md for full detail):
   - SHARED_SECRET blocks generic bots/scanners that crawl the internet
     for open Apps Script webhooks. It will NOT stop someone who
     specifically reads your site's public script.js file and copies the
     value — that's a hard limit of any pure client-side website, not
     something this script can fix on its own.
   - MAX_ORDERS_PER_DAY is the real backstop: even if someone gets past
     the secret, they can only trigger a small number of emails per day
     before the script refuses further requests, protecting your Gmail
     account from being used as a spam relay.
   ============================================================ */

const BUSINESS_EMAIL = 'esspeeelectropowerproducts@gmail.com';
const COMPANY_NAME   = 'ESSPEE Electro Power Products';
const COMPANY_ADDR   = '19/5, 19th Street, Balaji Nagar, Puzhuthivakkam, Chennai – 600091';
const WHATSAPP_NO    = '9025059689';

/* Must exactly match APPS_SCRIPT_SECRET in your website's script.js */
const SHARED_SECRET = '2PEsuxCJu7kO0J5G1V_yq8MlkbuUxxBZ';

/* Safety cap so a single abuser can't burn through your Gmail sending
   quota or spam other people using your account. Each order sends 2
   emails, so 40 orders/day = 80 emails/day, comfortably under Gmail's
   free daily limit. Raise this only if you're genuinely doing this much
   volume. */
const MAX_ORDERS_PER_DAY = 40;

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    /* ── 0a. Reject requests without the correct shared secret ── */
    if (data.secret !== SHARED_SECRET) {
      return jsonResponse({ success: false, error: 'Unauthorized' });
    }

    /* ── 0b. Honeypot — a hidden field real customers never fill in.
       If it has a value, this was almost certainly submitted by a bot. ── */
    if (data.website) {
      return jsonResponse({ success: false, error: 'Rejected' });
    }

    /* ── 0c. Daily rate limit ── */
    if (!withinDailyLimit()) {
      return jsonResponse({
        success: false,
        error: 'We\'ve hit today\'s order limit. Please WhatsApp us directly at ' + WHATSAPP_NO + ' to complete your order, or try again tomorrow.'
      });
    }

    const {
      name, email, phone, address, shipping, utr,
      items, totalAmount, screenshotBase64, screenshotType, screenshotName
    } = data;

    if (!name || !email || !phone || !address || !shipping || !items || !screenshotBase64) {
      return jsonResponse({ success: false, error: 'Missing required fields' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ success: false, error: 'Invalid email address' });
    }

    /* ── 1. Decode screenshot into a file ── */
    const base64Data = screenshotBase64.indexOf(',') > -1
      ? screenshotBase64.split(',')[1]
      : screenshotBase64;
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data),
      screenshotType || 'image/jpeg',
      screenshotName || ('payment_' + Date.now() + '.jpg')
    );

    /* ── 2. Save a backup copy of the screenshot to Drive ── */
    const folder = getOrCreateFolder('ESSPEE Payment Screenshots');
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const screenshotUrl = file.getUrl();

    /* ── 3. Email the business (you) with the screenshot attached ──
       All user-supplied text is HTML-escaped before going into the email
       body, so nothing typed into the form can break the email's
       formatting or inject markup. ── */
    const shippingLabel = shipping === 'chennai'
      ? 'Within Chennai (Free Delivery)'
      : 'Outside Chennai (Delivery Charge at Doorstep)';

    const safeName    = escapeHtml(name);
    const safeEmail   = escapeHtml(email);
    const safePhone   = escapeHtml(phone);
    const safeAddress = escapeHtml(address);
    const safeUtr     = utr ? escapeHtml(utr) : '';

    const itemsHtmlBiz = items.map(function (i) {
      return escapeHtml(i.name) + ' &times; ' + Number(i.qty) + ' = &#8377;' + (Number(i.price) * Number(i.qty)).toLocaleString('en-IN');
    }).join('<br>');

    MailApp.sendEmail({
      to: BUSINESS_EMAIL,
      subject: 'New Order - ' + name + ' - Rs.' + Number(totalAmount).toLocaleString('en-IN'),
      htmlBody:
        '<h2>🔴 New Order Received</h2>' +
        '<p><b>Name:</b> ' + safeName + '<br>' +
        '<b>Email:</b> ' + safeEmail + '<br>' +
        '<b>Phone:</b> ' + safePhone + '<br>' +
        '<b>Address:</b> ' + safeAddress + '<br>' +
        '<b>Shipping:</b> ' + shippingLabel + '</p>' +
        '<p><b>Items:</b><br>' + itemsHtmlBiz + '</p>' +
        '<p><b>Total:</b> &#8377;' + Number(totalAmount).toLocaleString('en-IN') + '</p>' +
        (safeUtr ? '<p><b>UTR / Ref:</b> ' + safeUtr + '</p>' : '') +
        '<p><b>Payment Screenshot:</b> attached below, and backed up here: <a href="' + screenshotUrl + '">' + screenshotUrl + '</a></p>',
      attachments: [blob]
    });

    /* ── 4. Email the customer a confirmation / receipt ── */
    const itemsHtmlCust = items.map(function (i) {
      return escapeHtml(i.name) + ' &times; ' + Number(i.qty) + ' = &#8377;' + (Number(i.price) * Number(i.qty)).toLocaleString('en-IN');
    }).join('<br>');

    MailApp.sendEmail({
      to: email,
      subject: 'Order Confirmation - ' + COMPANY_NAME,
      htmlBody:
        '<h2>Thank you for your order, ' + safeName + '!</h2>' +
        '<p>We\'ve received your order and payment confirmation. Here is your receipt:</p>' +
        '<p><b>Items:</b><br>' + itemsHtmlCust + '</p>' +
        '<p><b>Total Paid:</b> &#8377;' + Number(totalAmount).toLocaleString('en-IN') + '</p>' +
        '<p><b>Delivery Address:</b> ' + safeAddress + '</p>' +
        '<p><b>Shipping:</b> ' + shippingLabel + '</p>' +
        '<p>We will confirm and dispatch your order shortly. For any questions, WhatsApp us at <b>' + WHATSAPP_NO + '</b>.</p>' +
        '<br><p>— ' + COMPANY_NAME + '<br>' + COMPANY_ADDR + '</p>'
    });

    return jsonResponse({ success: true, screenshotUrl: screenshotUrl });

  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/* ── Helpers ── */
function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* Tracks how many orders have gone through today using Script Properties,
   which persist across executions (unlike normal variables). Resets
   automatically once the date changes. */
function withinDailyLimit() {
  const props = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const key = 'orders_' + today;
  const count = parseInt(props.getProperty(key) || '0', 10);
  if (count >= MAX_ORDERS_PER_DAY) return false;
  props.setProperty(key, String(count + 1));
  return true;
}

/* Optional: lets you test the script manually from the Apps Script editor */
function doGet(e) {
  return jsonResponse({ status: 'ESSPEE order backend is running.' });
}
