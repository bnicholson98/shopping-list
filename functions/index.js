const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

exports.onItemAdded = onDocumentCreated('currentList/{docId}', async (event) => {
  const data = event.data.data();
  await sendToAll(
    '\u{1F6D2} Malvern Shopping List',
    `"${data.text}" was added`,
    data.actorUid || null
  );
});

exports.onItemRemoved = onDocumentDeleted('currentList/{docId}', async (event) => {
  const data = event.data.data();
  await sendToAll(
    '\u2705 Malvern Shopping List',
    `"${data.text}" was checked off`,
    data.removedBy || null
  );
});

async function sendToAll(title, body, excludeUid) {
  const db = getFirestore();
  const messaging = getMessaging();

  const snap = await db.collection('fcmTokens').get();
  if (snap.empty) return;

  const tokens = [];
  const tokenToRef = new Map();

  snap.docs.forEach((d) => {
    const { token, uid } = d.data();
    if (token && uid !== excludeUid) {
      tokens.push(token);
      tokenToRef.set(token, d.ref);
    }
  });

  if (tokens.length === 0) return;

  const results = await Promise.allSettled(
    tokens.map((token) =>
      messaging.send({ token, data: { title, body } })
    )
  );

  // Clean up stale tokens
  const batch = db.batch();
  let dirty = false;

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const code = r.reason?.code;
      if (
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/registration-token-not-registered'
      ) {
        const ref = tokenToRef.get(tokens[i]);
        if (ref) { batch.delete(ref); dirty = true; }
      }
    }
  });

  if (dirty) await batch.commit();
}