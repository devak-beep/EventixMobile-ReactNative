// ============================================
// OTP SERVICE - Generate, send, and verify OTPs
// ============================================

const nodemailer = require("nodemailer");
const Otp = require("../models/Otp.model");

// -----------------------------------------------
// Generate a random 6-digit OTP number
// -----------------------------------------------
function generateOtp() {
  // Math.random() gives 0.0 to 0.9999...
  // * 900000 gives 0 to 899999
  // + 100000 gives 100000 to 999999 (always 6 digits)
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// -----------------------------------------------
// Create email transporter using Gmail SMTP
// Uses EMAIL_USER and EMAIL_PASS from .env
// -----------------------------------------------
function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Must be a Gmail App Password (not your regular password)
    },
  });
}

// -----------------------------------------------
// Build HTML email content for OTP
// -----------------------------------------------
function buildEmailHtml(otp, purpose) {
  const isRegister = purpose === "register";
  const title = isRegister ? "Verify Your Email" : "Login Verification";
  const subtitle = isRegister
    ? "You're almost there! Enter the OTP below to complete your registration."
    : "A login attempt was made to your Eventix account. Use the OTP below to confirm it was you.";
  const badgeText = isRegister ? "Registration OTP" : "Login OTP";
  const badgeColor = isRegister ? "#00b8ff" : "#00d4ff";
  const badgeBg = isRegister ? "#e0f7ff" : "#ccf3ff";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

          <!-- HEADER / LOGO -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" valign="middle" style="padding-right:14px;">
                    <img src="https://i.ibb.co/Md89Cmd/eventix-logo.png" alt="Eventix" width="56" height="56" style="display:block;border:0;border-radius:12px;" />
                  </td>
                  <td align="left" valign="middle">
                    <span style="font-size:32px;font-weight:900;color:#00d4ff;letter-spacing:1px;">Eventix</span>
                  </td>
                </tr>
              </table>
              <p style="color:#64748b;font-size:13px;margin:12px 0 0;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Enterprise Event Management</p>
            </td>
          </tr>

          <!-- MAIN CARD -->
          <tr>
            <td style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.4);">

              <!-- Top gradient accent -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:6px;background:linear-gradient(90deg,#00d4ff,#00b8ff,#0099ff);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 40px 44px;">

                <!-- Badge -->
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <span style="background:${badgeBg};color:${badgeColor};font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:8px 20px;border-radius:100px;display:inline-block;border:2px solid ${badgeColor};">
                      ${badgeText}
                    </span>
                  </td>
                </tr>

                <!-- Title -->
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <h1 style="margin:0;font-size:32px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;">${title}</h1>
                  </td>
                </tr>

                <!-- Subtitle -->
                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <p style="margin:0;font-size:16px;color:#64748b;line-height:1.7;max-width:440px;">${subtitle}</p>
                  </td>
                </tr>

                <!-- OTP Box -->
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <table cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#00d4ff 0%,#00b8ff 50%,#0099ff 100%);border-radius:20px;padding:36px 48px;text-align:center;width:100%;box-shadow:0 10px 40px rgba(0,212,255,0.3);">
                      <tr>
                        <td align="center">
                          <p style="margin:0 0 16px;font-size:11px;color:rgba(255,255,255,0.9);letter-spacing:3px;text-transform:uppercase;font-weight:700;">Your One-Time Password</p>
                          <span style="font-size:56px;font-weight:900;letter-spacing:20px;color:#ffffff;display:block;text-shadow:0 4px 20px rgba(0,0,0,0.3);">${otp}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Timer warning -->
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:12px;padding:16px 24px;">
                      <tr>
                        <td>
                          <p style="margin:0;font-size:14px;color:#78350f;line-height:1.6;">
                            <strong style="font-size:18px;">⏱️</strong>&nbsp; This OTP expires in <strong style="color:#d97706;">2 minutes</strong>. Do not share it with anyone.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Security tip -->
                <tr>
                  <td align="center">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-left:4px solid #00b8ff;border-radius:12px;padding:16px 24px;">
                      <tr>
                        <td>
                          <p style="margin:0;font-size:14px;color:#475569;line-height:1.7;">
                            <strong style="font-size:18px;">🔒</strong>&nbsp;<strong style="color:#1e293b;">Security tip:</strong> Eventix will never call you to ask for this OTP. If you didn't request this, ignore this email — your account is safe.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="padding-top:32px;">
              <p style="margin:0;font-size:13px;color:#64748b;font-weight:600;">
                &copy; ${new Date().getFullYear()} Eventix &nbsp;&middot;&nbsp; Enterprise Event Management
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `;
}

// -----------------------------------------------
// SEND OTP
// - Rate limited: only 1 OTP per 2 minutes (idempotency)
// - Generates OTP
// - Deletes any old OTPs for same email/purpose
// - Saves new OTP to MongoDB
// - Sends email
// -----------------------------------------------
async function sendOtp(email, purpose, tempData = null) {
  const normalizedEmail = email.toLowerCase().trim();
  const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
  const now = new Date();

  // ATOMIC UPSERT: Try to insert a new OTP document.
  // If a document already exists for this email+purpose (unique index), the upsert
  // will UPDATE it — but only if the cooldown has passed (using $lt filter on createdAt).
  // If the cooldown has NOT passed, the filter won't match and no update happens.
  const otp = generateOtp();
  const cooldownCutoff = new Date(now.getTime() - COOLDOWN_MS);

  const result = await Otp.findOneAndUpdate(
    {
      email: normalizedEmail,
      purpose,
      // Only allow update if the existing OTP is older than 2 minutes
      // (i.e. the cooldown has expired). If it's newer, this filter won't match.
      createdAt: { $lt: cooldownCutoff },
    },
    {
      $set: { otp, tempData, createdAt: now },
    },
    { new: true },
  );

  // If no existing doc matched the filter, it could mean:
  //   (a) No doc exists yet → try to insert a fresh one
  //   (b) A doc exists but is within cooldown → rate limit
  if (!result) {
    const existing = await Otp.findOne({ email: normalizedEmail, purpose });
    if (existing) {
      // Doc exists and is within cooldown — reject
      const ageMs = now.getTime() - new Date(existing.createdAt).getTime();
      const secondsLeft = Math.ceil((COOLDOWN_MS - ageMs) / 1000);
      const err = new Error(
        `Please wait ${secondsLeft} seconds before requesting a new OTP.`,
      );
      err.code = "RATE_LIMITED";
      err.secondsLeft = secondsLeft;
      throw err;
    }

    // No doc exists — insert a fresh one.
    // The unique index ensures only ONE concurrent request can succeed here.
    try {
      await Otp.create({
        email: normalizedEmail,
        otp,
        purpose,
        tempData,
        createdAt: now,
      });
    } catch (insertErr) {
      // Duplicate key error: another concurrent request already inserted.
      // Treat this as "already sent" — fetch the existing one for secondsLeft.
      if (insertErr.code === 11000) {
        const race = await Otp.findOne({ email: normalizedEmail, purpose });
        const ageMs = race
          ? now.getTime() - new Date(race.createdAt).getTime()
          : 0;
        const secondsLeft = Math.ceil((COOLDOWN_MS - ageMs) / 1000);
        const err = new Error(
          `Please wait ${secondsLeft} seconds before requesting a new OTP.`,
        );
        err.code = "RATE_LIMITED";
        err.secondsLeft = secondsLeft;
        throw err;
      }
      throw insertErr;
    }
  }

  // Send email
  const transporter = createTransporter();
  const subject =
    purpose === "register"
      ? "Your Eventix Registration OTP"
      : "Your Eventix Login OTP";

  await transporter.sendMail({
    from: `"Eventix" <${process.env.EMAIL_USER}>`,
    to: normalizedEmail,
    subject,
    html: buildEmailHtml(otp, purpose),
  });

  console.log(`[OTP Service] Sent ${purpose} OTP to ${normalizedEmail}`);
}

// -----------------------------------------------
// VERIFY OTP
// - Looks up OTP in database
// - Compares with provided OTP
// - Deletes OTP on success (one-time use)
// - Returns { valid: true/false, message, tempData }
// -----------------------------------------------
async function verifyOtp(email, otp, purpose) {
  const normalizedEmail = email.toLowerCase().trim();

  // Find OTP record in database
  const record = await Otp.findOne({ email: normalizedEmail, purpose });

  if (!record) {
    return {
      valid: false,
      message: "OTP has expired or was not found. Please request a new one.",
    };
  }

  // Compare OTPs
  if (record.otp !== otp.trim()) {
    return {
      valid: false,
      message: "Incorrect OTP. Please check your email and try again.",
    };
  }

  // OTP is valid — delete it (one-time use)
  const tempData = record.tempData;
  await Otp.deleteOne({ _id: record._id });

  return { valid: true, tempData };
}

module.exports = { sendOtp, verifyOtp };
