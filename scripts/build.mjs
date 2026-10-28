import { cp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const hosting=JSON.parse(await readFile(path.join(root,'.openai/hosting.json'),'utf8'));
if(!hosting.project_id||hosting.static?.directory!=='dist')throw Error('The Sites hosting manifest is incomplete.');
await rm(path.join(root,'dist'),{recursive:true,force:true});
await cp(path.join(root,'src'),path.join(root,'dist'),{recursive:true});
console.log('Built the LongEar Diaries public site and front-end office demo.');
