const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const FUNCTION_OPTS = {
  maxInstances: 3,          // billing cap: max 3 concurrent executions
};

exports.onItemAdded = onDocumentCreated(
  { document: 'currentList/{docId}', ...FUNCTION_OPTS },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    await sendFiltered(
      '\u{1F6D2} Malvern Shopping List',
      `"${data.text}" was added`,
      data.actorUid || null,
      'notifyOnAdd'
    );
  }
);

exports.onItemRemoved = onDocumentDeleted(
  { document: 'currentList/{docId}', ...FUNCTION_OPTS },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    await sendFiltered(
      '\u2705 Malvern Shopping List',
      `"${data.text}" was checked off`,
      data.removedBy || null,
      'notifyOnRemove'
    );
  }
);

async function sendFiltered(title, body, excludeUid, preferenceField) {
  const db = getFirestore();
  const messaging = getMessaging();

  const snap = await db.collection('fcmTokens').get();
  if (snap.empty) return;

  const tokens = [];
  const tokenToRef = new Map();

  snap.docs.forEach((d) => {
    const data = d.data();
    const { token, uid } = data;

    if (!token) return;                        // no token
    if (uid === excludeUid) return;            // don't notify actor
    if (data[preferenceField] === false) return; // opted out (undefined = opted in for backcompat)

    tokens.push(token);
    tokenToRef.set(token, d.ref);
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