const fs = require('fs');
const path = require('path');

const envDir = path.join(__dirname, 'src', 'environments');
const envFile = path.join(envDir, 'environment.ts');

const url = process.env.SUPABASE_URL || 'https://ttqsvvoiriszjjkkilos.supabase.co';
const key = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0cXN2dm9pcmlzempqa2tpbG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MTMzNTUsImV4cCI6MjEwNjk4OTM1NX0.Vkn1IAMpG_T1vhXCk_xcroQnJOsYE4ZwHC3Dio_6Kq8';

const content = `export const environment = {
  supabaseUrl: '${url}',
  supabaseKey: '${key}'
};
`;

if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
}

fs.writeFileSync(envFile, content, 'utf8');
console.log('✓ environment.ts successfully generated for build on Vercel / CI');
