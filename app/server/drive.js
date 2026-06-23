import { google } from 'googleapis';
import { findByDriveFileId } from './db.js';
import { ingestFromBuffer } from './ingest.js';

const SUPPORTED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain',
]);

function getOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error(
      'Import Google Drive non configuré. Lance `npm run drive:auth` après avoir défini GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET dans .env.'
    );
  }
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return client;
}

/**
 * Importe les fichiers nouveaux du dossier Drive configuré (DRIVE_FOLDER_ID).
 * Retourne le nombre de fichiers importés.
 */
export async function importFromDrive() {
  const folderId = process.env.DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error('DRIVE_FOLDER_ID manquant dans .env — précise l\'ID du dossier Drive à synchroniser.');
  }

  const auth = getOAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, size)',
    pageSize: 100,
  });

  let imported = 0;
  for (const file of res.data.files || []) {
    if (findByDriveFileId(file.id)) continue;
    if (!SUPPORTED_MIME.has(file.mimeType)) continue;

    const content = await drive.files.get(
      { fileId: file.id, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    await ingestFromBuffer(Buffer.from(content.data), file.name, 'google-drive', { driveFileId: file.id });
    imported += 1;
  }

  return imported;
}
