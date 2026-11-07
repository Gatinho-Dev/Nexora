const { test } = require('node:test');
const assert = require('node:assert/strict');
const { trustedFrame, safeExternal, validRpc } = require('../dist-electron/security');
test('trusts only the local app and the explicit development origin', () => {
  assert.equal(trustedFrame('nexora://app/', false), true);
  assert.equal(trustedFrame('https://nexorachat.cloud/', false), false);
  assert.equal(trustedFrame('http://127.0.0.1:5174/', false), false);
  assert.equal(trustedFrame('http://127.0.0.1:5174/', true), true);
  assert.equal(trustedFrame('nexora://app.evil/', false), false);
});
test('external links reject unknown origins and dangerous protocols', () => {
  assert.equal(safeExternal('https://nexorachat.cloud/forgot-password'), true);
  for (const url of ['https://nexorachat.cloud.evil.test/', 'file:///etc/passwd', 'https://user:pass@nexorachat.cloud/']) assert.equal(safeExternal(url), false);
});
test('IPC only admits known operations and bounded arguments', () => {
  assert.equal(validRpc('server.list', undefined), true);
  assert.equal(validRpc('server.get', {serverId: 1}), true);
  assert.equal(validRpc('message.send', {channelId: 2, content: 'oi'}), true);
  assert.equal(validRpc('message.send', {channelId: 2, conversationId: 3, content: 'oi'}), false);
  assert.equal(validRpc('message.send', {channelId: 2, content: 'x'.repeat(4001)}), false);
  assert.equal(validRpc('account.updateProfile', {}), false);
  assert.equal(validRpc('server.get', {serverId: 1, extra: true}), false);
  assert.equal(validRpc('advanced.profile.myProfile', undefined), true);
  assert.equal(validRpc('advanced.profile.publicProfile', {userId: 7}), true);
  assert.equal(validRpc('advanced.profile.publicProfile', {userId: 0}), false);
  assert.equal(validRpc('advanced.profile.publicProfile', {userId: 7, extra: 1}), false);
});
test('account operations accept only the documented shapes', () => {
  assert.equal(validRpc('account.sessionsList', undefined), true);
  assert.equal(validRpc('account.sessionRevokeOthers', undefined), true);
  assert.equal(validRpc('account.privacy', undefined), true);
  assert.equal(validRpc('account.sessionRevoke', { sessionId: 'abc123' }), true);
  assert.equal(validRpc('account.sessionRevoke', { sessionId: '' }), false);
  assert.equal(validRpc('account.sessionRevoke', { sessionId: 'x'.repeat(33) }), false);
  assert.equal(validRpc('account.setUsername', { username: 'nexora_user.1' }), true);
  assert.equal(validRpc('account.setUsername', { username: 'ab' }), false);
  assert.equal(validRpc('account.setUsername', { username: 'com espaço' }), false);
  assert.equal(validRpc('account.setPrivacy', { readReceipts: false }), true);
  assert.equal(validRpc('account.setPrivacy', { readReceipts: 'no' }), false);
  assert.equal(validRpc('account.setPrivacy', {}), false);
  assert.equal(validRpc('account.updateProfile', { displayName: 'x' }), false);
  assert.equal(validRpc('account.emailStatus', undefined), true);
  assert.equal(validRpc('account.resendVerification', undefined), true);
  assert.equal(validRpc('account.cancelEmailChange', undefined), true);
  assert.equal(validRpc('account.requestEmailChange', { email: 'eu@exemplo.com', currentPassword: 'senha' }), true);
  assert.equal(validRpc('account.requestEmailChange', { email: 'nao-e-email', currentPassword: 'senha' }), false);
  assert.equal(validRpc('account.requestEmailChange', { email: 'eu@exemplo.com', currentPassword: '' }), false);
  assert.equal(validRpc('account.requestEmailChange', { email: 'eu@exemplo.com', currentPassword: 'senha', extra: 1 }), false);
  assert.equal(validRpc('account.removeEmail', { currentPassword: 'senha', code: '123456' }), true);
  assert.equal(validRpc('account.removeEmail', {}), false);
  assert.equal(validRpc('account.changePassword', { currentPassword: 'antiga', newPassword: 'nova123' }), true);
  assert.equal(validRpc('account.changePassword', { currentPassword: 'antiga', newPassword: '123' }), false);
  assert.equal(validRpc('account.changePassword', { currentPassword: 'antiga', newPassword: 'nova123', disconnectOthers: 'sim' }), false);
});
test('message operations only accept bounded, unambiguous payloads', () => {
  assert.equal(validRpc('message.send', {channelId: 1, content: 'resposta', replyToId: 5}), true);
  assert.equal(validRpc('message.send', {channelId: 1, content: 'resposta', replyToId: -1}), false);
  assert.equal(validRpc('message.edit', {messageId: 3, content: 'editado'}), true);
  assert.equal(validRpc('message.delete', {messageId: 3}), true);
  assert.equal(validRpc('message.addReaction', {messageId: 3, emoji: '👍'}), true);
  assert.equal(validRpc('message.removeReaction', {messageId: 3, emoji: '👍'}), true);
  assert.equal(validRpc('message.addReaction', {messageId: 3, emoji: 'x'.repeat(33)}), false);
  assert.equal(validRpc('message.markRead', {conversationId: 2, lastMessageId: 9}), true);
  assert.equal(validRpc('message.markRead', {conversationId: 2, channelId: 4, lastMessageId: 9}), false);
  assert.equal(validRpc('message.edit', {messageId: 3, content: ' ', extra: true}), false);
});
test('typing accepts only a single target and no arbitrary websocket event', () => {
  const { validTyping } = require('../dist-electron/security');
  assert.equal(validTyping({channelId: 1}), true);
  assert.equal(validTyping({conversationId: 2}), true);
  assert.equal(validTyping({channelId: 1, conversationId: 2}), false);
  assert.equal(validTyping({channelId: 1, t: 'signal'}), false);
});
test('media permission is granted only to the trusted renderer for camera and microphone', () => {
  const { mediaPermissionAllowed } = require('../dist-electron/security');
  assert.equal(mediaPermissionAllowed('media', 'nexora://app/', false), true);
  assert.equal(mediaPermissionAllowed('media', 'https://nexorachat.cloud/', false), false);
  assert.equal(mediaPermissionAllowed('display-capture', 'nexora://app/', false), false);
  assert.equal(mediaPermissionAllowed('geolocation', 'nexora://app/', false), false);
  assert.equal(mediaPermissionAllowed('media', undefined, false), false);
});

test('voice outbound events accept only the documented, bounded shapes', () => {
  const { validVoiceOutbound } = require('../dist-electron/security');
  assert.equal(validVoiceOutbound({ t: 'voice:join', channelId: 5 }), true);
  assert.equal(validVoiceOutbound({ t: 'voice:join', conversationId: 9, initiated: true, video: false }), true);
  assert.equal(validVoiceOutbound({ t: 'voice:join', channelId: 5, conversationId: 9 }), false);
  assert.equal(validVoiceOutbound({ t: 'voice:join' }), false);
  assert.equal(validVoiceOutbound({ t: 'voice:join', channelId: -1 }), false);
  assert.equal(validVoiceOutbound({ t: 'voice:join', channelId: 5, extra: true }), false);
  assert.equal(validVoiceOutbound({ t: 'voice:state', muted: true, voiceSessionId: 'abc' }), true);
  assert.equal(validVoiceOutbound({ t: 'voice:state', muted: 'yes' }), false);
  assert.equal(validVoiceOutbound({ t: 'signal', to: 3, channelId: 5, data: { candidate: null } }), true);
  assert.equal(validVoiceOutbound({ t: 'signal', to: 0, channelId: 5, data: {} }), false);
  assert.equal(validVoiceOutbound({ t: 'signal', to: 3, channelId: 5, data: 'x'.repeat(70 * 1024) }), false);
  assert.equal(validVoiceOutbound({ t: 'typing', channelId: 5 }), false);
  assert.equal(validVoiceOutbound(null), false);
});

test('message.send accepts attachment ids only as bounded positive integer lists', () => {
  const { allowedUploadType } = require('../dist-electron/security');
  assert.equal(validRpc('message.send', { channelId: 1, content: '', attachmentIds: [3, 4] }), true);
  assert.equal(validRpc('message.send', { channelId: 1, content: '', attachmentIds: [] }), false);
  assert.equal(validRpc('message.send', { channelId: 1, content: 'hi', attachmentIds: [0] }), false);
  assert.equal(validRpc('message.send', { channelId: 1, content: 'hi', attachmentIds: Array(11).fill(1) }), false);
  assert.equal(validRpc('message.send', { channelId: 1, content: 'hi', attachmentIds: ['1'] }), false);
  assert.equal(validRpc('message.send', { channelId: 1, content: 'hi', attachmentIds: 1 }), false);
  assert.equal(allowedUploadType('image/png'), true);
  assert.equal(allowedUploadType('application/pdf'), true);
  assert.equal(allowedUploadType('text/html'), false);
  assert.equal(allowedUploadType('application/x-msdownload'), false);
});
