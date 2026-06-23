import 'dotenv/config';
import readline from 'node:readline/promises';
import { google } from 'googleapis';

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('Définis GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans .env avant de lancer ce script.');
  console.error('Crée-les dans Google Cloud Console > APIs & Services > Identifiants > OAuth client ID (type "Desktop app").');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/drive.readonly'],
  prompt: 'consent',
});

console.log('\n1. Ouvre cette URL dans ton navigateur et autorise l\'accès:\n');
console.log(authUrl);
console.log('\n2. Copie le code affiché et colle-le ici.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const code = await rl.question('Code: ');
rl.close();

const { tokens } = await oauth2Client.getToken(code.trim());

console.log('\nAjoute cette ligne à ton fichier .env:\n');
console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
console.log('\nPuis redémarre le serveur.');
