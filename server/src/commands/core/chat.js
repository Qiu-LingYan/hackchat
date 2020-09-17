/*
  Description: Rebroadcasts any `text` to all clients in a `channel`
*/

import * as UAC from '../utility/UAC/_info';

// module support functions
const parseText = (text) => {
  // verifies user input is text
  if (typeof text !== 'string') {
    return false;
  }

  let sanitizedText = text;

  // strip newlines from beginning and end
  sanitizedText = sanitizedText.replace(/^\s*\n|^\s+$|\n\s*$/g, '');
  // replace 3+ newlines with just 2 newlines
  sanitizedText = sanitizedText.replace(/\n{3,}/g, '\n\n');

  return sanitizedText;
};

// module main
export async function run({
  core, server, socket, payload,
}) {
  // check user input
  const text = parseText(payload.text);

  if (!text) {
    // lets not send objects or empty text, yea?
    return server.police.frisk(socket.address, 13);
  }

  // check for spam
  const score = text.length / 83 / 4;
  if (server.police.frisk(socket.address, score)) {
    return server.reply({
      cmd: 'warn', // @todo Remove english and change to numeric id
      text: 'You are sending too much text. Wait a moment and try again.\nPress the up arrow key to restore your last message.',
    }, socket);
  }

  // build chat payload
  const outgoingPayload = {
    cmd: 'chat',
    nick: socket.nick, /* @legacy */
    userid: socket.userid,
    channel: socket.channel,
    text,
    level: socket.level,
  };

  if (UAC.isAdmin(socket.level)) {
    outgoingPayload.admin = true;
  } else if (UAC.isModerator(socket.level)) {
    outgoingPayload.mod = true;
  }

  if (socket.trip) {
    outgoingPayload.trip = socket.trip; /* @legacy */
  }

  // broadcast to channel peers
  server.broadcast(outgoingPayload, { channel: socket.channel });

  // stats are fun
  core.stats.increment('messages-sent');

  return true;
}

// module hook functions
export function initHooks(server) {
  server.registerHook('in', 'chat', this.commandCheckIn.bind(this), 20);
  server.registerHook('in', 'chat', this.finalCmdCheck.bind(this), 254);
}

// checks for miscellaneous '/' based commands
export function commandCheckIn({ server, socket, payload }) {
  if (typeof payload.text !== 'string') {
    return false;
  }

  if (payload.text.startsWith('/myhash')) {
    server.reply({
      cmd: 'info',
      text: `Your hash: ${socket.hash}`,
    }, socket);

    return false;
  }

  return payload;
}

export function finalCmdCheck({ server, socket, payload }) {
  if (typeof payload.text !== 'string') {
    return false;
  }

  if (!payload.text.startsWith('/')) {
    return payload;
  }

  if (payload.text.startsWith('//')) {
    payload.text = payload.text.substr(1); // eslint-disable-line no-param-reassign

    return payload;
  }

  server.reply({
    cmd: 'warn', // @todo Remove english and change to numeric id
    text: `Unknown command: ${payload.text}`,
  }, socket);

  return false;
}

export const requiredData = ['text'];
export const info = {
  name: 'chat',
  description: 'Broadcasts passed `text` field to the calling users channel',
  usage: `
    API: { cmd: 'chat', text: '<text to send>' }
    Text: Uuuuhm. Just kind type in that little box at the bottom and hit enter.\n
    Bonus super secret hidden commands:
    /myhash`,
};
