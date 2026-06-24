const UserProfile = require('../models/userProfile');

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generatePartnerCode() {
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return `CAPY-${suffix}`;
}

async function assignUniquePartnerCode(profile) {
  if (profile.partnerCode) return profile.partnerCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generatePartnerCode();
    const exists = await UserProfile.findOne({ partnerCode: code });
    if (!exists) {
      profile.partnerCode = code;
      await profile.save();
      return code;
    }
  }

  const fallback = `CAPY-${Date.now().toString(36).toUpperCase().slice(-4)}`;
  profile.partnerCode = fallback;
  await profile.save();
  return fallback;
}

module.exports = { generatePartnerCode, assignUniquePartnerCode };
