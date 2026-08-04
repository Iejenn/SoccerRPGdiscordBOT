const fs = require('fs');
const path = require('path');

// In Docker this is set to a mounted volume (e.g. /data) so ownership data
// survives container restarts/rebuilds. Locally it just defaults to this folder.
const DATA_DIR = process.env.DATA_DIR || __dirname;
const FILE_PATH = path.join(DATA_DIR, 'channels.json');

function loadAll() {
  if (!fs.existsSync(FILE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveAll(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
}

function key(guildId, ownerId) {
  return `${guildId}:${ownerId}`;
}

function getOwnerChannel(guildId, ownerId) {
  const data = loadAll();
  return data[key(guildId, ownerId)] || null;
}

function setOwnerChannel(guildId, ownerId, value) {
  const data = loadAll();
  data[key(guildId, ownerId)] = value;
  saveAll(data);
}

function deleteOwnerChannel(guildId, ownerId) {
  const data = loadAll();
  delete data[key(guildId, ownerId)];
  saveAll(data);
}

module.exports = { getOwnerChannel, setOwnerChannel, deleteOwnerChannel };
